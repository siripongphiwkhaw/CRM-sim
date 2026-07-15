import { get, all } from "../client";
import { DEAL_STAGES, type DealStage } from "@/lib/constants";

export interface DealsByStage {
  stage: DealStage;
  count: number;
  value: number;
}

export async function getDealsByStage(): Promise<DealsByStage[]> {
  const rows = await all<{ stage: DealStage; count: number; value: number }>(
    `SELECT stage, COUNT(*) as count, COALESCE(SUM(value), 0) as value FROM deals GROUP BY stage`
  );

  const byStage = new Map(rows.map((r) => [r.stage, r]));
  return DEAL_STAGES.map(
    (stage) => byStage.get(stage) ?? { stage, count: 0, value: 0 }
  );
}

export async function getOpenPipelineValue(): Promise<number> {
  const row = await get<{ total: number }>(
    `SELECT COALESCE(SUM(value), 0) as total FROM deals WHERE stage NOT IN ('Won', 'Lost')`
  );
  return row?.total ?? 0;
}

export async function getWonValue(): Promise<number> {
  const row = await get<{ total: number }>(
    `SELECT COALESCE(SUM(value), 0) as total FROM deals WHERE stage = 'Won'`
  );
  return row?.total ?? 0;
}

export async function getUpcomingTaskCount(): Promise<number> {
  const row = await get<{ count: number }>(
    `SELECT COUNT(*) as count FROM tasks WHERE completed = 0 AND due_date IS NOT NULL AND due_date >= datetime('now')`
  );
  return row?.count ?? 0;
}

export async function getOverdueTaskCount(): Promise<number> {
  const row = await get<{ count: number }>(
    `SELECT COUNT(*) as count FROM tasks WHERE completed = 0 AND due_date IS NOT NULL AND due_date < datetime('now')`
  );
  return row?.count ?? 0;
}

export interface RecentActivity {
  id: number;
  type: string;
  subject: string;
  created_at: string;
  contact_name: string | null;
  deal_title: string | null;
}

export function getRecentActivity(limit = 10): Promise<RecentActivity[]> {
  return all<RecentActivity>(
    `SELECT t.id, t.type, t.subject, t.created_at,
       (ct.first_name || ' ' || ct.last_name) as contact_name,
       d.title as deal_title
     FROM tasks t
     LEFT JOIN contacts ct ON ct.id = t.contact_id
     LEFT JOIN deals d ON d.id = t.deal_id
     ORDER BY t.created_at DESC
     LIMIT ?`,
    [limit]
  );
}

export async function getCounts(): Promise<{
  contacts: number;
  companies: number;
  deals: number;
}> {
  const contacts = await get<{ count: number }>(
    "SELECT COUNT(*) as count FROM contacts"
  );
  const companies = await get<{ count: number }>(
    "SELECT COUNT(*) as count FROM companies"
  );
  const deals = await get<{ count: number }>(
    "SELECT COUNT(*) as count FROM deals"
  );
  return {
    contacts: contacts?.count ?? 0,
    companies: companies?.count ?? 0,
    deals: deals?.count ?? 0,
  };
}
