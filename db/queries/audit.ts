import { all, run } from "../client";
import type { AuditAction } from "@/lib/constants";

/**
 * Governance audit trail. Append-only — one INSERT per governance-sensitive
 * action (reward/mission/segment/campaign create/publish/suspend/delete/
 * launch/pause/resume), called from the server action right after the write
 * it's recording. Never updated or deleted.
 */

export interface AuditRow {
  id: number;
  entity_name: string;
  entity_id: number;
  action: AuditAction;
  user_id: number | null;
  user_name: string | null;
  detail: string | null;
  created_at: string;
}

export function recordAudit(
  entityName: string,
  entityId: number,
  action: AuditAction,
  userId: number | null,
  detail?: string | null
): Promise<number> {
  return run(
    `INSERT INTO audit_log (entity_name, entity_id, action, user_id, detail)
     VALUES (@entity, @id, @action, @user, @detail) RETURNING id`,
    { entity: entityName, id: entityId, action, user: userId, detail: detail ?? null }
  );
}

export function listAudit(opts?: { entityName?: string; entityId?: number; limit?: number }): Promise<AuditRow[]> {
  const clauses: string[] = [];
  const params: (string | number)[] = [];
  if (opts?.entityName) {
    clauses.push("a.entity_name = ?");
    params.push(opts.entityName);
  }
  if (opts?.entityId) {
    clauses.push("a.entity_id = ?");
    params.push(opts.entityId);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const limit = opts?.limit ?? 100;
  return all<AuditRow>(
    `SELECT a.*, u.name AS user_name FROM audit_log a
     LEFT JOIN users u ON u.id = a.user_id
     ${where}
     ORDER BY a.created_at DESC, a.id DESC LIMIT ${limit}`,
    params
  );
}
