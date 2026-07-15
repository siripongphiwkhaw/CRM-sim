import { get, all, run } from "../client";
import type { TaskType } from "@/lib/constants";

export interface Task {
  id: number;
  type: TaskType;
  subject: string;
  description: string | null;
  due_date: string | null;
  completed: number;
  completed_at: string | null;
  contact_id: number | null;
  deal_id: number | null;
  owner_id: number | null;
  created_at: string;
}

export interface TaskWithRelations extends Task {
  contact_name: string | null;
  deal_title: string | null;
}

export interface TaskInput {
  type: TaskType;
  subject: string;
  description?: string | null;
  due_date?: string | null;
  contact_id?: number | null;
  deal_id?: number | null;
  owner_id?: number | null;
}

export function listTasks(opts?: {
  completed?: boolean;
  overdueOnly?: boolean;
}): Promise<TaskWithRelations[]> {
  const clauses: string[] = [];
  const params: (string | number)[] = [];

  if (opts?.completed !== undefined) {
    clauses.push("t.completed = ?");
    params.push(opts.completed ? 1 : 0);
  }
  if (opts?.overdueOnly) {
    clauses.push(
      "t.completed = 0 AND t.due_date IS NOT NULL AND t.due_date < datetime('now')"
    );
  }

  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";

  return all<TaskWithRelations>(
    `SELECT t.*,
       (ct.first_name || ' ' || ct.last_name) as contact_name,
       d.title as deal_title
     FROM tasks t
     LEFT JOIN contacts ct ON ct.id = t.contact_id
     LEFT JOIN deals d ON d.id = t.deal_id
     ${where}
     ORDER BY (t.due_date IS NULL), t.due_date ASC`,
    params
  );
}

export function getTask(id: number): Promise<Task | undefined> {
  return get<Task>("SELECT * FROM tasks WHERE id = ?", [id]);
}

export function listTasksByContact(contactId: number): Promise<Task[]> {
  return all<Task>(
    "SELECT * FROM tasks WHERE contact_id = ? ORDER BY due_date, created_at DESC",
    [contactId]
  );
}

export function listTasksByDeal(dealId: number): Promise<Task[]> {
  return all<Task>(
    "SELECT * FROM tasks WHERE deal_id = ? ORDER BY due_date, created_at DESC",
    [dealId]
  );
}

export async function createTask(input: TaskInput): Promise<number> {
  const rowid = await run(
    `INSERT INTO tasks (type, subject, description, due_date, contact_id, deal_id, owner_id)
     VALUES (@type, @subject, @description, @due_date, @contact_id, @deal_id, @owner_id)`,
    {
      type: input.type,
      subject: input.subject,
      description: input.description ?? null,
      due_date: input.due_date ?? null,
      contact_id: input.contact_id ?? null,
      deal_id: input.deal_id ?? null,
      owner_id: input.owner_id ?? null,
    }
  );
  return Number(rowid);
}

export async function updateTask(id: number, input: TaskInput): Promise<void> {
  await run(
    `UPDATE tasks SET type = @type, subject = @subject, description = @description,
       due_date = @due_date, contact_id = @contact_id, deal_id = @deal_id, owner_id = @owner_id
     WHERE id = @id`,
    {
      id,
      type: input.type,
      subject: input.subject,
      description: input.description ?? null,
      due_date: input.due_date ?? null,
      contact_id: input.contact_id ?? null,
      deal_id: input.deal_id ?? null,
      owner_id: input.owner_id ?? null,
    }
  );
}

/** Toggle completion atomically in a single statement. */
export async function toggleTaskComplete(id: number): Promise<void> {
  await run(
    `UPDATE tasks
       SET completed = CASE WHEN completed = 1 THEN 0 ELSE 1 END,
           completed_at = CASE WHEN completed = 1 THEN NULL ELSE datetime('now') END
     WHERE id = ?`,
    [id]
  );
}

export async function deleteTask(id: number): Promise<void> {
  await run("DELETE FROM tasks WHERE id = ?", [id]);
}
