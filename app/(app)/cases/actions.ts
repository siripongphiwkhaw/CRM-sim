"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/session";
import { caseCreateSchema, caseStatusSchema, firstError, type FormState } from "@/lib/validation";
import { createCase, updateCaseStatus, assignCase } from "@/db/queries/cases";
import type { CaseStatus } from "@/lib/constants";

export async function createCaseAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const session = await requireSession();
  const customerRaw = formData.get("customer_id");
  const parsed = caseCreateSchema.safeParse({
    customer_id: customerRaw ? Number(customerRaw) : undefined,
    subject: formData.get("subject"),
    description: formData.get("description") ?? "",
    category: formData.get("category") || undefined,
    priority: formData.get("priority") || "MEDIUM",
  });
  if (!parsed.success) return { error: firstError(parsed.error) };

  const id = await createCase({
    customer_id: parsed.data.customer_id ?? null,
    subject: parsed.data.subject,
    description: parsed.data.description || null,
    category: parsed.data.category ?? null,
    priority: parsed.data.priority,
    created_by: session.userId ?? null,
  });
  revalidatePath("/cases");
  redirect(`/cases/${id}`);
}

export async function updateCaseStatusAction(
  caseId: number,
  status: string,
  resolution?: string
) {
  await requireSession();
  const parsed = caseStatusSchema.safeParse({ status, resolution });
  if (!parsed.success) return;
  await updateCaseStatus(caseId, parsed.data.status as CaseStatus, parsed.data.resolution || null);
  revalidatePath("/cases");
  revalidatePath(`/cases/${caseId}`);
}

export async function assignCaseAction(caseId: number, userId: number | null) {
  await requireSession();
  await assignCase(caseId, userId);
  revalidatePath(`/cases/${caseId}`);
}
