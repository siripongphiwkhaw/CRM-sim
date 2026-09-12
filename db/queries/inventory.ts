import { get, all, run } from "../client";
import type { StockType } from "@/lib/constants";

export type InventoryTxnType = "stock_in" | "stock_out" | "adjustment";
export type InventoryReferenceType = "delivery_plan" | "sell_out_report" | "manual";

// The default plant / storage location every pre-existing ledger row is
// backfilled onto (db/schema.ts), and where new movements land until a
// location-aware UI exists. Seeded unconditionally on every cold start.
export const DEFAULT_PLANT_CODE = "1000";
export const DEFAULT_SLOC_CODE = "0001";

/** Resolves the seeded default { plant_id, storage_location_id }. Throws if the
 * schema-level seed did not run — that would be a broken migration, not a
 * recoverable state. */
export async function getDefaultLocation(): Promise<{
  plant_id: number;
  storage_location_id: number;
}> {
  const row = await get<{ plant_id: number; storage_location_id: number }>(
    `SELECT p.id AS plant_id, s.id AS storage_location_id
     FROM plants p
     JOIN storage_locations s ON s.plant_id = p.id
     WHERE p.plant_code = ? AND s.sloc_code = ?`,
    [DEFAULT_PLANT_CODE, DEFAULT_SLOC_CODE]
  );
  if (!row) {
    throw new Error(
      `Default stock location ${DEFAULT_PLANT_CODE}/${DEFAULT_SLOC_CODE} is missing — schema seed did not run.`
    );
  }
  return row;
}

export interface InventoryTransaction {
  id: number;
  distributor_id: number;
  product_id: number;
  txn_type: InventoryTxnType;
  quantity: number;
  reference_type: InventoryReferenceType | null;
  reference_id: number | null;
  note: string | null;
  created_by: number | null;
  plant_id: number | null;
  storage_location_id: number | null;
  stock_type: StockType;
  occurred_at: string;
}

export interface InventoryTransactionWithNames extends InventoryTransaction {
  distributor_name: string;
  product_name: string;
  sku: string;
}

export interface OnHandRow {
  product_id: number;
  sku: string;
  name: string;
  brand: string;
  on_hand: number;
}

/** On-hand is always COALESCE(SUM(quantity),0) — never a maintained column.
 * Sellable stock only: quality-inspection, blocked and in-transit quantities
 * are excluded here and surface separately in the stock overview. */
export async function getOnHand(
  distributorId: number,
  productId: number
): Promise<number> {
  const row = await get<{ on_hand: number }>(
    `SELECT COALESCE(SUM(quantity), 0) AS on_hand FROM inventory_transactions
     WHERE distributor_id = ? AND product_id = ? AND stock_type = 'UNRESTRICTED'`,
    [distributorId, productId]
  );
  return row?.on_hand ?? 0;
}

export function listOnHandByDistributor(
  distributorId: number
): Promise<OnHandRow[]> {
  return all<OnHandRow>(
    `SELECT p.id AS product_id, p.sku, p.name, p.brand,
       COALESCE(SUM(it.quantity), 0) AS on_hand
     FROM products p
     JOIN inventory_transactions it ON it.product_id = p.id AND it.distributor_id = ?
       AND it.stock_type = 'UNRESTRICTED'
     GROUP BY p.id
     HAVING COALESCE(SUM(it.quantity), 0) != 0
     ORDER BY p.name`,
    [distributorId]
  );
}

export interface StockWithReorderRow {
  product_id: number;
  sku: string;
  product_name: string;
  on_hand: number;
  reorder_point: number;
  below_reorder: number;
}

/** On-hand per product for one dealer, with reorder-point flags. */
export function listStockWithReorder(distributorId: number): Promise<StockWithReorderRow[]> {
  return all<StockWithReorderRow>(
    `SELECT p.id AS product_id, p.sku, p.name AS product_name, p.reorder_point,
       COALESCE(SUM(it.quantity), 0) AS on_hand,
       CASE WHEN COALESCE(SUM(it.quantity), 0) <= p.reorder_point THEN 1 ELSE 0 END AS below_reorder
     FROM products p
     JOIN inventory_transactions it ON it.product_id = p.id AND it.distributor_id = ?
       AND it.stock_type = 'UNRESTRICTED'
     GROUP BY p.id
     HAVING COALESCE(SUM(it.quantity), 0) != 0
        OR COALESCE(SUM(it.quantity), 0) <= p.reorder_point
     ORDER BY below_reorder DESC, p.name`,
    [distributorId]
  );
}

export interface OnHandByDistributorRow {
  distributor_id: number;
  distributor_name: string;
  product_id: number;
  product_name: string;
  sku: string;
  on_hand: number;
}

/** Full on-hand matrix (every distributor × product with nonzero stock). */
export function listOnHandSummary(): Promise<OnHandByDistributorRow[]> {
  return all<OnHandByDistributorRow>(
    `SELECT it.distributor_id, d.name AS distributor_name,
       it.product_id, p.name AS product_name, p.sku,
       SUM(it.quantity) AS on_hand
     FROM inventory_transactions it
     JOIN distributors d ON d.id = it.distributor_id
     JOIN products p ON p.id = it.product_id
     WHERE it.stock_type = 'UNRESTRICTED'
     GROUP BY it.distributor_id, d.name, it.product_id, p.name, p.sku
     HAVING SUM(it.quantity) != 0
     ORDER BY d.name, p.name`
  );
}

export async function getTotalOnHandValue(): Promise<number> {
  const row = await get<{ total: number }>(
    `SELECT COALESCE(SUM(it.quantity * p.unit_price), 0) AS total
     FROM inventory_transactions it
     JOIN products p ON p.id = it.product_id
     WHERE it.stock_type = 'UNRESTRICTED'`
  );
  return row?.total ?? 0;
}

export function listInventoryTransactions(opts?: {
  distributorId?: number;
  productId?: number;
  txnType?: string;
}): Promise<InventoryTransactionWithNames[]> {
  const clauses: string[] = [];
  const params: (string | number)[] = [];
  if (opts?.distributorId) {
    clauses.push("it.distributor_id = ?");
    params.push(opts.distributorId);
  }
  if (opts?.productId) {
    clauses.push("it.product_id = ?");
    params.push(opts.productId);
  }
  if (opts?.txnType) {
    clauses.push("it.txn_type = ?");
    params.push(opts.txnType);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  return all<InventoryTransactionWithNames>(
    `SELECT it.*, d.name AS distributor_name, p.name AS product_name, p.sku
     FROM inventory_transactions it
     JOIN distributors d ON d.id = it.distributor_id
     JOIN products p ON p.id = it.product_id
     ${where}
     ORDER BY it.occurred_at DESC
     LIMIT 200`,
    params
  );
}

export interface InventoryTransactionInput {
  distributor_id: number;
  product_id: number;
  txn_type: InventoryTxnType;
  quantity: number;
  reference_type?: InventoryReferenceType | null;
  reference_id?: number | null;
  note?: string | null;
  created_by?: number | null;
  /** Defaults to the seeded default location when omitted. */
  plant_id?: number | null;
  storage_location_id?: number | null;
  /** Defaults to UNRESTRICTED (matches the column default). */
  stock_type?: StockType;
}

export async function recordInventoryTransaction(
  input: InventoryTransactionInput
): Promise<number> {
  const loc =
    input.plant_id != null && input.storage_location_id != null
      ? { plant_id: input.plant_id, storage_location_id: input.storage_location_id }
      : await getDefaultLocation();
  return run(
    `INSERT INTO inventory_transactions
       (distributor_id, product_id, txn_type, quantity, reference_type, reference_id, note, created_by,
        plant_id, storage_location_id, stock_type)
     VALUES
       (@distributor_id, @product_id, @txn_type, @quantity, @reference_type, @reference_id, @note, @created_by,
        @plant_id, @storage_location_id, @stock_type)
     RETURNING id`,
    {
      distributor_id: input.distributor_id,
      product_id: input.product_id,
      txn_type: input.txn_type,
      quantity: input.quantity,
      reference_type: input.reference_type ?? null,
      reference_id: input.reference_id ?? null,
      note: input.note ?? null,
      created_by: input.created_by ?? null,
      plant_id: loc.plant_id,
      storage_location_id: loc.storage_location_id,
      stock_type: input.stock_type ?? "UNRESTRICTED",
    }
  );
}
