import { get, all, batch, type QueryArgs } from "../client";
import {
  canTransition,
  type OrderStatus,
} from "@/lib/orderWorkflow";

export interface Order {
  id: number;
  order_number: string;
  distributor_id: number;
  status: OrderStatus;
  requested_delivery_date: string | null;
  created_by: number;
  submitted_at: string | null;
  decided_at: string | null;
  decided_by: number | null;
  decision_note: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderWithDistributor extends Order {
  distributor_name: string;
  total_amount: number;
}

export interface OrderItem {
  id: number;
  order_id: number;
  product_id: number;
  quantity: number;
  unit_price: number;
  product_name: string;
  sku: string;
}

export interface OrderStatusHistoryRow {
  id: number;
  order_id: number;
  from_status: OrderStatus | null;
  to_status: OrderStatus;
  note: string | null;
  changed_by: number;
  changed_at: string;
  changed_by_name: string;
}

const SORT_COLUMNS: Record<string, string> = {
  number: "o.order_number",
  status: "o.status",
  created: "o.created_at",
};

const WITH_DISTRIBUTOR = `SELECT o.*, d.name AS distributor_name,
    (SELECT COALESCE(SUM(oi.quantity * oi.unit_price), 0) FROM order_items oi WHERE oi.order_id = o.id) AS total_amount
  FROM orders o
  JOIN distributors d ON d.id = o.distributor_id`;

export function listOrders(opts?: {
  distributorId?: number;
  status?: string;
  sort?: string;
  dir?: string;
}): Promise<OrderWithDistributor[]> {
  const clauses: string[] = [];
  const params: (string | number)[] = [];
  if (opts?.distributorId) {
    clauses.push("o.distributor_id = ?");
    params.push(opts.distributorId);
  }
  if (opts?.status) {
    clauses.push("o.status = ?");
    params.push(opts.status);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const column = SORT_COLUMNS[opts?.sort ?? ""] ?? "o.created_at";
  const dir = opts?.dir === "asc" ? "ASC" : "DESC";
  return all<OrderWithDistributor>(
    `${WITH_DISTRIBUTOR} ${where} ORDER BY ${column} ${dir}`,
    params
  );
}

export function getOrder(id: number): Promise<OrderWithDistributor | undefined> {
  return get<OrderWithDistributor>(`${WITH_DISTRIBUTOR} WHERE o.id = ?`, [id]);
}

export function getOrderItems(orderId: number): Promise<OrderItem[]> {
  return all<OrderItem>(
    `SELECT oi.*, p.name AS product_name, p.sku
     FROM order_items oi
     JOIN products p ON p.id = oi.product_id
     WHERE oi.order_id = ?
     ORDER BY oi.id`,
    [orderId]
  );
}

export function getOrderStatusHistory(
  orderId: number
): Promise<OrderStatusHistoryRow[]> {
  return all<OrderStatusHistoryRow>(
    `SELECT h.*, u.name AS changed_by_name
     FROM order_status_history h
     JOIN users u ON u.id = h.changed_by
     WHERE h.order_id = ?
     ORDER BY h.changed_at ASC`,
    [orderId]
  );
}

export async function getPendingApprovalCount(): Promise<number> {
  const row = await get<{ n: number }>(
    "SELECT COUNT(*) AS n FROM orders WHERE status = 'submitted'"
  );
  return row?.n ?? 0;
}

export interface CreateOrderInput {
  distributorId: number;
  requestedDeliveryDate?: string | null;
  items: { productId: number; quantity: number }[];
  createdBy: number;
}

/**
 * Creates a draft order with its line items and an initial status-history
 * row, all in one atomic batch. The order's id isn't known until the insert
 * runs, so item/history rows locate it via a `(SELECT id FROM orders WHERE
 * order_number = ...)` subquery on the order_number generated up front,
 * rather than relying on last_insert_rowid() across separate statements.
 */
export async function createOrder(input: CreateOrderInput): Promise<string> {
  if (input.items.length === 0) {
    throw new Error("An order needs at least one line item.");
  }

  const next = await get<{ next: number }>(
    "SELECT COALESCE(MAX(id), 0) + 1 AS next FROM orders"
  );
  const orderNumber = `ORD-${String(10000 + (next?.next ?? 1))}`;

  const productIds = input.items.map((i) => i.productId);
  const placeholders = productIds.map(() => "?").join(",");
  const products = await all<{ id: number; unit_price: number }>(
    `SELECT id, unit_price FROM products WHERE id IN (${placeholders})`,
    productIds
  );
  const priceById = new Map(products.map((p) => [p.id, p.unit_price]));

  const statements: { sql: string; args: QueryArgs }[] = [
    {
      sql: `INSERT INTO orders (order_number, distributor_id, status, requested_delivery_date, created_by)
            VALUES (@order_number, @distributor_id, 'draft', @requested_delivery_date, @created_by)`,
      args: {
        order_number: orderNumber,
        distributor_id: input.distributorId,
        requested_delivery_date: input.requestedDeliveryDate ?? null,
        created_by: input.createdBy,
      },
    },
    ...input.items.map((item) => ({
      sql: `INSERT INTO order_items (order_id, product_id, quantity, unit_price)
            VALUES ((SELECT id FROM orders WHERE order_number = @order_number), @product_id, @quantity, @unit_price)`,
      args: {
        order_number: orderNumber,
        product_id: item.productId,
        quantity: item.quantity,
        unit_price: priceById.get(item.productId) ?? 0,
      },
    })),
    {
      sql: `INSERT INTO order_status_history (order_id, from_status, to_status, note, changed_by)
            VALUES ((SELECT id FROM orders WHERE order_number = @order_number), NULL, 'draft', NULL, @actor)`,
      args: { order_number: orderNumber, actor: input.createdBy },
    },
  ];

  await batch(statements);
  return orderNumber;
}

/**
 * Validates the transition against ORDER_TRANSITIONS, then atomically updates
 * the order and appends a status-history row. Every status change in the app
 * — submit, approve, reject, cancel, fulfil — funnels through this function.
 */
export async function applyOrderTransition(
  orderId: number,
  toStatus: OrderStatus,
  actorUserId: number,
  note?: string | null
): Promise<{ ok: boolean; error?: string }> {
  const order = await get<Order>("SELECT * FROM orders WHERE id = ?", [orderId]);
  if (!order) return { ok: false, error: "Order not found." };
  if (!canTransition(order.status, toStatus)) {
    return {
      ok: false,
      error: `Cannot move an order from ${order.status} to ${toStatus}.`,
    };
  }

  const isDecision = toStatus === "approved" || toStatus === "rejected";

  await batch([
    {
      sql: `UPDATE orders SET
              status = @to,
              submitted_at = CASE WHEN @to = 'submitted' THEN now()::text ELSE submitted_at END,
              decided_at = CASE WHEN @is_decision THEN now()::text ELSE decided_at END,
              decided_by = CASE WHEN @is_decision THEN @actor ELSE decided_by END,
              decision_note = CASE WHEN @note::text IS NOT NULL THEN @note ELSE decision_note END,
              updated_at = now()
            WHERE id = @id`,
      args: {
        id: orderId,
        to: toStatus,
        is_decision: isDecision,
        actor: actorUserId,
        note: note ?? null,
      },
    },
    {
      sql: `INSERT INTO order_status_history (order_id, from_status, to_status, note, changed_by)
            VALUES (@id, @from, @to, @note, @actor)`,
      args: {
        id: orderId,
        from: order.status,
        to: toStatus,
        note: note ?? null,
        actor: actorUserId,
      },
    },
  ]);

  return { ok: true };
}
