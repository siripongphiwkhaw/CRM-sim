import { db } from "../client";
import { DEAL_STAGES, type DealStage } from "@/lib/constants";

export interface DealsByStage {
  stage: DealStage;
  count: number;
  value: number;
}

export function getDealsByStage(): DealsByStage[] {
  const rows = db
    .prepare(`SELECT stage, COUNT(*) as count, COALESCE(SUM(value), 0) as value FROM deals GROUP BY stage`)
    .all() as { stage: DealStage; count: number; value: number }[];

  const byStage = new Map(rows.map((r) => [r.stage, r]));
  return DEAL_STAGES.map(
    (stage) => byStage.get(stage) ?? { stage, count: 0, value: 0 }
  );
}

export function getOpenPipelineValue(): number {
  const row = db
    .prepare(
      `SELECT COALESCE(SUM(value), 0) as total FROM deals WHERE stage NOT IN ('Won', 'Lost')`
    )
    .get() as { total: number };
  return row.total;
}

export function getWonValue(): number {
  const row = db
    .prepare(`SELECT COALESCE(SUM(value), 0) as total FROM deals WHERE stage = 'Won'`)
    .get() as { total: number };
  return row.total;
}

export function getUpcomingTaskCount(): number {
  const row = db
    .prepare(
      `SELECT COUNT(*) as count FROM tasks WHERE completed = 0 AND due_date IS NOT NULL AND due_date >= datetime('now')`
    )
    .get() as { count: number };
  return row.count;
}

export function getOverdueTaskCount(): number {
  const row = db
    .prepare(
      `SELECT COUNT(*) as count FROM tasks WHERE completed = 0 AND due_date IS NOT NULL AND due_date < datetime('now')`
    )
    .get() as { count: number };
  return row.count;
}

export interface RecentActivity {
  id: number;
  type: string;
  subject: string;
  created_at: string;
  contact_name: string | null;
  deal_title: string | null;
}

export function getRecentActivity(limit = 10): RecentActivity[] {
  return db
    .prepare(
      `SELECT t.id, t.type, t.subject, t.created_at,
         (ct.first_name || ' ' || ct.last_name) as contact_name,
         d.title as deal_title
       FROM tasks t
       LEFT JOIN contacts ct ON ct.id = t.contact_id
       LEFT JOIN deals d ON d.id = t.deal_id
       ORDER BY t.created_at DESC
       LIMIT ?`
    )
    .all(limit) as RecentActivity[];
}

export function getCounts() {
  const contacts = db.prepare("SELECT COUNT(*) as count FROM contacts").get() as {
    count: number;
  };
  const companies = db.prepare("SELECT COUNT(*) as count FROM companies").get() as {
    count: number;
  };
  const deals = db.prepare("SELECT COUNT(*) as count FROM deals").get() as {
    count: number;
  };
  return {
    contacts: contacts.count,
    companies: companies.count,
    deals: deals.count,
  };
}
