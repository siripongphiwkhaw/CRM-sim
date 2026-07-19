"use server";

import { revalidatePath } from "next/cache";
import { requireSession, requireAdmin } from "@/lib/session";
import { rewardSchema, firstError, type FormState } from "@/lib/validation";
import { createReward, updateReward, setRewardActive } from "@/db/queries/loyalty";

export async function createRewardAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  await requireAdmin();
  const parsed = rewardSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") ?? "",
    reward_type: formData.get("reward_type"),
    points_cost: formData.get("points_cost"),
  });
  if (!parsed.success) return { error: firstError(parsed.error) };

  await createReward({
    name: parsed.data.name,
    description: parsed.data.description || null,
    reward_type: parsed.data.reward_type,
    points_cost: parsed.data.points_cost,
  });
  revalidatePath("/loyalty");
  return { success: "Reward created." };
}

export async function toggleRewardAction(id: number, active: boolean) {
  await requireAdmin();
  await setRewardActive(id, active);
  revalidatePath("/loyalty");
}

export async function updateRewardAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  await requireSession();
  const id = Number(formData.get("id"));
  const parsed = rewardSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") ?? "",
    reward_type: formData.get("reward_type"),
    points_cost: formData.get("points_cost"),
  });
  if (!id || !parsed.success) return { error: parsed.success ? "Missing id." : firstError(parsed.error) };
  await updateReward(id, {
    name: parsed.data.name,
    description: parsed.data.description || null,
    reward_type: parsed.data.reward_type,
    points_cost: parsed.data.points_cost,
  });
  revalidatePath("/loyalty");
  return { success: "Reward updated." };
}
