"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireSession } from "@/lib/session";
import { dealSchema, firstError, type FormState } from "@/lib/validation";
import { DEAL_STAGES } from "@/lib/constants";
import {
  createDeal,
  updateDeal,
  deleteDeal,
  moveDealStage,
  getDeal,
} from "@/db/queries/deals";

function parseDeal(formData: FormData) {
  return dealSchema.safeParse({
    title: formData.get("title"),
    value: formData.get("value") || 0,
    stage: formData.get("stage"),
    contact_id: formData.get("contact_id") || null,
    company_id: formData.get("company_id") || null,
    expected_close_date: formData.get("expected_close_date") || "",
  });
}

export async function createDealAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const session = await requireSession();
  const parsed = parseDeal(formData);
  if (!parsed.success) return { error: firstError(parsed.error) };

  const id = await createDeal({ ...parsed.data, owner_id: session.userId });
  revalidatePath("/deals");
  redirect(`/deals/${id}`);
}

export async function updateDealAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  await requireSession();
  const id = Number(formData.get("id"));
  if (!id) return { error: "Missing deal id." };

  const parsed = parseDeal(formData);
  if (!parsed.success) return { error: firstError(parsed.error) };

  const existing = await getDeal(id);
  await updateDeal(id, { ...parsed.data, owner_id: existing?.owner_id ?? null });
  revalidatePath("/deals");
  revalidatePath(`/deals/${id}`);
  redirect(`/deals/${id}`);
}

export async function moveDealStageAction(id: number, stage: string) {
  await requireSession();
  const parsed = z.enum(DEAL_STAGES).safeParse(stage);
  if (!parsed.success) return;

  await moveDealStage(id, parsed.data);
  revalidatePath("/deals");
  revalidatePath(`/deals/${id}`);
}

export async function deleteDealAction(formData: FormData) {
  await requireSession();
  const id = Number(formData.get("id"));
  if (id) {
    await deleteDeal(id);
    revalidatePath("/deals");
  }
  redirect("/deals");
}
