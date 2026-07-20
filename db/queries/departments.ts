import { get, all, run } from "../client";
import type { ModuleKey } from "@/lib/constants";

export interface Department {
  id: number;
  name: string;
  description: string | null;
  is_approver: number;
  created_at: string;
  updated_at: string;
}

export interface DepartmentWithPics extends Department {
  pic_count: number;
  pic_names: string | null;
}

export interface PicUser {
  id: number;
  name: string;
  email: string;
}

export function listDepartments(): Promise<DepartmentWithPics[]> {
  return all<DepartmentWithPics>(
    `SELECT d.*,
       COUNT(dp.user_id) AS pic_count,
       GROUP_CONCAT(u.name, ', ') AS pic_names
     FROM departments d
     LEFT JOIN department_pics dp ON dp.department_id = d.id
     LEFT JOIN users u ON u.id = dp.user_id
     GROUP BY d.id
     ORDER BY d.name`
  );
}

export function getDepartment(id: number): Promise<Department | undefined> {
  return get<Department>("SELECT * FROM departments WHERE id = ?", [id]);
}

/** Departments where the given user is a PIC — powers the "My Department"
 * page and whether that nav tab is shown at all. */
export function listDepartmentsForUser(userId: number): Promise<Department[]> {
  return all<Department>(
    `SELECT d.* FROM departments d
     JOIN department_pics dp ON dp.department_id = d.id
     WHERE dp.user_id = ?
     ORDER BY d.name`,
    [userId]
  );
}

export async function isPicOfAny(userId: number): Promise<boolean> {
  const row = await get<{ n: number }>(
    "SELECT COUNT(*) AS n FROM department_pics WHERE user_id = ?",
    [userId]
  );
  return (row?.n ?? 0) > 0;
}

export async function isPicOfDepartment(
  userId: number,
  departmentId: number
): Promise<boolean> {
  const row = await get<{ n: number }>(
    "SELECT COUNT(*) AS n FROM department_pics WHERE user_id = ? AND department_id = ?",
    [userId, departmentId]
  );
  return (row?.n ?? 0) > 0;
}

export function listPicsForDepartment(departmentId: number): Promise<PicUser[]> {
  return all<PicUser>(
    `SELECT u.id, u.name, u.email
     FROM department_pics dp
     JOIN users u ON u.id = dp.user_id
     WHERE dp.department_id = ?
     ORDER BY u.name`,
    [departmentId]
  );
}

export interface DepartmentInput {
  name: string;
  description?: string | null;
}

export function createDepartment(input: DepartmentInput): Promise<number> {
  return run(
    "INSERT INTO departments (name, description) VALUES (@name, @description)",
    { name: input.name, description: input.description ?? null }
  );
}

export async function updateDepartment(
  id: number,
  input: DepartmentInput
): Promise<void> {
  await run(
    "UPDATE departments SET name = @name, description = @description, updated_at = datetime('now') WHERE id = @id",
    { id, name: input.name, description: input.description ?? null }
  );
}

export async function deleteDepartment(id: number): Promise<void> {
  await run("DELETE FROM departments WHERE id = ?", [id]);
}

export async function addDepartmentPic(
  departmentId: number,
  userId: number
): Promise<void> {
  await run(
    "INSERT OR IGNORE INTO department_pics (department_id, user_id) VALUES (?, ?)",
    [departmentId, userId]
  );
}

export async function removeDepartmentPic(
  departmentId: number,
  userId: number
): Promise<void> {
  await run(
    "DELETE FROM department_pics WHERE department_id = ? AND user_id = ?",
    [departmentId, userId]
  );
}

/* ---------- Module grants ---------- */

export async function getModulesForDepartment(
  departmentId: number
): Promise<ModuleKey[]> {
  const rows = await all<{ module: ModuleKey }>(
    "SELECT module FROM department_modules WHERE department_id = ? ORDER BY module",
    [departmentId]
  );
  return rows.map((r) => r.module);
}

/**
 * Modules a user reaches via their home department. Empty when the user has no
 * home department or that department grants nothing — the caller renders Home +
 * Guide only. Admins never go through here; they hold every module.
 */
export async function getModulesForUser(userId: number): Promise<ModuleKey[]> {
  const rows = await all<{ module: ModuleKey }>(
    `SELECT dm.module
     FROM users u
     JOIN department_modules dm ON dm.department_id = u.home_department_id
     WHERE u.id = ?
     ORDER BY dm.module`,
    [userId]
  );
  return rows.map((r) => r.module);
}

export async function addDepartmentModule(
  departmentId: number,
  module: ModuleKey
): Promise<void> {
  await run(
    "INSERT OR IGNORE INTO department_modules (department_id, module) VALUES (?, ?)",
    [departmentId, module]
  );
}

export async function removeDepartmentModule(
  departmentId: number,
  module: ModuleKey
): Promise<void> {
  await run(
    "DELETE FROM department_modules WHERE department_id = ? AND module = ?",
    [departmentId, module]
  );
}

export async function setDepartmentApprover(
  departmentId: number,
  isApprover: boolean
): Promise<void> {
  await run(
    "UPDATE departments SET is_approver = ?, updated_at = datetime('now') WHERE id = ?",
    [isApprover ? 1 : 0, departmentId]
  );
}

/** True when the user's home department is flagged as an approver unit. */
export async function isApproverUser(userId: number): Promise<boolean> {
  const row = await get<{ n: number }>(
    `SELECT COUNT(*) AS n
     FROM users u
     JOIN departments d ON d.id = u.home_department_id
     WHERE u.id = ? AND d.is_approver = 1`,
    [userId]
  );
  return (row?.n ?? 0) > 0;
}

export async function setHomeDepartment(
  userId: number,
  departmentId: number | null
): Promise<void> {
  await run("UPDATE users SET home_department_id = ? WHERE id = ?", [
    departmentId,
    userId,
  ]);
}
