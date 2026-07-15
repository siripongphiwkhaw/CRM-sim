import { db } from "../client";
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

export function listDeals(): DealWithRelations[] {
  return db
    .prepare(
      `SELECT d.*,
         (ct.first_name || ' ' || ct.last_name) as contact_name,
         co.name as company_name,
         u.name as owner_name
       FROM deals d
       LEFT JOIN contacts ct ON ct.id = d.contact_id
       LEFT JOIN companies co ON co.id = d.company_id
       LEFT JOIN users u ON u.id = d.owner_id
       ORDER BY d.created_at DESC`
    )
    .all() as DealWithRelations[];
}

export function getDeal(id: number): DealWithRelations | undefined {
  return db
    .prepare(
      `SELECT d.*,
         (ct.first_name || ' ' || ct.last_name) as contact_name,
         co.name as company_name,
         u.name as owner_name
       FROM deals d
       LEFT JOIN contacts ct ON ct.id = d.contact_id
       LEFT JOIN companies co ON co.id = d.company_id
       LEFT JOIN users u ON u.id = d.owner_id
       WHERE d.id = ?`
    )
    .get(id) as DealWithRelations | undefined;
}

export function listDealsByContact(contactId: number): Deal[] {
  return db
    .prepare("SELECT * FROM deals WHERE contact_id = ? ORDER BY created_at DESC")
    .all(contactId) as Deal[];
}

export function listDealsByCompany(companyId: number): Deal[] {
  return db
    .prepare("SELECT * FROM deals WHERE company_id = ? ORDER BY created_at DESC")
    .all(companyId) as Deal[];
}

export function createDeal(input: DealInput): number {
  const result = db
    .prepare(
      `INSERT INTO deals (title, value, stage, contact_id, company_id, owner_id, expected_close_date)
       VALUES (@title, @value, @stage, @contact_id, @company_id, @owner_id, @expected_close_date)`
    )
    .run({
      title: input.title,
      value: input.value,
      stage: input.stage,
      contact_id: input.contact_id ?? null,
      company_id: input.company_id ?? null,
      owner_id: input.owner_id ?? null,
      expected_close_date: input.expected_close_date ?? null,
    });
  return Number(result.lastInsertRowid);
}

export function updateDeal(id: number, input: DealInput): void {
  db.prepare(
    `UPDATE deals SET title = @title, value = @value, stage = @stage,
       contact_id = @contact_id, company_id = @company_id, owner_id = @owner_id,
       expected_close_date = @expected_close_date, updated_at = datetime('now')
     WHERE id = @id`
  ).run({
    id,
    title: input.title,
    value: input.value,
    stage: input.stage,
    contact_id: input.contact_id ?? null,
    company_id: input.company_id ?? null,
    owner_id: input.owner_id ?? null,
    expected_close_date: input.expected_close_date ?? null,
  });
}

export function moveDealStage(id: number, stage: DealStage): void {
  db.prepare(
    `UPDATE deals SET stage = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(stage, id);
}

export function deleteDeal(id: number): void {
  db.prepare("DELETE FROM deals WHERE id = ?").run(id);
}
