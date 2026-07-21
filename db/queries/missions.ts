import { get, all, run } from "../client";
import { missionAvailable } from "@/lib/loyaltyEngine";
import { postEarn, type LedgerSource } from "./loyalty";
import type { MissionType, MissionStatus, MissionSubmissionStatus } from "@/lib/constants";

/**
 * Loyalty missions: staff-authored tasks members complete for bonus points.
 * Mirrors the reward lifecycle (Draft/Published/Suspended), but adds a
 * submission queue since a mission is completed by an action, not bought.
 */

export interface Mission {
  id: number;
  code: string;
  name: string;
  description: string | null;
  mission_type: MissionType;
  reward_points: number;
  status: MissionStatus;
  starts_at: string | null;
  ends_at: string | null;
  requires_proof: number;
  created_by: number | null;
  created_at: string;
}

export interface MissionSubmission {
  id: number;
  mission_id: number;
  customer_id: number;
  status: MissionSubmissionStatus;
  proof_note: string | null;
  ledger_id: number | null;
  reviewed_by: number | null;
  submitted_at: string;
  reviewed_at: string | null;
}

export interface MissionSubmissionRow extends MissionSubmission {
  mission_name: string;
  reward_points: number;
  member_code: string;
  member_name: string;
}

export function listMissions(opts?: { status?: MissionStatus }): Promise<Mission[]> {
  const where = opts?.status ? "WHERE status = ?" : "";
  const params = opts?.status ? [opts.status] : [];
  return all<Mission>(`SELECT * FROM missions ${where} ORDER BY created_at DESC`, params);
}

export function getMission(id: number): Promise<Mission | undefined> {
  return get<Mission>("SELECT * FROM missions WHERE id = ?", [id]);
}

export interface MissionInput {
  name: string;
  description?: string | null;
  mission_type: MissionType;
  reward_points: number;
  status?: MissionStatus;
  starts_at?: string | null;
  ends_at?: string | null;
  requires_proof?: boolean;
}

export async function createMission(input: MissionInput, createdBy: number | null): Promise<number> {
  const next = await get<{ n: number }>("SELECT COALESCE(MAX(id),0)+1 AS n FROM missions");
  const code = `MSN-${String(next?.n ?? 1).padStart(3, "0")}`;
  return run(
    `INSERT INTO missions
       (code, name, description, mission_type, reward_points, status, starts_at, ends_at, requires_proof, created_by)
     VALUES (@code, @name, @desc, @type, @points, @status, @starts, @ends, @proof, @by) RETURNING id`,
    {
      code,
      name: input.name,
      desc: input.description ?? null,
      type: input.mission_type,
      points: input.reward_points,
      status: input.status ?? "DRAFT",
      starts: input.starts_at ?? null,
      ends: input.ends_at ?? null,
      proof: input.requires_proof ? 1 : 0,
      by: createdBy,
    }
  );
}

export function updateMission(id: number, input: MissionInput): Promise<number> {
  return run(
    `UPDATE missions SET
       name=@name, description=@desc, mission_type=@type, reward_points=@points,
       status=@status, starts_at=@starts, ends_at=@ends, requires_proof=@proof
     WHERE id=@id`,
    {
      id,
      name: input.name,
      desc: input.description ?? null,
      type: input.mission_type,
      points: input.reward_points,
      status: input.status ?? "DRAFT",
      starts: input.starts_at ?? null,
      ends: input.ends_at ?? null,
      proof: input.requires_proof ? 1 : 0,
    }
  );
}

export function setMissionStatus(id: number, status: MissionStatus): Promise<number> {
  return run("UPDATE missions SET status = ? WHERE id = ?", [status, id]);
}

export function listSubmissions(opts?: {
  missionId?: number;
  customerId?: number;
  status?: MissionSubmissionStatus;
}): Promise<MissionSubmissionRow[]> {
  const clauses: string[] = [];
  const params: (string | number)[] = [];
  if (opts?.missionId) {
    clauses.push("s.mission_id = ?");
    params.push(opts.missionId);
  }
  if (opts?.customerId) {
    clauses.push("s.customer_id = ?");
    params.push(opts.customerId);
  }
  if (opts?.status) {
    clauses.push("s.status = ?");
    params.push(opts.status);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  return all<MissionSubmissionRow>(
    `SELECT s.*, m.name AS mission_name, m.reward_points,
            c.member_code, (c.first_name || ' ' || c.last_name) AS member_name
       FROM mission_submissions s
       JOIN missions m ON m.id = s.mission_id
       JOIN customers c ON c.id = s.customer_id
       ${where}
      ORDER BY s.submitted_at DESC, s.id DESC`,
    params
  );
}

export type SubmitMissionResult =
  | { ok: true; status: "PENDING" | "APPROVED" }
  | { ok: false; error: "MISSION_NOT_FOUND" | "MISSION_UNAVAILABLE" | "ALREADY_SUBMITTED" };

/**
 * A member completes a mission from LIFF. requires_proof=0 auto-awards
 * immediately (submission lands APPROVED with the ledger entry attached);
 * requires_proof=1 queues it PENDING for staff review. Blocks a second
 * attempt while one is still PENDING or already APPROVED — a REJECTED
 * submission may be retried.
 */
export async function submitMission(
  customerId: number,
  missionId: number,
  proofNote: string | null,
  source: LedgerSource = "liff"
): Promise<SubmitMissionResult> {
  const mission = await getMission(missionId);
  if (!mission) return { ok: false, error: "MISSION_NOT_FOUND" };
  if (!missionAvailable(mission)) return { ok: false, error: "MISSION_UNAVAILABLE" };

  const existing = await get<{ id: number }>(
    `SELECT id FROM mission_submissions
      WHERE mission_id = @mid AND customer_id = @cid AND status IN ('PENDING','APPROVED')
      LIMIT 1`,
    { mid: missionId, cid: customerId }
  );
  if (existing) return { ok: false, error: "ALREADY_SUBMITTED" };

  if (!mission.requires_proof) {
    const ledgerId = await postEarn(customerId, mission.reward_points, {
      refType: "mission",
      refId: missionId,
      note: `Mission: ${mission.name}`,
      source,
    });
    await run(
      `INSERT INTO mission_submissions
         (mission_id, customer_id, status, proof_note, ledger_id, reviewed_at)
       VALUES (@mid, @cid, 'APPROVED', @note, @ledger, now())`,
      { mid: missionId, cid: customerId, note: proofNote, ledger: ledgerId }
    );
    return { ok: true, status: "APPROVED" };
  }

  await run(
    `INSERT INTO mission_submissions (mission_id, customer_id, status, proof_note)
     VALUES (@mid, @cid, 'PENDING', @note)`,
    { mid: missionId, cid: customerId, note: proofNote }
  );
  return { ok: true, status: "PENDING" };
}

export type ReviewSubmissionResult =
  | { ok: true }
  | { ok: false; error: "SUBMISSION_NOT_FOUND" | "ALREADY_REVIEWED" };

/** Staff approve/reject a proof-required submission. Approving awards points
 * exactly once — a submission not in PENDING can't be reviewed again. */
export async function reviewSubmission(
  submissionId: number,
  approve: boolean,
  reviewerId: number | null
): Promise<ReviewSubmissionResult> {
  const submission = await get<MissionSubmission & { reward_points: number; mission_name: string }>(
    `SELECT s.*, m.reward_points, m.name AS mission_name
       FROM mission_submissions s JOIN missions m ON m.id = s.mission_id
      WHERE s.id = ?`,
    [submissionId]
  );
  if (!submission) return { ok: false, error: "SUBMISSION_NOT_FOUND" };
  if (submission.status !== "PENDING") return { ok: false, error: "ALREADY_REVIEWED" };

  if (approve) {
    const ledgerId = await postEarn(submission.customer_id, submission.reward_points, {
      refType: "mission",
      refId: submission.mission_id,
      note: `Mission: ${submission.mission_name}`,
      actorId: reviewerId,
      source: "staff",
    });
    await run(
      `UPDATE mission_submissions
          SET status = 'APPROVED', ledger_id = @ledger, reviewed_by = @by, reviewed_at = now()
        WHERE id = @id`,
      { id: submissionId, ledger: ledgerId, by: reviewerId }
    );
  } else {
    await run(
      `UPDATE mission_submissions
          SET status = 'REJECTED', reviewed_by = @by, reviewed_at = now()
        WHERE id = @id`,
      { id: submissionId, by: reviewerId }
    );
  }
  return { ok: true };
}
