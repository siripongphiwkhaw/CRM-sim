import { getCustomer, getCustomerByCode, type Customer } from "@/db/queries/customers";
import { SYSTEM_SCOPE } from "@/lib/customerScope";

/** Resolves a member by numeric id or CUS-code path segment. The v1 API is
 * authenticated by API key, which carries no department, so member resolution
 * here is deliberately unscoped — see the customer-scope decision in the Guide. */
export async function resolveMember(idOrCode: string): Promise<Customer | undefined> {
  const asNum = Number(idOrCode);
  if (Number.isInteger(asNum) && asNum > 0) return getCustomer(SYSTEM_SCOPE, asNum);
  return getCustomerByCode(SYSTEM_SCOPE, idOrCode);
}
