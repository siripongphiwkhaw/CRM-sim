"use server";

import { revalidatePath } from "next/cache";
import { requireSession, requireAdmin } from "@/lib/session";
import { missionSchema, missionReviewSchema, firstError, type FormState } from "@/lib/validation";
import { createMission, updateMission, setMissionStatus, reviewSubmission } from "@/db/queries/missions";
import { recordAudit } from "@/db/queries/audit";
import type { MissionStatus } from "@/lib/constants";

function parseMission(formData: FormData) {
  return missionSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") ?? "",
    mission_type: formData.get("mission_type"),
    reward_points: formData.get("reward_points"),
    status: formData.get("status") || "DRAFT",
    starts_at: formData.get("starts_at") ?? "",
    ends_at: formData.get("ends_at") ?? "",
    requires_proof: formData.get("requires_proof") === "on",
  });
}

export async function createMissionAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const session = await requireAdmin();
  const parsed = parseMission(formData);
  if (!parsed.success) return { error: firstError(parsed.error) };

  const id = await createMission(
    {
      name: parsed.data.name,
      description: parsed.data.description || null,
      mission_type: parsed.data.mission_type,
      reward_points: parsed.data.reward_points,
      status: parsed.data.status,
      starts_at: parsed.data.starts_at || null,
      ends_at: parsed.data.ends_at || null,
      requires_proof: parsed.data.requires_proof,
    },
    session.userId ?? null
  );
  await recordAudit("mission", id, "create", session.userId ?? null, parsed.data.name);
  revalidatePath("/loyalty/missions");
  return { success: "Mission created." };
}

export async function updateMissionAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const session = await requireSession();
  const id = Number(formData.get("id"));
  const parsed = parseMission(formData);
  if (!id || !parsed.success) return { error: parsed.success ? "Missing id." : firstError(parsed.error) };

  await updateMission(id, {
    name: parsed.data.name,
    description: parsed.data.description || null,
    mission_type: parsed.data.mission_type,
    reward_points: parsed.data.reward_points,
    status: parsed.data.status,
    starts_at: parsed.data.starts_at || null,
    ends_at: parsed.data.ends_at || null,
    requires_proof: parsed.data.requires_proof,
  });
  await recordAudit("mission", id, "update", session.userId ?? null);
  revalidatePath("/loyalty/missions");
  revalidatePath(`/loyalty/missions/${id}`);
  return { success: "Mission updated." };
}

export async function toggleMissionStatusAction(id: number, nextStatus: MissionStatus) {
  const session = await requireAdmin();
  await setMissionStatus(id, nextStatus);
  await recordAudit(
    "mission",
    id,
    nextStatus === "PUBLISHED" ? "publish" : "suspend",
    session.userId ?? null
  );
  revalidatePath("/loyalty/missions");
  revalidatePath(`/loyalty/missions/${id}`);
}

export async function reviewSubmissionAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const session = await requireSession();
  const parsed = missionReviewSchema.safeParse({
    submission_id: formData.get("submission_id"),
    // formData.get() always returns a string ("false" included), and
    // z.coerce.boolean() treats any non-empty string as true — compare
    // explicitly rather than letting coercion swallow "false".
    approve: formData.get("approve") === "true",
  });
  if (!parsed.success) return { error: firstError(parsed.error) };

  const result = await reviewSubmission(parsed.data.submission_id, parsed.data.approve, session.userId ?? null);
  if (!result.ok) {
    if (result.error === "ALREADY_REVIEWED") return { error: "This submission was already reviewed." };
    return { error: "Submission not found." };
  }
  await recordAudit(
    "mission_submission",
    parsed.data.submission_id,
    "update",
    session.userId ?? null,
    parsed.data.approve ? "approved" : "rejected"
  );
  const missionId = Number(formData.get("mission_id"));
  if (missionId) revalidatePath(`/loyalty/missions/${missionId}`);
  return { success: parsed.data.approve ? "Approved — points awarded." : "Rejected." };
}
