import { get, all, run, batch } from "../client";

export interface Company {
  id: number;
  name: string;
  industry: string | null;
  website: string | null;
  phone: string | null;
  address: string | null;
  created_at: string;
}

export interface CompanyWithCounts extends Company {
  contact_count: number;
  deal_count: number;
}

export interface CompanyInput {
  name: string;
  industry?: string | null;
  website?: string | null;
  phone?: string | null;
  address?: string | null;
}

export function listCompanies(search?: string): Promise<Company[]> {
  if (search) {
    return all<Company>(
      "SELECT * FROM companies WHERE name LIKE ? ORDER BY name",
      [`%${search}%`]
    );
  }
  return all<Company>("SELECT * FROM companies ORDER BY name");
}

export function listCompaniesWithCounts(
  search?: string
): Promise<CompanyWithCounts[]> {
  const where = search ? "WHERE co.name LIKE ?" : "";
  const args = search ? [`%${search}%`] : [];
  return all<CompanyWithCounts>(
    `SELECT co.*,
       (SELECT COUNT(*) FROM contacts ct WHERE ct.company_id = co.id) as contact_count,
       (SELECT COUNT(*) FROM deals d WHERE d.company_id = co.id) as deal_count
     FROM companies co
     ${where}
     ORDER BY co.name`,
    args
  );
}

export function getCompany(id: number): Promise<Company | undefined> {
  return get<Company>("SELECT * FROM companies WHERE id = ?", [id]);
}

export async function createCompany(input: CompanyInput): Promise<number> {
  const rowid = await run(
    `INSERT INTO companies (name, industry, website, phone, address)
     VALUES (@name, @industry, @website, @phone, @address)`,
    {
      name: input.name,
      industry: input.industry ?? null,
      website: input.website ?? null,
      phone: input.phone ?? null,
      address: input.address ?? null,
    }
  );
  return Number(rowid);
}

export async function updateCompany(
  id: number,
  input: CompanyInput
): Promise<void> {
  await run(
    `UPDATE companies SET name = @name, industry = @industry, website = @website,
       phone = @phone, address = @address WHERE id = @id`,
    {
      id,
      name: input.name,
      industry: input.industry ?? null,
      website: input.website ?? null,
      phone: input.phone ?? null,
      address: input.address ?? null,
    }
  );
}

/** Mirrors the schema's ON DELETE SET NULL for contacts/deals, atomically. */
export async function deleteCompany(id: number): Promise<void> {
  await batch([
    { sql: "UPDATE contacts SET company_id = NULL WHERE company_id = ?", args: [id] },
    { sql: "UPDATE deals SET company_id = NULL WHERE company_id = ?", args: [id] },
    { sql: "DELETE FROM companies WHERE id = ?", args: [id] },
  ]);
}

export function searchCompanies(query: string, limit = 10): Promise<Company[]> {
  return all<Company>(
    "SELECT * FROM companies WHERE name LIKE ? ORDER BY name LIMIT ?",
    [`%${query}%`, limit]
  );
}
