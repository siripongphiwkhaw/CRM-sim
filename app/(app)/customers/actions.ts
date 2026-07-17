"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/session";
import {
  customerSchema,
  interactionSchema,
  firstError,
  type FormState,
} from "@/lib/validation";
import { z } from "zod";
import { TIERS } from "@/lib/constants";
import {
  createCustomer,
  updateCustomer,
  deleteCustomer,
  setCustomerTier,
} from "@/db/queries/customers";
import { createInteraction } from "@/db/queries/interactions";

function parseCustomer(formData: FormData) {
  return customerSchema.safeParse({
    first_name: formData.get("first_name"),
    last_name: formData.get("last_name"),
    email: formData.get("email") ?? "",
    phone: formData.get("phone") ?? "",
    brand: formData.get("brand"),
    tier: formData.get("tier"),
    points: formData.get("points") || 0,
    register_channel: formData.get("register_channel") ?? "",
    data_level: formData.get("data_level"),
    consent_pdpa: formData.get("consent_pdpa") === "on",
    consent_marketing: formData.get("consent_marketing") === "on",
    consent_migration: formData.get("consent_migration") === "on",
  });
}

export async function createCustomerAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  await requireSession();
  const parsed = parseCustomer(formData);
  if (!parsed.success) return { error: firstError(parsed.error) };

  const id = await createCustomer(parsed.data);
  revalidatePath("/customers");
  redirect(`/customers/${id}`);
}

export async function updateCustomerAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  await requireSession();
  const id = Number(formData.get("id"));
  if (!id) return { error: "Missing customer id." };

  const parsed = parseCustomer(formData);
  if (!parsed.success) return { error: firstError(parsed.error) };

  await updateCustomer(id, parsed.data);
  revalidatePath("/customers");
  revalidatePath(`/customers/${id}`);
  redirect(`/customers/${id}`);
}

export async function deleteCustomerAction(formData: FormData) {
  await requireSession();
  const id = Number(formData.get("id"));
  if (id) {
    await deleteCustomer(id);
    revalidatePath("/customers");
  }
  redirect("/customers");
}

/** Salesforce-style Path: move a member to a tier directly from the record page. */
export async function setTierAction(id: number, tier: string) {
  await requireSession();
  const parsed = z.enum(TIERS).safeParse(tier);
  if (!parsed.success || !id) return;

  await setCustomerTier(id, parsed.data);
  revalidatePath(`/customers/${id}`);
  revalidatePath("/customers");
}

export async function addInteractionAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  await requireSession();
  const customerId = Number(formData.get("customer_id"));
  if (!customerId) return { error: "Missing customer id." };

  const parsed = interactionSchema.safeParse({
    type: formData.get("type"),
    channel: formData.get("channel") ?? "",
    amount: formData.get("amount") || 0,
    points: formData.get("points") || 0,
    description: formData.get("description") ?? "",
  });
  if (!parsed.success) return { error: firstError(parsed.error) };

  await createInteraction({
    customer_id: customerId,
    type: parsed.data.type,
    channel: parsed.data.channel || null,
    amount: parsed.data.amount,
    points: parsed.data.points,
    description: parsed.data.description || null,
  });
  revalidatePath(`/customers/${customerId}`);
  return {};
}
