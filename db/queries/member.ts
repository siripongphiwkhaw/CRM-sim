import { get, all, run } from "../client";
import type { Customer } from "./customers";

/**
 * Member-facing lookups for the Only-One LIFF app — identity resolution and
 * the composite reads its screens need. Loyalty maths stays in loyalty.ts.
 */

export function getCustomerByLineUserId(lineUserId: string): Promise<Customer | undefined> {
  return get<Customer>("SELECT * FROM customers WHERE line_user_id = ?", [lineUserId]);
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
