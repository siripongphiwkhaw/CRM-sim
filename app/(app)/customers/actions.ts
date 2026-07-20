"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/session";
import {
  customerSchema,
  interactionSchema,
  transactionCreateSchema,
  redeemSchema,
  consentRecordSchema,
  firstError,
  type FormState,
} from "@/lib/validation";
import {
  createCustomer,
  updateCustomer,
  deleteCustomer,
} from "@/db/queries/customers";
import { linkLineUser, unlinkLineUser } from "@/db/queries/member";
import { createInteraction } from "@/db/queries/interactions";
import { createTransaction } from "@/db/queries/transactions";
import { redeemReward } from "@/db/queries/loyalty";
import { recordConsent } from "@/db/queries/consent";

function parseCustomer(formData: FormData) {
  return customerSchema.safeParse({
    first_name: formData.get("first_name"),
    last_name: formData.get("last_name"),
    email: formData.get("email") ?? "",
    phone: formData.get("phone") ?? "",
    brand: formData.get("brand"),
    cust_type: formData.get("cust_type"),
    register_channel: formData.get("register_channel") ?? "",
    data_level: formData.get("data_level"),
    consent_mode: formData.get("consent_mode") || "all",
  });
}

export async function createCustomerAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  await requireSession();
  const parsed = parseCustomer(formData);
  if (!parsed.success) return { error: firstError(parsed.error) };

  const { consent_mode, ...input } = parsed.data;
  const id = await createCustomer(input, consent_mode);
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

  // consent_mode only applies at registration; edits don't rewrite consent.
  const { consent_mode: _consent_mode, ...input } = parsed.data;
  await updateCustomer(id, input);
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

/** Records a purchase transaction → instant loyalty earn. */
export async function recordTransactionAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const session = await requireSession();
  const parsed = transactionCreateSchema.safeParse({
    customer_id: formData.get("customer_id"),
    channel: formData.get("channel"),
    amount_thb: formData.get("amount_thb"),
    brand: formData.get("brand"),
  });
  if (!parsed.success) return { error: firstError(parsed.error) };

  const result = await createTransaction({
    customer_id: parsed.data.customer_id,
    channel: parsed.data.channel,
    amount_thb: parsed.data.amount_thb,
    brand: parsed.data.brand,
    source_ref: "staff",
    created_by: session.userId ?? null,
  });
  revalidatePath(`/customers/${parsed.data.customer_id}`);
  const warn = result.channelFlag ? " (channel eligibility flagged for review)" : "";
  return { success: `Recorded — earned ${result.earned.points} points${warn}.` };
}

/** Staff-assisted reward redemption from Customer 360. */
export async function redeemRewardAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const session = await requireSession();
  const parsed = redeemSchema.safeParse({
    customer_id: formData.get("customer_id"),
    reward_id: formData.get("reward_id"),
  });
  if (!parsed.success) return { error: firstError(parsed.error) };

  const result = await redeemReward(
    parsed.data.customer_id,
    parsed.data.reward_id,
    session.userId ?? null
  );
  revalidatePath(`/customers/${parsed.data.customer_id}`);
  if (!result.ok) {
    if (result.error === "INSUFFICIENT_POINTS")
      return { error: "Not enough points for this reward." };
    if (result.error === "REWARD_INACTIVE")
      return { error: "That reward is no longer active." };
    return { error: "Reward not found." };
  }
  return { success: `Redeemed — ${result.balance} points remaining.` };
}

/** Grant or withdraw a consent purpose (appends to consent history). */
export async function recordConsentAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  await requireSession();
  const parsed = consentRecordSchema.safeParse({
    customer_id: formData.get("customer_id"),
    purpose: formData.get("purpose"),
    status: formData.get("status"),
  });
  if (!parsed.success) return { error: firstError(parsed.error) };

  await recordConsent({
    customer_id: parsed.data.customer_id,
    purpose: parsed.data.purpose,
    status: parsed.data.status,
    source: "staff",
  });
  revalidatePath(`/customers/${parsed.data.customer_id}`);
  return {};
}

/**
 * Links or unlinks a member's Only-One LINE account (staff-assisted). Catches
 * the unique-index violation so two members can't claim one LINE account, and
 * surfaces a readable message instead of a raw driver error.
 */
export async function setCustomerLineAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  await requireSession();
  const customerId = Number(formData.get("customer_id"));
  if (!customerId) return { error: "Missing member id." };
  const lineUserId = String(formData.get("line_user_id") ?? "").trim();

  try {
    if (lineUserId) {
      await linkLineUser(customerId, lineUserId);
    } else {
      await unlinkLineUser(customerId);
    }
  } catch (e) {
    // 23505 = unique_violation on customers_line_user_id.
    if (e instanceof Error && /23505|duplicate key|unique/i.test(e.message)) {
      return { error: "That LINE account is already linked to another member." };
    }
    throw e;
  }
  revalidatePath(`/customers/${customerId}`);
  return { success: lineUserId ? "LINE account linked." : "LINE account unlinked." };
}
