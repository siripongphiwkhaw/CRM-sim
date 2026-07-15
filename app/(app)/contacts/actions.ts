"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/session";
import { contactSchema, firstError, type FormState } from "@/lib/validation";
import {
  createContact,
  updateContact,
  deleteContact,
} from "@/db/queries/contacts";

function parseContact(formData: FormData) {
  return contactSchema.safeParse({
    first_name: formData.get("first_name"),
    last_name: formData.get("last_name"),
    email: formData.get("email") ?? "",
    phone: formData.get("phone") ?? "",
    title: formData.get("title") ?? "",
    company_id: formData.get("company_id") || null,
    notes: formData.get("notes") ?? "",
  });
}

export async function createContactAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  await requireSession();
  const parsed = parseContact(formData);
  if (!parsed.success) return { error: firstError(parsed.error) };

  const id = createContact(parsed.data);
  revalidatePath("/contacts");
  redirect(`/contacts/${id}`);
}

export async function updateContactAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  await requireSession();
  const id = Number(formData.get("id"));
  if (!id) return { error: "Missing contact id." };

  const parsed = parseContact(formData);
  if (!parsed.success) return { error: firstError(parsed.error) };

  updateContact(id, parsed.data);
  revalidatePath("/contacts");
  revalidatePath(`/contacts/${id}`);
  redirect(`/contacts/${id}`);
}

export async function deleteContactAction(formData: FormData) {
  await requireSession();
  const id = Number(formData.get("id"));
  if (id) {
    deleteContact(id);
    revalidatePath("/contacts");
  }
  redirect("/contacts");
}
