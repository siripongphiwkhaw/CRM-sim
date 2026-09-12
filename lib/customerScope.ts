import { cache } from "react";
import { requireSession } from "./session";
import { getCustomerScopeForUser } from "@/db/queries/departments";
import type { CustomerScope } from "./constants";

/**
 * Department-scoped customer visibility.
 *
 * A staff user sees B2C customers, B2B customers, or both, decided by their home
 * department's `customer_scope`. This module is the single seam every customer-
 * reading query goes through: it resolves the viewer's scope once per request
 * and hands back a SQL fragment that restricts `customers` rows.
 *
 * The enforcement shape is a DERIVED TABLE, not a WHERE predicate. A predicate
 * like `cust_type = 'B2C'` appended to a `LEFT JOIN customers` silently turns it
 * into an inner join and drops unlinked rows. Substituting the table name —
 * `LEFT JOIN ${customersFor(scope)} c ON …` — keeps join cardinality intact.
 * The interpolation is safe because the value always comes from this closed
 * union, never from a request.
 */

/** "ALL" is a real department scope. This sentinel is for code paths that
 * legitimately read every customer regardless of any viewer — score recompute,
 * birthday rewards, insight generation, identity-match scan, the seed scripts.
 * A distinct literal (not "ALL") so `grep SYSTEM_SCOPE` is the complete audit
 * list of unscoped readers. */
export const SYSTEM_SCOPE = "__system" as const;

/** NONE = a non-admin with no home department: sees zero customers. */
export type ReadScope = CustomerScope | "NONE" | typeof SYSTEM_SCOPE;

/**
 * Drop-in replacement for the table name `customers` in a query's FROM / JOIN.
 * Postgres flattens the subquery, so there is no meaningful cost.
 *
 *   `FROM ${customersFor(scope)} c`
 *   `LEFT JOIN ${customersFor(scope)} c ON c.id = x.customer_id`
 */
export function customersFor(scope: ReadScope): string {
  if (scope === "ALL" || scope === SYSTEM_SCOPE) return "customers";
  if (scope === "NONE") return "(SELECT * FROM customers WHERE false)";
  return `(SELECT * FROM customers WHERE cust_type = '${scope}')`;
}

/**
 * A boolean SQL fragment for tables that reference customers by id without
 * joining the row — e.g. `transactions`, where a scoped aggregate needs
 * `WHERE ${scopedCustomerIds(scope)}` and nothing else changes.
 */
export function scopedCustomerIds(
  scope: ReadScope,
  column = "customer_id"
): string {
  if (scope === "ALL" || scope === SYSTEM_SCOPE) return "TRUE";
  if (scope === "NONE") return "FALSE";
  return `${column} IN (SELECT id FROM customers WHERE cust_type = '${scope}')`;
}

/** True only when the viewer sees every customer — gates whole-population
 * ('global') insights and any other all-or-nothing surface. */
export function isFullScope(scope: ReadScope): boolean {
  return scope === "ALL" || scope === SYSTEM_SCOPE;
}

/**
 * The current request's customer scope. Memoized with React `cache()` so the
 * ~one DB lookup happens once however many callers ask within a request.
 * Resolved per request (not stored on the session cookie like `modules`), so an
 * admin's scope change takes effect on the user's next page load.
 */
export const getCustomerScope = cache(async (): Promise<ReadScope> => {
  const session = await requireSession();
  if (session.role === "admin") return "ALL";
  const { hasDepartment, scope } = await getCustomerScopeForUser(
    session.userId!
  );
  if (!hasDepartment) return "NONE"; // fail closed
  return scope ?? "ALL"; // NULL scope = never configured = ALL
});

/** `{ session, scope }` for the customer-touching pages and actions.
 * `requireSession()` is left alone so its many non-customer call sites don't
 * churn. */
export async function requireScopedSession() {
  const [session, scope] = await Promise.all([
    requireSession(),
    getCustomerScope(),
  ]);
  return { session, scope };
}
