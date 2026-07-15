import { db } from "../client";

export interface Company {
  id: number;
  name: string;
  industry: string | null;
  website: string | null;
  phone: string | null;
  address: string | null;
  created_at: string;
}

export interface CompanyInput {
  name: string;
  industry?: string | null;
  website?: string | null;
  phone?: string | null;
  address?: string | null;
}

export interface CompanyWithCounts extends Company {
  contact_count: number;
  deal_count: number;
}

export function listCompanies(search?: string): Company[] {
  if (search) {
    return db
      .prepare("SELECT * FROM companies WHERE name LIKE ? ORDER BY name")
      .all(`%${search}%`) as Company[];
  }
  return db.prepare("SELECT * FROM companies ORDER BY name").all() as Company[];
}

export function listCompaniesWithCounts(search?: string): CompanyWithCounts[] {
  const where = search ? "WHERE co.name LIKE ?" : "";
  const params = search ? [`%${search}%`] : [];
  return db
    .prepare(
      `SELECT co.*,
         (SELECT COUNT(*) FROM contacts ct WHERE ct.company_id = co.id) as contact_count,
         (SELECT COUNT(*) FROM deals d WHERE d.company_id = co.id) as deal_count
       FROM companies co
       ${where}
       ORDER BY co.name`
    )
    .all(...params) as CompanyWithCounts[];
}

export function getCompany(id: number): Company | undefined {
  return db.prepare("SELECT * FROM companies WHERE id = ?").get(id) as
    | Company
    | undefined;
}

export function createCompany(input: CompanyInput): number {
  const result = db
    .prepare(
      `INSERT INTO companies (name, industry, website, phone, address)
       VALUES (@name, @industry, @website, @phone, @address)`
    )
    .run({
      name: input.name,
      industry: input.industry ?? null,
      website: input.website ?? null,
      phone: input.phone ?? null,
      address: input.address ?? null,
    });
  return Number(result.lastInsertRowid);
}

export function updateCompany(id: number, input: CompanyInput): void {
  db.prepare(
    `UPDATE companies SET name = @name, industry = @industry, website = @website,
       phone = @phone, address = @address WHERE id = @id`
  ).run({
    id,
    name: input.name,
    industry: input.industry ?? null,
    website: input.website ?? null,
    phone: input.phone ?? null,
    address: input.address ?? null,
  });
}

export function deleteCompany(id: number): void {
  db.prepare("DELETE FROM companies WHERE id = ?").run(id);
}

export function searchCompanies(query: string, limit = 10): Company[] {
  return db
    .prepare("SELECT * FROM companies WHERE name LIKE ? ORDER BY name LIMIT ?")
    .all(`%${query}%`, limit) as Company[];
}
