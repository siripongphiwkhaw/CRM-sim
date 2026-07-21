import { get, all, run } from "../client";
import { getCustomer, getCustomerByReferralCode, type Customer } from "./customers";
import { recordConsent } from "./consent";
import { postEarn } from "./loyalty";
import { REFERRAL_BONUS_POINTS } from "@/lib/loyaltyEngine";

/**
 * Member-facing lookups for the Only-One LIFF app — identity resolution and
 * the composite reads its screens need. Loyalty maths stays in loyalty.ts.
 */

export function getCustomerByLineUserId(lineUserId: string): Promise<Customer | undefined> {
  return get<Customer>("SELECT * FROM customers WHERE line_user_id = ?", [lineUserId]);
}

export interface LineRegistration {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  /** Optional referrer's own referral_code, typed in by the new member. */
  referralCode?: string;
}

/**
 * Registers a member for a verified LINE user on first login.
 *
 * Safe to create: the LINE user id is a signed `sub` verified server-side, so
 * this mints a fresh membership bound to it. Phone/email are stored as profile
 * data only — they are deliberately NOT used to match or merge into an existing
 * member, which would be an account-takeover vector. Marketing consent defaults
 * to DENIED (opt-in via the account screen); analytics is granted.
 *
 * referralCode is resolved by exact code lookup only — never by phone/email —
 * so it carries no account-takeover risk. An unknown/blank code is silently
 * ignored rather than blocking registration.
 */
export async function registerLineMember(
  lineUserId: string,
  input: LineRegistration
): Promise<Customer> {
  const existing = await getCustomerByLineUserId(lineUserId);
  if (existing) return existing;

  const referrer = input.referralCode
    ? await getCustomerByReferralCode(input.referralCode.trim())
    : undefined;

  const next = await get<{ next: number }>(
    "SELECT COALESCE(MAX(id), 0) + 1 AS next FROM customers"
  );
  const nextId = next?.next ?? 1;
  const memberCode = `CUS-${String(nextId).padStart(6, "0")}`;
  const referralCode = `RF-${nextId.toString(36).toUpperCase()}`;

  let id: number;
  try {
    id = await run(
      `INSERT INTO customers
         (member_code, first_name, last_name, email, phone, brand, cust_type,
          register_channel, data_level, line_user_id, line_linked_at,
          referral_code, referred_by)
       VALUES (@code, @first, @last, @email, @phone, 'LINE', 'B2C', 'LINE',
               'Register', @line, now(), @refcode, @referredBy)
       RETURNING id`,
      {
        code: memberCode,
        first: input.firstName,
        last: input.lastName,
        email: input.email || null,
        phone: input.phone || null,
        line: lineUserId,
        refcode: referralCode,
        referredBy: referrer?.id ?? null,
      }
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

  // One-time bonus for both sides. Safe from double-award: this branch only
  // runs on the INSERT that actually created the row (the existing-row
  // short-circuit above returns early on every subsequent call).
  if (referrer) {
    await postEarn(id, REFERRAL_BONUS_POINTS, {
      refType: "referral",
      refId: referrer.id,
      note: `Referred by ${referrer.member_code}`,
      source: "liff",
    });
    await postEarn(referrer.id, REFERRAL_BONUS_POINTS, {
      refType: "referral",
      refId: id,
      note: `Referred ${memberCode}`,
      source: "liff",
    });
  }

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
