import { get, all, run } from "../client";
import { customersFor, scopedCustomerIds, type ReadScope } from "@/lib/customerScope";
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
  department_id: number | null;
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
  department_name: string | null;
}

const SORT_COLUMNS: Record<string, string> = {
  case: "cs.case_number",
  priority: "cs.priority",
  status: "cs.status",
  created: "cs.created_at",
};

// A case about an out-of-scope member disappears entirely (the WHERE clause in
// caseSelect drops it); a case with no member attached still shows.
const caseSelect = (scope: ReadScope) => `
  SELECT cs.*,
    (c.first_name || ' ' || c.last_name) AS member_name,
    c.member_code AS member_code,
    u.name AS assignee_name,
    d.name AS department_name
  FROM cases cs
  LEFT JOIN ${customersFor(scope)} c ON c.id = cs.customer_id
  LEFT JOIN users u ON u.id = cs.assigned_to
  LEFT JOIN departments d ON d.id = cs.department_id
  WHERE (cs.customer_id IS NULL OR c.id IS NOT NULL)`;

export function listCases(
  scope: ReadScope,
  opts?: {
    status?: string;
    priority?: string;
    customerId?: number;
    departmentId?: number;
    search?: string;
    sort?: string;
    dir?: string;
  }
): Promise<CaseWithNames[]> {
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
  if (opts?.departmentId) {
    clauses.push("cs.department_id = ?");
    params.push(opts.departmentId);
  }
  if (opts?.search) {
    clauses.push("(cs.subject LIKE ? OR cs.case_number LIKE ?)");
    params.push(`%${opts.search}%`, `%${opts.search}%`);
  }
  // caseSelect already opens WHERE (...) — extra filters are AND-appended.
  const where = clauses.length ? `AND ${clauses.join(" AND ")}` : "";
  const column = SORT_COLUMNS[opts?.sort ?? ""] ?? "cs.created_at";
  const dir = opts?.dir === "asc" ? "ASC" : "DESC";
  return all<CaseWithNames>(
    `${caseSelect(scope)} ${where} ORDER BY ${column} ${dir}`,
    params
  );
}

export function getCase(
  scope: ReadScope,
  id: number
): Promise<CaseWithNames | undefined> {
  return get<CaseWithNames>(`${caseSelect(scope)} AND cs.id = ?`, [id]);
}

export interface CaseInput {
  customer_id?: number | null;
  subject: string;
  description?: string | null;
  category?: CaseCategory | null;
  priority?: CasePriority;
  created_by?: number | null;
  department_id?: number | null;
}

export async function createCase(input: CaseInput): Promise<number> {
  const next = await get<{ n: number }>("SELECT COALESCE(MAX(id),0)+1 AS n FROM cases");
  const caseNumber = `CASE-${String(next?.n ?? 1).padStart(5, "0")}`;
  return run(
    `INSERT INTO cases (case_number, customer_id, subject, description, category, priority, created_by, department_id)
     VALUES (@num, @cid, @subject, @desc, @cat, @prio, @actor, @dept) RETURNING id`,
    {
      num: caseNumber,
      cid: input.customer_id ?? null,
      subject: input.subject,
      desc: input.description ?? null,
      cat: input.category ?? null,
      prio: input.priority ?? "MEDIUM",
      actor: input.created_by ?? null,
      dept: input.department_id ?? null,
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
      ? "resolved_at = COALESCE(resolved_at, now()::text),"
      : "resolved_at = NULL,";
  return run(
    `UPDATE cases SET status = @status, ${resolvedClause}
       resolution = COALESCE(@resolution, resolution), updated_at = now()
     WHERE id = @id`,
    { id, status, resolution: resolution ?? null }
  );
}

export function assignCase(id: number, userId: number | null): Promise<number> {
  return run(
    "UPDATE cases SET assigned_to = ?, updated_at = now() WHERE id = ?",
    [userId, id]
  );
}

export function getCaseCounts(
  scope: ReadScope
): Promise<{ status: CaseStatus; count: number }[]> {
  return all<{ status: CaseStatus; count: number }>(
    `SELECT status, COUNT(*) AS count FROM cases
     WHERE (customer_id IS NULL OR ${scopedCustomerIds(scope)})
     GROUP BY status`
  );
}
