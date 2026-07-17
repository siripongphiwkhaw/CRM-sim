"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession, requireAdmin } from "@/lib/session";
import { distributorSchema, firstError, type FormState } from "@/lib/validation";
import {
  createDistributor,
  updateDistributor,
  deleteDistributor,
  hasActiveOrders,
} from "@/db/queries/distributors";

function parseDistributor(formData: FormData) {
  return distributorSchema.safeParse({
    name: formData.get("name"),
    region: formData.get("region") ?? "",
    channel: formData.get("channel") ?? "",
    status: formData.get("status"),
    contact_name: formData.get("contact_name") ?? "",
    phone: formData.get("phone") ?? "",
    email: formData.get("email") ?? "",
    address: formData.get("address") ?? "",
    credit_limit: formData.get("credit_limit") || 0,
  });
}

export async function createDistributorAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  await requireSession();
  const parsed = parseDistributor(formData);
  if (!parsed.success) return { error: firstError(parsed.error) };

  const id = await createDistributor(parsed.data);
  revalidatePath("/channel/distributors");
  redirect(`/channel/distributors/${id}`);
}

export async function updateDistributorAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  await requireSession();
  const id = Number(formData.get("id"));
  if (!id) return { error: "Missing distributor id." };

  const parsed = parseDistributor(formData);
  if (!parsed.success) return { error: firstError(parsed.error) };

  await updateDistributor(id, parsed.data);
  revalidatePath("/channel/distributors");
  revalidatePath(`/channel/distributors/${id}`);
  redirect(`/channel/distributors/${id}`);
}

export async function deleteDistributorAction(formData: FormData) {
  await requireAdmin();
  const id = Number(formData.get("id"));
  if (id) {
    if (await hasActiveOrders(id)) {
      // Can't return a form error from a plain action bound to a <form>;
      // redirect back to the record with the guard reason in the query string.
      redirect(`/channel/distributors/${id}?error=has-active-orders`);
    }
    await deleteDistributor(id);
    revalidatePath("/channel/distributors");
  }
  redirect("/channel/distributors");
}
