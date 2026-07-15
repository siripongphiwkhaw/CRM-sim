import { db } from "../client";

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
}): ContactWithCompany[] {
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

  return db
    .prepare(
      `SELECT c.*, co.name as company_name
       FROM contacts c
       LEFT JOIN companies co ON co.id = c.company_id
       ${where}
       ORDER BY c.last_name, c.first_name`
    )
    .all(...params) as ContactWithCompany[];
}

export function getContact(id: number): ContactWithCompany | undefined {
  return db
    .prepare(
      `SELECT c.*, co.name as company_name
       FROM contacts c
       LEFT JOIN companies co ON co.id = c.company_id
       WHERE c.id = ?`
    )
    .get(id) as ContactWithCompany | undefined;
}

export function createContact(input: ContactInput): number {
  const result = db
    .prepare(
      `INSERT INTO contacts (first_name, last_name, email, phone, title, company_id, notes)
       VALUES (@first_name, @last_name, @email, @phone, @title, @company_id, @notes)`
    )
    .run({
      first_name: input.first_name,
      last_name: input.last_name,
      email: input.email ?? null,
      phone: input.phone ?? null,
      title: input.title ?? null,
      company_id: input.company_id ?? null,
      notes: input.notes ?? null,
    });
  return Number(result.lastInsertRowid);
}

export function updateContact(id: number, input: ContactInput): void {
  db.prepare(
    `UPDATE contacts SET first_name = @first_name, last_name = @last_name,
       email = @email, phone = @phone, title = @title, company_id = @company_id,
       notes = @notes, updated_at = datetime('now')
     WHERE id = @id`
  ).run({
    id,
    first_name: input.first_name,
    last_name: input.last_name,
    email: input.email ?? null,
    phone: input.phone ?? null,
    title: input.title ?? null,
    company_id: input.company_id ?? null,
    notes: input.notes ?? null,
  });
}

export function deleteContact(id: number): void {
  db.prepare("DELETE FROM contacts WHERE id = ?").run(id);
}

export function searchContacts(query: string, limit = 10): Contact[] {
  return db
    .prepare(
      `SELECT * FROM contacts
       WHERE first_name LIKE ? OR last_name LIKE ? OR email LIKE ?
       ORDER BY last_name, first_name LIMIT ?`
    )
    .all(`%${query}%`, `%${query}%`, `%${query}%`, limit) as Contact[];
}
