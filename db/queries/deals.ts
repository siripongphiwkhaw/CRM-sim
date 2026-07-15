import { get, all, run, batch } from "../client";
import type { DealStage } from "@/lib/constants";

export interface Deal {
  id: number;
  title: string;
  value: number;
  stage: DealStage;
  contact_id: number | null;
  company_id: number | null;
  owner_id: number | null;
  expected_close_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface DealWithRelations extends Deal {
  contact_name: string | null;
  company_name: string | null;
  owner_name: string | null;
}

export interface DealInput {
  title: string;
  value: number;
  stage: DealStage;
  contact_id?: number | null;
  company_id?: number | null;
  owner_id?: number | null;
  expected_close_date?: string | null;
}

const WITH_RELATIONS = `SELECT d.*,
    (ct.first_name || ' ' || ct.last_name) as contact_name,
    co.name as company_name,
    u.name as owner_name
  FROM deals d
  LEFT JOIN contacts ct ON ct.id = d.contact_id
  LEFT JOIN companies co ON co.id = d.company_id
  LEFT JOIN users u ON u.id = d.owner_id`;

export function listDeals(): Promise<DealWithRelations[]> {
  return all<DealWithRelations>(`${WITH_RELATIONS} ORDER BY d.created_at DESC`);
}

export function getDeal(id: number): Promise<DealWithRelations | undefined> {
  return get<DealWithRelations>(`${WITH_RELATIONS} WHERE d.id = ?`, [id]);
}

export function listDealsByContact(contactId: number): Promise<Deal[]> {
  return all<Deal>(
    "SELECT * FROM deals WHERE contact_id = ? ORDER BY created_at DESC",
    [contactId]
  );
}

export function listDealsByCompany(companyId: number): Promise<Deal[]> {
  return all<Deal>(
    "SELECT * FROM deals WHERE company_id = ? ORDER BY created_at DESC",
    [companyId]
  );
}

export async function createDeal(input: DealInput): Promise<number> {
  const rowid = await run(
    `INSERT INTO deals (title, value, stage, contact_id, company_id, owner_id, expected_close_date)
     VALUES (@title, @value, @stage, @contact_id, @company_id, @owner_id, @expected_close_date)`,
    {
      title: input.title,
      value: input.value,
      stage: input.stage,
      contact_id: input.contact_id ?? null,
      company_id: input.company_id ?? null,
      owner_id: input.owner_id ?? null,
      expected_close_date: input.expected_close_date ?? null,
    }
  );
  return Number(rowid);
}

export async function updateDeal(id: number, input: DealInput): Promise<void> {
  await run(
    `UPDATE deals SET title = @title, value = @value, stage = @stage,
       contact_id = @contact_id, company_id = @company_id, owner_id = @owner_id,
       expected_close_date = @expected_close_date, updated_at = datetime('now')
     WHERE id = @id`,
    {
      id,
      title: input.title,
      value: input.value,
      stage: input.stage,
      contact_id: input.contact_id ?? null,
      company_id: input.company_id ?? null,
      owner_id: input.owner_id ?? null,
      expected_close_date: input.expected_close_date ?? null,
    }
  );
}

export async function moveDealStage(
  id: number,
  stage: DealStage
): Promise<void> {
  await run(
    "UPDATE deals SET stage = ?, updated_at = datetime('now') WHERE id = ?",
    [stage, id]
  );
}

/** Mirrors tasks ON DELETE CASCADE, atomically. */
export async function deleteDeal(id: number): Promise<void> {
  await batch([
    { sql: "DELETE FROM tasks WHERE deal_id = ?", args: [id] },
    { sql: "DELETE FROM deals WHERE id = ?", args: [id] },
  ]);
}
