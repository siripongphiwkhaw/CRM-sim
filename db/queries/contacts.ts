import { get, all, run, batch } from "../client";

export interface Contact {
  id: number;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  title: string | null;
  company_id: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ContactWithCompany extends Contact {
  company_name: string | null;
}

export interface ContactInput {
  first_name: string;
  last_name: string;
  email?: string | null;
  phone?: string | null;
  title?: string | null;
  company_id?: number | null;
  notes?: string | null;
}

export function listContacts(opts?: {
  search?: string;
  companyId?: number;
}): Promise<ContactWithCompany[]> {
  const clauses: string[] = [];
  const params: unknown[] = [];

  if (opts?.search) {
    clauses.push(
      "(c.first_name LIKE ? OR c.last_name LIKE ? OR c.email LIKE ?)"
    );
    params.push(`%${opts.search}%`, `%${opts.search}%`, `%${opts.search}%`);
  }
  if (opts?.companyId) {
    clauses.push("c.company_id = ?");
    params.push(opts.companyId);
  }

  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";

  return all<ContactWithCompany>(
    `SELECT c.*, co.name as company_name
     FROM contacts c
     LEFT JOIN companies co ON co.id = c.company_id
     ${where}
     ORDER BY c.last_name, c.first_name`,
    params as (string | number)[]
  );
}

export function getContact(
  id: number
): Promise<ContactWithCompany | undefined> {
  return get<ContactWithCompany>(
    `SELECT c.*, co.name as company_name
     FROM contacts c
     LEFT JOIN companies co ON co.id = c.company_id
     WHERE c.id = ?`,
    [id]
  );
}

export async function createContact(input: ContactInput): Promise<number> {
  const rowid = await run(
    `INSERT INTO contacts (first_name, last_name, email, phone, title, company_id, notes)
     VALUES (@first_name, @last_name, @email, @phone, @title, @company_id, @notes)`,
    {
      first_name: input.first_name,
      last_name: input.last_name,
      email: input.email ?? null,
      phone: input.phone ?? null,
      title: input.title ?? null,
      company_id: input.company_id ?? null,
      notes: input.notes ?? null,
    }
  );
  return Number(rowid);
}

export async function updateContact(
  id: number,
  input: ContactInput
): Promise<void> {
  await run(
    `UPDATE contacts SET first_name = @first_name, last_name = @last_name,
       email = @email, phone = @phone, title = @title, company_id = @company_id,
       notes = @notes, updated_at = datetime('now')
     WHERE id = @id`,
    {
      id,
      first_name: input.first_name,
      last_name: input.last_name,
      email: input.email ?? null,
      phone: input.phone ?? null,
      title: input.title ?? null,
      company_id: input.company_id ?? null,
      notes: input.notes ?? null,
    }
  );
}

/** Mirrors deals ON DELETE SET NULL + tasks ON DELETE CASCADE, atomically. */
export async function deleteContact(id: number): Promise<void> {
  await batch([
    { sql: "UPDATE deals SET contact_id = NULL WHERE contact_id = ?", args: [id] },
    { sql: "DELETE FROM tasks WHERE contact_id = ?", args: [id] },
    { sql: "DELETE FROM contacts WHERE id = ?", args: [id] },
  ]);
}

export function searchContacts(query: string, limit = 10): Promise<Contact[]> {
  return all<Contact>(
    `SELECT * FROM contacts
     WHERE first_name LIKE ? OR last_name LIKE ? OR email LIKE ?
     ORDER BY last_name, first_name LIMIT ?`,
    [`%${query}%`, `%${query}%`, `%${query}%`, limit]
  );
}
