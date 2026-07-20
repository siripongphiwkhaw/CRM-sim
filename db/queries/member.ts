import { get, all, run } from "../client";
import { getCustomer, type Customer } from "./customers";
import { recordConsent } from "./consent";

/**
 * Member-facing lookups for the Only-One LIFF app — identity resolution and
 * the composite reads its screens need. Loyalty maths stays in loyalty.ts.
 */

export function getCustomerByLineUserId(lineUserId: string): Promise<Customer | undefined> {
  return get<Customer>("SELECT * FROM customers WHERE line_user_id = ?", [lineUserId]);
}

/**
 * Returns the member for a verified LINE user, creating one on first login.
 *
 * Safe to auto-create: the LINE user id is a signed `sub` verified server-side,
 * and this mints a fresh membership bound to it — it never matches an existing
 * account by a guessable field, so there is no takeover surface (unlike a
 * self-serve phone match). Marketing consent defaults to DENIED (opt-in via the
 * account screen); analytics is granted.
 */
export async function getOrCreateLineMember(
  lineUserId: string,
  displayName?: string
): Promise<Customer> {
  const existing = await getCustomerByLineUserId(lineUserId);
  if (existing) return existing;

  const parts = (displayName ?? "").trim().split(/\s+/).filter(Boolean);
  const firstName = parts[0] || "LINE";
  const lastName = parts.slice(1).join(" ") || "Member";

  const next = await get<{ next: number }>(
    "SELECT COALESCE(MAX(id), 0) + 1 AS next FROM customers"
  );
  const memberCode = `CUS-${String(next?.next ?? 1).padStart(6, "0")}`;

  let id: number;
  try {
    id = await run(
      `INSERT INTO customers
         (member_code, first_name, last_name, brand, cust_type, register_channel,
          data_level, line_user_id, line_linked_at)
       VALUES (@code, @first, @last, 'LINE', 'B2C', 'LINE', 'Register', @line, now())
       RETURNING id`,
      { code: memberCode, first: firstName, last: lastName, line: lineUserId }
    );
  } catch (e) {
    // Another concurrent first-login won the unique line_user_id — use theirs.
    if (e instanceof Error && /23505|duplicate|unique/i.test(e.message)) {
      const raced = await getCustomerByLineUserId(lineUserId);
      if (raced) return raced;
    }
    throw e;
  }

  await recordConsent({ customer_id: id, purpose: "MARKETING", status: "DENIED", source: "line_liff" });
  await recordConsent({ customer_id: id, purpose: "ANALYTICS", status: "GRANTED", source: "line_liff" });

  return (await getCustomer(id))!;
}

/** Links a LINE account to a member. Caller handles unique violations (23505). */
export async function linkLineUser(customerId: number, lineUserId: string): Promise<void> {
  await run(
    `UPDATE customers
        SET line_user_id = @line_user_id, line_linked_at = now(), updated_at = now()
      WHERE id = @id`,
    { id: customerId, line_user_id: lineUserId }
  );
}

export async function unlinkLineUser(customerId: number): Promise<void> {
  await run(
    `UPDATE customers
        SET line_user_id = NULL, line_linked_at = NULL, updated_at = now()
      WHERE id = @id`,
    { id: customerId }
  );
}

export interface MemberPickerRow {
  id: number;
  member_code: string;
  name: string;
  tier: string;
  points: number;
  cust_type: string;
}

/** B2C members for the dev/staff-preview picker. Only-One is B2C-only. */
export function listB2cMembers(limit = 50): Promise<MemberPickerRow[]> {
  return all<MemberPickerRow>(
    `SELECT id, member_code, (first_name || ' ' || last_name) AS name,
            tier, points, cust_type
       FROM customers
      WHERE cust_type = 'B2C'
      ORDER BY points DESC, id ASC
      LIMIT ${limit}`
  );
}
