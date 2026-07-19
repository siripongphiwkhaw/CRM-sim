import { get, all, run } from "../client";
import type { CaseCategory, CasePriority, CaseStatus } from "@/lib/constants";

export interface CaseRow {
  id: number;
  case_number: string;
  customer_id: number | null;
  subject: string;
  description: string | null;
  category: CaseCategory | null;
  priority: CasePriority;
  status: CaseStatus;
  assigned_to: number | null;
  resolution: string | null;
  created_by: number | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
}

export interface CaseWithNames extends CaseRow {
  member_name: string | null;
  member_code: string | null;
  assignee_name: string | null;
}

const SORT_COLUMNS: Record<string, string> = {
  case: "cs.case_number",
  priority: "cs.priority",
  status: "cs.status",
  created: "cs.created_at",
};

const CASE_SELECT = `
  SELECT cs.*,
    (c.first_name || ' ' || c.last_name) AS member_name,
    c.member_code AS member_code,
    u.name AS assignee_name
  FROM cases cs
  LEFT JOIN customers c ON c.id = cs.customer_id
  LEFT JOIN users u ON u.id = cs.assigned_to`;

export function listCases(opts?: {
  status?: string;
  priority?: string;
  customerId?: number;
  search?: string;
  sort?: string;
  dir?: string;
}): Promise<CaseWithNames[]> {
  const clauses: string[] = [];
  const params: (string | number)[] = [];
  if (opts?.status) {
    clauses.push("cs.status = ?");
    params.push(opts.status);
  }
  if (opts?.priority) {
    clauses.push("cs.priority = ?");
    params.push(opts.priority);
  }
  if (opts?.customerId) {
    clauses.push("cs.customer_id = ?");
    params.push(opts.customerId);
  }
  if (opts?.search) {
    clauses.push("(cs.subject LIKE ? OR cs.case_number LIKE ?)");
    params.push(`%${opts.search}%`, `%${opts.search}%`);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const column = SORT_COLUMNS[opts?.sort ?? ""] ?? "cs.created_at";
  const dir = opts?.dir === "asc" ? "ASC" : "DESC";
  return all<CaseWithNames>(`${CASE_SELECT} ${where} ORDER BY ${column} ${dir}`, params);
}

export function getCase(id: number): Promise<CaseWithNames | undefined> {
  return get<CaseWithNames>(`${CASE_SELECT} WHERE cs.id = ?`, [id]);
}

export interface CaseInput {
  customer_id?: number | null;
  subject: string;
  description?: string | null;
  category?: CaseCategory | null;
  priority?: CasePriority;
  created_by?: number | null;
}

export async function createCase(input: CaseInput): Promise<number> {
  const next = await get<{ n: number }>("SELECT COALESCE(MAX(id),0)+1 AS n FROM cases");
  const caseNumber = `CASE-${String(next?.n ?? 1).padStart(5, "0")}`;
  return run(
    `INSERT INTO cases (case_number, customer_id, subject, description, category, priority, created_by)
     VALUES (@num, @cid, @subject, @desc, @cat, @prio, @actor)`,
    {
      num: caseNumber,
      cid: input.customer_id ?? null,
      subject: input.subject,
      desc: input.description ?? null,
      cat: input.category ?? null,
      prio: input.priority ?? "MEDIUM",
      actor: input.created_by ?? null,
    }
  );
}

export function updateCaseStatus(
  id: number,
  status: CaseStatus,
  resolution?: string | null
): Promise<number> {
  const resolvedClause =
    status === "RESOLVED" || status === "CLOSED"
      ? "resolved_at = COALESCE(resolved_at, datetime('now')),"
      : "resolved_at = NULL,";
  return run(
    `UPDATE cases SET status = @status, ${resolvedClause}
       resolution = COALESCE(@resolution, resolution), updated_at = datetime('now')
     WHERE id = @id`,
    { id, status, resolution: resolution ?? null }
  );
}

export function assignCase(id: number, userId: number | null): Promise<number> {
  return run(
    "UPDATE cases SET assigned_to = ?, updated_at = datetime('now') WHERE id = ?",
    [userId, id]
  );
}

export function getCaseCounts(): Promise<{ status: CaseStatus; count: number }[]> {
  return all<{ status: CaseStatus; count: number }>(
    "SELECT status, COUNT(*) AS count FROM cases GROUP BY status"
  );
}
