import { getCustomer, getCustomerByCode, type Customer } from "@/db/queries/customers";

/** Resolves a member by numeric id or CUS-code path segment. */
export async function resolveMember(idOrCode: string): Promise<Customer | undefined> {
  const asNum = Number(idOrCode);
  if (Number.isInteger(asNum) && asNum > 0) return getCustomer(asNum);
  return getCustomerByCode(idOrCode);
}
