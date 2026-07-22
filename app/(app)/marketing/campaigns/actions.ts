"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/session";
import { campaignSchema, firstError, type FormState } from "@/lib/validation";
import {
  createCampaign,
  launchCampaign,
  setCampaignStatus,
  recomputeConversions,
} from "@/db/queries/campaigns";
import { recordAudit } from "@/db/queries/audit";
import type { CampaignStatus } from "@/lib/constants";

export async function createCampaignAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const session = await requireSession();
  const parsed = campaignSchema.safeParse({
    name: formData.get("name"),
    channel: formData.get("channel"),
    segment_id: formData.get("segment_id"),
    campaign_type: formData.get("campaign_type") || "retention",
    cooldown_days: formData.get("cooldown_days") || 30,
  });
  if (!parsed.success) return { error: firstError(parsed.error) };

  const id = await createCampaign(
    parsed.data.name,
    parsed.data.channel,
    parsed.data.segment_id,
    parsed.data.campaign_type,
    parsed.data.cooldown_days,
    session.userId ?? null
  );
  await recordAudit("campaign", id, "create", session.userId ?? null, parsed.data.name);
  revalidatePath("/marketing/campaigns");
  return { success: "Campaign created as a draft." };
}

export async function launchCampaignAction(id: number): Promise<FormState> {
  const session = await requireSession();
  const result = await launchCampaign(id);
  if (!result.ok) {
    return {
      error:
        result.error === "ALREADY_LAUNCHED"
          ? "This campaign was already launched."
          : "This campaign has no segment to launch to.",
    };
  }
  await recordAudit(
    "campaign",
    id,
    "launch",
    session.userId ?? null,
    `reach ${result.reach}/${result.audienceSize}, ${result.excluded} excluded by arbitration`
  );
  revalidatePath("/marketing/campaigns");
  revalidatePath(`/marketing/campaigns/${id}`);
  const excludedNote =
    result.excluded > 0
      ? ` ${result.excluded} skipped to avoid overlapping another channel's promo.`
      : "";
  return {
    success: `Launched — reached ${result.reach} of ${result.audienceSize} members (consent-gated).${excludedNote}`,
  };
}

export async function setCampaignStatusAction(id: number, status: CampaignStatus) {
  const session = await requireSession();
  await setCampaignStatus(id, status);
  await recordAudit(
    "campaign",
    id,
    status === "PAUSED" ? "pause" : status === "RUNNING" ? "resume" : "update",
    session.userId ?? null
  );
  revalidatePath("/marketing/campaigns");
  revalidatePath(`/marketing/campaigns/${id}`);
}

export async function recomputeConversionsAction(id: number) {
  await requireSession();
  await recomputeConversions(id);
  revalidatePath(`/marketing/campaigns/${id}`);
}
