"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/session";
import { segmentSchema, firstError, type FormState } from "@/lib/validation";
import {
  createSegment,
  deleteSegment,
  refreshSegmentCount,
  countSegmentMembers,
  type SegmentRule,
} from "@/db/queries/segments";
import { recordAudit } from "@/db/queries/audit";

function parseRule(formData: FormData): SegmentRule {
  return {
    tier: (formData.get("tier") as SegmentRule["tier"]) || undefined,
    brand: (formData.get("brand") as SegmentRule["brand"]) || undefined,
    cust_type: (formData.get("cust_type") as SegmentRule["cust_type"]) || undefined,
    min_points: formData.get("min_points") ? Number(formData.get("min_points")) : undefined,
    churn_level: (formData.get("churn_level") as SegmentRule["churn_level"]) || undefined,
    behavior_class: (formData.get("behavior_class") as SegmentRule["behavior_class"]) || undefined,
    channel_affinity: (formData.get("channel_affinity") as SegmentRule["channel_affinity"]) || undefined,
    primary_channel: (formData.get("primary_channel") as SegmentRule["primary_channel"]) || undefined,
    marketing_consent:
      formData.get("marketing_consent") === "true"
        ? true
        : formData.get("marketing_consent") === "false"
          ? false
          : undefined,
  };
}

/** Live count while building the form, before saving — same rule evaluation
 * createSegment uses, so the preview never disagrees with the saved count. */
export async function previewSegmentCountAction(formData: FormData): Promise<number> {
  await requireSession();
  return countSegmentMembers(parseRule(formData));
}

export async function createSegmentAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const session = await requireSession();
  const rule = parseRule(formData);
  const parsed = segmentSchema.safeParse({
    name: formData.get("name"),
    segment_type: formData.get("segment_type") || "custom",
    rule,
  });
  if (!parsed.success) return { error: firstError(parsed.error) };

  const id = await createSegment(parsed.data.name, parsed.data.segment_type, rule, session.userId ?? null);
  await recordAudit("segment", id, "create", session.userId ?? null, parsed.data.name);
  revalidatePath("/marketing/segments");
  return { success: "Segment created." };
}

export async function refreshSegmentAction(id: number) {
  await requireSession();
  await refreshSegmentCount(id);
  revalidatePath("/marketing/segments");
}

export async function deleteSegmentAction(formData: FormData) {
  const session = await requireSession();
  const id = Number(formData.get("id"));
  if (id) {
    await deleteSegment(id);
    await recordAudit("segment", id, "delete", session.userId ?? null);
  }
  revalidatePath("/marketing/segments");
}
