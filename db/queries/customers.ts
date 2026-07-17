import { get, all, run, batch } from "../client";
import type { Brand, Tier, DataLevel } from "@/lib/constants";

export interface Customer {
  id: number;
  member_code: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  brand: Brand;
  tier: Tier;
  points: number;
  register_channel: string | null;
  data_level: DataLevel;
  consent_pdpa: number;
  consent_marketing: number;
  consent_migration: number;
  clv: number;
  last_purchase_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CustomerInput {
  first_name: string;
  last_name: string;
  email?: string | null;
  phone?: string | null;
  brand: Brand;
  tier: Tier;
  points: number;
  register_channel?: string | null;
  data_level: DataLevel;
  consent_pdpa: boolean;
  consent_marketing: boolean;
  consent_migration: boolean;
}

// Sortable columns are allow-listed — the sort key comes from the URL.
const SORT_COLUMNS: Record<string, string> = {
  name: "last_name",
  brand: "brand",
  tier: "tier",
  points: "points",
  clv: "clv",
  created: "created_at",
};

export function listCustomers(opts?: {
  search?: string;
  brand?: string;
  tier?: string;
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

export async function setCustomerTier(id: number, tier: Tier): Promise<void> {
  await run(
    "UPDATE customers SET tier = ?, updated_at = datetime('now') WHERE id = ?",
    [tier, id]
  );
}

export function getCustomer(id: number): Promise<Customer | undefined> {
  return get<Customer>("SELECT * FROM customers WHERE id = ?", [id]);
}

export async function createCustomer(input: CustomerInput): Promise<number> {
  const next = await get<{ next: number }>(
    "SELECT COALESCE(MAX(id), 0) + 1 AS next FROM customers"
  );
  const memberCode = `MBR-${10000 + (next?.next ?? 1)}`;

  return run(
    `INSERT INTO customers
       (member_code, first_name, last_name, email, phone, brand, tier, points,
        register_channel, data_level, consent_pdpa, consent_marketing, consent_migration)
     VALUES
       (@member_code, @first_name, @last_name, @email, @phone, @brand, @tier, @points,
        @register_channel, @data_level, @consent_pdpa, @consent_marketing, @consent_migration)`,
    {
      member_code: memberCode,
      first_name: input.first_name,
      last_name: input.last_name,
      email: input.email ?? null,
      phone: input.phone ?? null,
      brand: input.brand,
      tier: input.tier,
      points: input.points,
      register_channel: input.register_channel ?? null,
      data_level: input.data_level,
      consent_pdpa: input.consent_pdpa ? 1 : 0,
      consent_marketing: input.consent_marketing ? 1 : 0,
      consent_migration: input.consent_migration ? 1 : 0,
    }
  );
}

export async function updateCustomer(
  id: number,
  input: CustomerInput
): Promise<void> {
  await run(
    `UPDATE customers SET
       first_name = @first_name, last_name = @last_name, email = @email,
       phone = @phone, brand = @brand, tier = @tier, points = @points,
       register_channel = @register_channel, data_level = @data_level,
       consent_pdpa = @consent_pdpa, consent_marketing = @consent_marketing,
       consent_migration = @consent_migration, updated_at = datetime('now')
     WHERE id = @id`,
    {
      id,
      first_name: input.first_name,
      last_name: input.last_name,
      email: input.email ?? null,
      phone: input.phone ?? null,
      brand: input.brand,
      tier: input.tier,
      points: input.points,
      register_channel: input.register_channel ?? null,
      data_level: input.data_level,
      consent_pdpa: input.consent_pdpa ? 1 : 0,
      consent_marketing: input.consent_marketing ? 1 : 0,
      consent_migration: input.consent_migration ? 1 : 0,
    }
  );
}

/** Deletes the customer and its interaction history atomically. */
export async function deleteCustomer(id: number): Promise<void> {
  await batch([
    { sql: "DELETE FROM interactions WHERE customer_id = ?", args: [id] },
    { sql: "DELETE FROM customers WHERE id = ?", args: [id] },
  ]);
}
