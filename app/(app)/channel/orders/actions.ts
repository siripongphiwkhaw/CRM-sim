"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession, requireAdmin } from "@/lib/session";
import {
  orderCreateSchema,
  orderRejectSchema,
  firstError,
  type FormState,
} from "@/lib/validation";
import {
  createOrder,
  applyOrderTransition,
  getOrder,
} from "@/db/queries/orders";
import { forceFulfillOrder } from "@/db/queries/deliveryPlans";

export async function createOrderAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const session = await requireSession();

  let items: unknown;
  try {
    items = JSON.parse(String(formData.get("items_json") ?? "[]"));
  } catch {
    return { error: "Invalid line items." };
  }

  const parsed = orderCreateSchema.safeParse({
    distributor_id: formData.get("distributor_id"),
    requested_delivery_date: formData.get("requested_delivery_date") ?? "",
    items,
  });
  if (!parsed.success) return { error: firstError(parsed.error) };

  const orderNumber = await createOrder({
    distributorId: parsed.data.distributor_id,
    requestedDeliveryDate: parsed.data.requested_delivery_date || null,
    items: parsed.data.items.map((i) => ({ productId: i.product_id, quantity: i.quantity })),
    createdBy: session.userId!,
  });

  revalidatePath("/channel/orders");
  redirect(`/channel/orders?created=${orderNumber}`);
}

export async function submitOrderAction(orderId: number) {
  const session = await requireSession();
  await applyOrderTransition(orderId, "submitted", session.userId!);
  revalidatePath("/channel/orders");
  revalidatePath(`/channel/orders/${orderId}`);
}

export async function approveOrderAction(orderId: number, note?: string) {
  await requireAdmin();
  const session = await requireSession();
  await applyOrderTransition(orderId, "approved", session.userId!, note || null);
  revalidatePath("/channel/orders");
  revalidatePath(`/channel/orders/${orderId}`);
}

export async function rejectOrderAction(orderId: number, note: string) {
  await requireAdmin();
  const session = await requireSession();
  const parsed = orderRejectSchema.safeParse({ note });
  if (!parsed.success) return;
  await applyOrderTransition(orderId, "rejected", session.userId!, parsed.data.note);
  revalidatePath("/channel/orders");
  revalidatePath(`/channel/orders/${orderId}`);
}

export async function cancelOrderAction(orderId: number, note?: string) {
  const order = await getOrder(orderId);
  if (!order) return;

  // draft/submitted: any signed-in user may withdraw. approved: admin only —
  // once approved, a non-admin can't unilaterally cancel a committed order.
  const session =
    order.status === "approved" ? await requireAdmin() : await requireSession();

  await applyOrderTransition(orderId, "cancelled", session.userId!, note || null);
  revalidatePath("/channel/orders");
  revalidatePath(`/channel/orders/${orderId}`);
}

export async function forceFulfillOrderAction(orderId: number) {
  const session = await requireAdmin();
  await forceFulfillOrder(orderId, session.userId!);
  revalidatePath("/channel/orders");
  revalidatePath(`/channel/orders/${orderId}`);
}
