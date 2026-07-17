"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession, requireAdmin } from "@/lib/session";
import {
  inventoryAdjustmentSchema,
  scheduleOrderDeliverySchema,
  firstError,
  type FormState,
} from "@/lib/validation";
import { recordInventoryTransaction } from "@/db/queries/inventory";
import {
  createDeliveryPlansFromOrder,
  markDeliveryDelivered,
} from "@/db/queries/deliveryPlans";
import { getOrder } from "@/db/queries/orders";

export async function recordInventoryAdjustmentAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  // The one unconstrained manual stock edit — stricter than the rest of the
  // module, which otherwise only mutates inventory via orders/deliveries/reports.
  const session = await requireAdmin();
  const parsed = inventoryAdjustmentSchema.safeParse({
    distributor_id: formData.get("distributor_id"),
    product_id: formData.get("product_id"),
    quantity: formData.get("quantity"),
    note: formData.get("note") ?? "",
  });
  if (!parsed.success) return { error: firstError(parsed.error) };

  await recordInventoryTransaction({
    distributor_id: parsed.data.distributor_id,
    product_id: parsed.data.product_id,
    txn_type: "adjustment",
    quantity: parsed.data.quantity,
    reference_type: "manual",
    note: parsed.data.note || null,
    created_by: session.userId,
  });
  revalidatePath("/channel/inventory");
  return {};
}

export async function createDeliveryPlanFromOrderAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  await requireSession();
  const parsed = scheduleOrderDeliverySchema.safeParse({
    order_id: formData.get("order_id"),
    plan_date: formData.get("plan_date"),
  });
  if (!parsed.success) return { error: firstError(parsed.error) };

  const order = await getOrder(parsed.data.order_id);
  if (!order) return { error: "Order not found." };
  if (order.status !== "approved") {
    return { error: "Only approved orders can be scheduled for delivery." };
  }

  await createDeliveryPlansFromOrder(order.id, order.distributor_id, parsed.data.plan_date);
  revalidatePath(`/channel/orders/${order.id}`);
  revalidatePath("/channel/inventory");
  return {};
}

export async function markDeliveryDeliveredAction(deliveryPlanId: number) {
  const session = await requireSession();
  await markDeliveryDelivered(deliveryPlanId, session.userId!);
  revalidatePath("/channel/inventory");
  revalidatePath("/channel/orders");
}
