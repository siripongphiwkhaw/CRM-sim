import { get, all, batch, type QueryArgs } from "../client";
import { getOrderItems, applyOrderTransition } from "./orders";
import { createTransaction } from "./transactions";

export type DeliveryPlanStatus = "planned" | "delivered" | "cancelled";

export interface DeliveryPlan {
  id: number;
  distributor_id: number;
  product_id: number;
  order_id: number | null;
  plan_date: string;
  planned_qty: number;
  status: DeliveryPlanStatus;
  created_at: string;
}

export interface DeliveryPlanWithNames extends DeliveryPlan {
  distributor_name: string;
  product_name: string;
  sku: string;
}

export function listDeliveryPlans(opts?: {
  distributorId?: number;
  orderId?: number;
  status?: string;
}): Promise<DeliveryPlanWithNames[]> {
  const clauses: string[] = [];
  const params: (string | number)[] = [];
  if (opts?.distributorId) {
    clauses.push("dp.distributor_id = ?");
    params.push(opts.distributorId);
  }
  if (opts?.orderId) {
    clauses.push("dp.order_id = ?");
    params.push(opts.orderId);
  }
  if (opts?.status) {
    clauses.push("dp.status = ?");
    params.push(opts.status);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  return all<DeliveryPlanWithNames>(
    `SELECT dp.*, d.name AS distributor_name, p.name AS product_name, p.sku
     FROM delivery_plans dp
     JOIN distributors d ON d.id = dp.distributor_id
     JOIN products p ON p.id = dp.product_id
     ${where}
     ORDER BY dp.plan_date DESC`,
    params
  );
}

export function getDeliveryPlan(id: number): Promise<DeliveryPlan | undefined> {
  return get<DeliveryPlan>("SELECT * FROM delivery_plans WHERE id = ?", [id]);
}

/** One delivery-plan row per order line, dated for the given plan_date. */
export async function createDeliveryPlansFromOrder(
  orderId: number,
  distributorId: number,
  planDate: string
): Promise<void> {
  const items = await getOrderItems(orderId);
  if (items.length === 0) return;

  const statements: { sql: string; args: QueryArgs }[] = items.map((item) => ({
    sql: `INSERT INTO delivery_plans (distributor_id, product_id, order_id, plan_date, planned_qty)
          VALUES (@distributor_id, @product_id, @order_id, @plan_date, @planned_qty)`,
    args: {
      distributor_id: distributorId,
      product_id: item.product_id,
      order_id: orderId,
      plan_date: planDate,
      planned_qty: item.quantity,
    },
  }));
  await batch(statements);
}

/**
 * Marks a plan delivered and posts the matching stock-in ledger entry
 * atomically. If this was the last outstanding plan for its order, also
 * advances that order to 'fulfilled' via applyOrderTransition (a separate,
 * already-atomic step — see db/queries/orders.ts).
 */
export async function markDeliveryDelivered(
  id: number,
  actorUserId: number
): Promise<void> {
  const plan = await getDeliveryPlan(id);
  if (!plan || plan.status !== "planned") return;

  await batch([
    {
      sql: "UPDATE delivery_plans SET status = 'delivered' WHERE id = ?",
      args: [id],
    },
    {
      sql: `INSERT INTO inventory_transactions
              (distributor_id, product_id, txn_type, quantity, reference_type, reference_id, created_by)
            VALUES (@distributor_id, @product_id, 'stock_in', @quantity, 'delivery_plan', @plan_id, @actor)`,
      args: {
        distributor_id: plan.distributor_id,
        product_id: plan.product_id,
        quantity: plan.planned_qty,
        plan_id: id,
        actor: actorUserId,
      },
    },
  ]);

  // If the receiving dealer is linked to a CRM member, a delivered sell-in is a
  // real B2B (SFA) purchase → record a transaction and earn loyalty points. The
  // amount uses the order's snapshotted unit price when order-linked, else the
  // current catalog price.
  const dealer = await get<{ customer_id: number | null }>(
    "SELECT customer_id FROM distributors WHERE id = ?",
    [plan.distributor_id]
  );
  if (dealer?.customer_id) {
    let unitPrice: number | null = null;
    if (plan.order_id) {
      const row = await get<{ unit_price: number }>(
        "SELECT unit_price FROM order_items WHERE order_id = ? AND product_id = ? LIMIT 1",
        [plan.order_id, plan.product_id]
      );
      unitPrice = row?.unit_price ?? null;
    }
    if (unitPrice == null) {
      const row = await get<{ unit_price: number }>(
        "SELECT unit_price FROM products WHERE id = ?",
        [plan.product_id]
      );
      unitPrice = row?.unit_price ?? 0;
    }
    await createTransaction({
      customer_id: dealer.customer_id,
      channel: "SFA",
      amount_thb: unitPrice * plan.planned_qty,
      source_ref: `delivery_plan:${id}`,
      created_by: actorUserId,
    });
  }

  if (plan.order_id) {
    const remaining = await get<{ n: number }>(
      "SELECT COUNT(*) AS n FROM delivery_plans WHERE order_id = ? AND status = 'planned'",
      [plan.order_id]
    );
    if ((remaining?.n ?? 0) === 0) {
      await applyOrderTransition(plan.order_id, "fulfilled", actorUserId, "Auto-fulfilled: all deliveries completed.");
    }
  }
}

/** Admin override for edge cases (partial delivery, etc.) — see plan doc. */
export async function forceFulfillOrder(
  orderId: number,
  actorUserId: number
): Promise<{ ok: boolean; error?: string }> {
  return applyOrderTransition(orderId, "fulfilled", actorUserId, "Manually forced fulfilled by admin.");
}
