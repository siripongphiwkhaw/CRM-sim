import { get, all, run, batch } from "../client";
import { recordConsent } from "./consent";
import type { Brand, Tier, DataLevel, CustType } from "@/lib/constants";

export interface Customer {
  id: number;
  member_code: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  brand: Brand;
  cust_type: CustType;
  tier: Tier;
  points: number;
  register_channel: string | null;
  data_level: DataLevel;
  clv: number;
  last_purchase_at: string | null;
  /** Linked Only-One LINE account, NULL until staff link it. */
  line_user_id: string | null;
  line_linked_at: string | null;
  /** YYYY-MM-DD, month+day used for birthday bonuses — see runBirthdayRewards. */
  birth_date: string | null;
  /** This member's own shareable referral code. */
  referral_code: string | null;
  /** Customer id of whoever referred this member, set once at registration. */
  referred_by: number | null;
  /** Last 4 digits only — the full number is encrypted (tax_id_encrypted,
   * intentionally NOT exposed here) and decrypted only where a real need to
   * read it exists. See lib/pii.ts. */
  tax_id_last4: string | null;
  /** Derived from the ID's leading digit — JURISTIC = registered company. */
  tax_entity_type: "JURISTIC" | "NATURAL" | null;
  identity_verified_at: string | null;
  /** Staff-set INSTITUTIONAL override — never inferred. */
  institutional_override: number;
  created_at: string;
  updated_at: string;
}

export interface CustomerInput {
  first_name: string;
  last_name: string;
  email?: string | null;
  phone?: string | null;
  brand: Brand;
  cust_type: CustType;
  register_channel?: string | null;
  data_level: DataLevel;
  birth_date?: string | null;
}

// Sortable columns are allow-listed — the sort key comes from the URL.
const SORT_COLUMNS: Record<string, string> = {
  name: "last_name",
  brand: "brand",
  type: "cust_type",
  tier: "tier",
  points: "points",
  clv: "clv",
  created: "created_at",
};

export function listCustomers(opts?: {
  search?: string;
  brand?: string;
  tier?: string;
  custType?: string;
  sort?: string;
  dir?: string;
}): Promise<Customer[]> {
  const clauses: string[] = [];
  const params: (string | number)[] = [];

  if (opts?.search) {
    clauses.push(
      "(first_name LIKE ? OR last_name LIKE ? OR email LIKE ? OR member_code LIKE ?)"
    );
    const like = `%${opts.search}%`;
    params.push(like, like, like, like);
  }
  if (opts?.brand) {
    clauses.push("brand = ?");
    params.push(opts.brand);
  }
  if (opts?.tier) {
    clauses.push("tier = ?");
    params.push(opts.tier);
  }
  if (opts?.custType) {
    clauses.push("cust_type = ?");
    params.push(opts.custType);
  }

  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const column = SORT_COLUMNS[opts?.sort ?? ""] ?? "created_at";
  const dir = opts?.dir === "asc" ? "ASC" : "DESC";
  return all<Customer>(
    `SELECT * FROM customers ${where} ORDER BY ${column} ${dir}`,
    params
  );
}

export function listRecentCustomers(limit = 5): Promise<Customer[]> {
  return all<Customer>(
    "SELECT * FROM customers ORDER BY updated_at DESC LIMIT ?",
    [limit]
  );
}

export function getTopCustomer(): Promise<Customer | undefined> {
  return get<Customer>("SELECT * FROM customers ORDER BY clv DESC LIMIT 1");
}

export function getCustomer(id: number): Promise<Customer | undefined> {
  return get<Customer>("SELECT * FROM customers WHERE id = ?", [id]);
}

export function getCustomerByCode(code: string): Promise<Customer | undefined> {
  return get<Customer>("SELECT * FROM customers WHERE member_code = ?", [code]);
}

export function getCustomerByReferralCode(code: string): Promise<Customer | undefined> {
  return get<Customer>("SELECT * FROM customers WHERE referral_code = ?", [code]);
}

/** Finds an existing member by phone or email (duplicate-registration guard). */
export function findDuplicate(
  phone?: string | null,
  email?: string | null
): Promise<Customer | undefined> {
  if (!phone && !email) return Promise.resolve(undefined);
  return get<Customer>(
    `SELECT * FROM customers
     WHERE (@phone::text IS NOT NULL AND phone = @phone)
        OR (@email::text IS NOT NULL AND email = @email)
     LIMIT 1`,
    { phone: phone ?? null, email: email ?? null }
  );
}

export type ConsentMode = "all" | "no_marketing";

/**
 * Registers a member and records the initial per-purpose consent rows. "all"
 * grants MARKETING + ANALYTICS; "no_marketing" denies MARKETING, grants ANALYTICS.
 */
export async function createCustomer(
  input: CustomerInput,
  consentMode: ConsentMode = "all"
): Promise<number> {
  const next = await get<{ next: number }>(
    "SELECT COALESCE(MAX(id), 0) + 1 AS next FROM customers"
  );
  const nextId = next?.next ?? 1;
  const memberCode = `CUS-${String(nextId).padStart(6, "0")}`;
  // Derived from the predicted next id (same prediction member_code already
  // relies on) — deterministic and unique with no extra round trip.
  const referralCode = `RF-${nextId.toString(36).toUpperCase()}`;

  const id = await run(
    `INSERT INTO customers
       (member_code, first_name, last_name, email, phone, brand, cust_type,
        register_channel, data_level, birth_date, referral_code)
     VALUES
       (@member_code, @first_name, @last_name, @email, @phone, @brand, @cust_type,
        @register_channel, @data_level, @birth_date, @referral_code)
     RETURNING id`,
    {
      member_code: memberCode,
      first_name: input.first_name,
      last_name: input.last_name,
      email: input.email ?? null,
      phone: input.phone ?? null,
      brand: input.brand,
      cust_type: input.cust_type,
      register_channel: input.register_channel ?? null,
      data_level: input.data_level,
      // `|| null` not `?? null`: the form can submit "" for a cleared date,
      // and an empty string would fail the ::date cast in runBirthdayRewards.
      birth_date: input.birth_date || null,
      referral_code: referralCode,
    }
  );

  await recordConsent({
    customer_id: id,
    purpose: "MARKETING",
    status: consentMode === "all" ? "GRANTED" : "DENIED",
    source: "registration",
  });
  await recordConsent({
    customer_id: id,
    purpose: "ANALYTICS",
    status: "GRANTED",
    source: "registration",
  });
  return id;
}

export async function updateCustomer(
  id: number,
  input: CustomerInput
): Promise<void> {
  await run(
    `UPDATE customers SET
       first_name = @first_name, last_name = @last_name, email = @email,
       phone = @phone, brand = @brand, cust_type = @cust_type,
       register_channel = @register_channel, data_level = @data_level,
       birth_date = @birth_date, updated_at = now()
     WHERE id = @id`,
    {
      id,
      first_name: input.first_name,
      last_name: input.last_name,
      email: input.email ?? null,
      phone: input.phone ?? null,
      brand: input.brand,
      cust_type: input.cust_type,
      register_channel: input.register_channel ?? null,
      data_level: input.data_level,
      birth_date: input.birth_date || null,
    }
  );
}

/** Deletes the customer and all dependent rows atomically. */
export async function deleteCustomer(id: number): Promise<void> {
  await batch([
    { sql: "DELETE FROM interactions WHERE customer_id = ?", args: [id] },
    { sql: "DELETE FROM transactions WHERE customer_id = ?", args: [id] },
    { sql: "DELETE FROM loyalty_ledger WHERE customer_id = ?", args: [id] },
    { sql: "DELETE FROM consents WHERE customer_id = ?", args: [id] },
    { sql: "UPDATE cases SET customer_id = NULL WHERE customer_id = ?", args: [id] },
    { sql: "UPDATE distributors SET customer_id = NULL WHERE customer_id = ?", args: [id] },
    { sql: "DELETE FROM customers WHERE id = ?", args: [id] },
  ]);
}
