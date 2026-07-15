import { db } from "../client";
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
}): TaskWithRelations[] {
  const clauses: string[] = [];
  const params: unknown[] = [];

  if (opts?.completed !== undefined) {
    clauses.push("t.completed = ?");
    params.push(opts.completed ? 1 : 0);
  }
  if (opts?.overdueOnly) {
    clauses.push("t.completed = 0 AND t.due_date IS NOT NULL AND t.due_date < datetime('now')");
  }

  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";

  return db
    .prepare(
      `SELECT t.*,
         (ct.first_name || ' ' || ct.last_name) as contact_name,
         d.title as deal_title
       FROM tasks t
       LEFT JOIN contacts ct ON ct.id = t.contact_id
       LEFT JOIN deals d ON d.id = t.deal_id
       ${where}
       ORDER BY (t.due_date IS NULL), t.due_date ASC`
    )
    .all(...params) as TaskWithRelations[];
}

export function getTask(id: number): Task | undefined {
  return db.prepare("SELECT * FROM tasks WHERE id = ?").get(id) as
    | Task
    | undefined;
}

export function listTasksByContact(contactId: number): Task[] {
  return db
    .prepare("SELECT * FROM tasks WHERE contact_id = ? ORDER BY due_date, created_at DESC")
    .all(contactId) as Task[];
}

export function listTasksByDeal(dealId: number): Task[] {
  return db
    .prepare("SELECT * FROM tasks WHERE deal_id = ? ORDER BY due_date, created_at DESC")
    .all(dealId) as Task[];
}

export function createTask(input: TaskInput): number {
  const result = db
    .prepare(
      `INSERT INTO tasks (type, subject, description, due_date, contact_id, deal_id, owner_id)
       VALUES (@type, @subject, @description, @due_date, @contact_id, @deal_id, @owner_id)`
    )
    .run({
      type: input.type,
      subject: input.subject,
      description: input.description ?? null,
      due_date: input.due_date ?? null,
      contact_id: input.contact_id ?? null,
      deal_id: input.deal_id ?? null,
      owner_id: input.owner_id ?? null,
    });
  return Number(result.lastInsertRowid);
}

export function updateTask(id: number, input: TaskInput): void {
  db.prepare(
    `UPDATE tasks SET type = @type, subject = @subject, description = @description,
       due_date = @due_date, contact_id = @contact_id, deal_id = @deal_id, owner_id = @owner_id
     WHERE id = @id`
  ).run({
    id,
    type: input.type,
    subject: input.subject,
    description: input.description ?? null,
    due_date: input.due_date ?? null,
    contact_id: input.contact_id ?? null,
    deal_id: input.deal_id ?? null,
    owner_id: input.owner_id ?? null,
  });
}

export function toggleTaskComplete(id: number): void {
  const task = db.prepare("SELECT completed FROM tasks WHERE id = ?").get(id) as
    | { completed: number }
    | undefined;
  if (!task) return;
  const nowComplete = task.completed ? 0 : 1;
  db.prepare(
    `UPDATE tasks SET completed = ?, completed_at = ? WHERE id = ?`
  ).run(nowComplete, nowComplete ? new Date().toISOString() : null, id);
}

export function deleteTask(id: number): void {
  db.prepare("DELETE FROM tasks WHERE id = ?").run(id);
}
