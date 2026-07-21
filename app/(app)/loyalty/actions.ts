"use server";

import { revalidatePath } from "next/cache";
import { requireSession, requireAdmin } from "@/lib/session";
import { rewardSchema, firstError, type FormState } from "@/lib/validation";
import { createReward, updateReward, setRewardStatus, runBirthdayRewards, runPointExpiry } from "@/db/queries/loyalty";
import { recordAudit } from "@/db/queries/audit";
import type { RewardStatus } from "@/lib/constants";

function parseReward(formData: FormData) {
  return rewardSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") ?? "",
    reward_type: formData.get("reward_type"),
    points_cost: formData.get("points_cost"),
    status: formData.get("status") || "PUBLISHED",
    starts_at: formData.get("starts_at") ?? "",
    ends_at: formData.get("ends_at") ?? "",
    per_member_limit: formData.get("per_member_limit") || "",
  });
}

export async function createRewardAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const session = await requireAdmin();
  const parsed = parseReward(formData);
  if (!parsed.success) return { error: firstError(parsed.error) };

  const id = await createReward({
    name: parsed.data.name,
    description: parsed.data.description || null,
    reward_type: parsed.data.reward_type,
    points_cost: parsed.data.points_cost,
    status: parsed.data.status,
    starts_at: parsed.data.starts_at || null,
    ends_at: parsed.data.ends_at || null,
    per_member_limit: parsed.data.per_member_limit ? Number(parsed.data.per_member_limit) : null,
  });
  await recordAudit("reward", id, "create", session.userId ?? null, parsed.data.name);
  revalidatePath("/loyalty");
  return { success: "Reward created." };
}

export async function toggleRewardAction(id: number, nextStatus: RewardStatus) {
  const session = await requireAdmin();
  await setRewardStatus(id, nextStatus);
  await recordAudit(
    "reward",
    id,
    nextStatus === "PUBLISHED" ? "publish" : "suspend",
    session.userId ?? null
  );
  revalidatePath("/loyalty");
}

export async function updateRewardAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const session = await requireSession();
  const id = Number(formData.get("id"));
  const parsed = parseReward(formData);
  if (!id || !parsed.success) return { error: parsed.success ? "Missing id." : firstError(parsed.error) };
  await updateReward(id, {
    name: parsed.data.name,
    description: parsed.data.description || null,
    reward_type: parsed.data.reward_type,
    points_cost: parsed.data.points_cost,
    status: parsed.data.status,
    starts_at: parsed.data.starts_at || null,
    ends_at: parsed.data.ends_at || null,
    per_member_limit: parsed.data.per_member_limit ? Number(parsed.data.per_member_limit) : null,
  });
  await recordAudit("reward", id, "update", session.userId ?? null);
  revalidatePath("/loyalty");
  return { success: "Reward updated." };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- useActionState's action signature requires both params even though this job takes no form input.
export async function runBirthdayRewardsAction(_prev: FormState, _formData: FormData): Promise<FormState> {
  const session = await requireAdmin();
  const { awarded } = await runBirthdayRewards(session.userId ?? null);
  await recordAudit("loyalty_job", 0, "create", session.userId ?? null, `birthday: ${awarded} awarded`);
  revalidatePath("/loyalty");
  return {
    success: awarded === 0 ? "No birthdays today (or already awarded)." : `Awarded ${awarded} birthday bonus${awarded === 1 ? "" : "es"}.`,
  };
}

export async function runPointExpiryAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const session = await requireAdmin();
  const months = Number(formData.get("months"));
  if (!Number.isInteger(months) || months <= 0) return { error: "Enter a valid number of months." };

  const { expired, totalPoints } = await runPointExpiry(months, session.userId ?? null);
  await recordAudit(
    "loyalty_job",
    0,
    "create",
    session.userId ?? null,
    `expiry(${months}mo): ${expired} members, ${totalPoints} points`
  );
  revalidatePath("/loyalty");
  return {
    success:
      expired === 0
        ? "Nothing to expire."
        : `Expired ${totalPoints.toLocaleString("en-US")} points across ${expired} member${expired === 1 ? "" : "s"}.`,
  };
}
