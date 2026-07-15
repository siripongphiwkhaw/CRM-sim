"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/session";
import { companySchema, firstError, type FormState } from "@/lib/validation";
import {
  createCompany,
  updateCompany,
  deleteCompany,
} from "@/db/queries/companies";

function parseCompany(formData: FormData) {
  return companySchema.safeParse({
    name: formData.get("name"),
    industry: formData.get("industry") ?? "",
    website: formData.get("website") ?? "",
    phone: formData.get("phone") ?? "",
    address: formData.get("address") ?? "",
  });
}

export async function createCompanyAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  await requireSession();
  const parsed = parseCompany(formData);
  if (!parsed.success) return { error: firstError(parsed.error) };

  const id = createCompany(parsed.data);
  revalidatePath("/companies");
  redirect(`/companies/${id}`);
}

export async function updateCompanyAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  await requireSession();
  const id = Number(formData.get("id"));
  if (!id) return { error: "Missing company id." };

  const parsed = parseCompany(formData);
  if (!parsed.success) return { error: firstError(parsed.error) };

  updateCompany(id, parsed.data);
  revalidatePath("/companies");
  revalidatePath(`/companies/${id}`);
  redirect(`/companies/${id}`);
}

export async function deleteCompanyAction(formData: FormData) {
  await requireSession();
  const id = Number(formData.get("id"));
  if (id) {
    deleteCompany(id);
    revalidatePath("/companies");
  }
  redirect("/companies");
}
