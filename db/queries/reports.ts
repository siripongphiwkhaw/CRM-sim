import { get, all, batch } from "../client";
import { getOnHand } from "./inventory";
import { createInsightIfAbsent } from "./insights";

export interface DistributorReport {
  id: number;
  distributor_id: number;
  product_id: number;
  period: string;
  sell_out_qty: number;
  forecast_qty: number;
  recorded_at: string;
}

export interface DistributorReportWithNames extends DistributorReport {
  distributor_name: string;
  product_name: string;
  brand: string;
}

const SORT_COLUMNS: Record<string, string> = {
  distributor: "d.name",
  sellout: "r.sell_out_qty",
  forecast: "r.forecast_qty",
  recorded: "r.recorded_at",
};

export function listDistributorReports(opts?: {
  search?: string;
  distributorId?: number;
  sort?: string;
  dir?: string;
}): Promise<DistributorReportWithNames[]> {
  const clauses: string[] = [];
  const params: (string | number)[] = [];
  if (opts?.search) {
    clauses.push("(d.name LIKE ? OR p.name LIKE ?)");
    params.push(`%${opts.search}%`, `%${opts.search}%`);
  }
  if (opts?.distributorId) {
    clauses.push("r.distributor_id = ?");
    params.push(opts.distributorId);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const column = SORT_COLUMNS[opts?.sort ?? ""] ?? "r.recorded_at";
  const dir = opts?.dir === "asc" ? "ASC" : "DESC";
  return all<DistributorReportWithNames>(
    `SELECT r.*, d.name AS distributor_name, p.name AS product_name, p.brand
     FROM distributor_reports r
     JOIN distributors d ON d.id = r.distributor_id
     JOIN products p ON p.id = r.product_id
     ${where}
     ORDER BY ${column} ${dir}`,
    params
  );
}

export interface ReportSummary {
  total_sell_out: number;
  total_forecast: number;
  record_count: number;
  distributor_count: number;
}

export async function getReportSummary(): Promise<ReportSummary> {
  const row = await get<ReportSummary>(
    `SELECT
       COALESCE(SUM(sell_out_qty), 0) AS total_sell_out,
       COALESCE(SUM(forecast_qty), 0) AS total_forecast,
       COUNT(*) AS record_count,
       COUNT(DISTINCT distributor_id) AS distributor_count
     FROM distributor_reports`
  );
  return (
    row ?? { total_sell_out: 0, total_forecast: 0, record_count: 0, distributor_count: 0 }
  );
}

export interface ReportBreakdownRow {
  channel: string;
  sell_out: number;
  forecast: number;
}

export function getReportBreakdown(): Promise<ReportBreakdownRow[]> {
  return all<ReportBreakdownRow>(
    `SELECT COALESCE(d.channel, 'Unassigned') AS channel,
       COALESCE(SUM(r.sell_out_qty), 0) AS sell_out,
       COALESCE(SUM(r.forecast_qty), 0) AS forecast
     FROM distributor_reports r
     JOIN distributors d ON d.id = r.distributor_id
     GROUP BY d.channel
     ORDER BY sell_out DESC`
  );
}

export interface DistributorReportInput {
  distributor_id: number;
  product_id: number;
  period: string;
  sell_out_qty: number;
  forecast_qty: number;
  created_by?: number | null;
}

export type CreateReportResult =
  | { ok: true }
  | { ok: false; error: "OVER_STOCK"; on_hand: number };

/**
 * Records a sell-out/forecast report and posts a matching negative ledger
 * entry atomically, so on-hand stock never silently drifts from what's
 * actually being reported as sold out downstream. Rejects a sell-out that
 * exceeds current on-hand (can't sell more than was received), and posts a
 * reorder / out-of-stock insight when the resulting stock crosses a threshold.
 */
export async function createDistributorReport(
  input: DistributorReportInput
): Promise<CreateReportResult> {
  const onHand = await getOnHand(input.distributor_id, input.product_id);
  if (input.sell_out_qty > onHand) {
    return { ok: false, error: "OVER_STOCK", on_hand: onHand };
  }

  await batch([
    {
      sql: `INSERT INTO distributor_reports (distributor_id, product_id, period, sell_out_qty, forecast_qty)
            VALUES (@distributor_id, @product_id, @period, @sell_out_qty, @forecast_qty)`,
      args: {
        distributor_id: input.distributor_id,
        product_id: input.product_id,
        period: input.period,
        sell_out_qty: input.sell_out_qty,
        forecast_qty: input.forecast_qty,
      },
    },
    {
      sql: `INSERT INTO inventory_transactions
              (distributor_id, product_id, txn_type, quantity, reference_type, note, created_by)
            VALUES (@distributor_id, @product_id, 'stock_out', @neg_qty, 'sell_out_report', @note, @created_by)`,
      args: {
        distributor_id: input.distributor_id,
        product_id: input.product_id,
        neg_qty: -Math.abs(input.sell_out_qty),
        note: `Sell-out report for ${input.period}`,
        created_by: input.created_by ?? null,
      },
    },
  ]);

  // Post a transactional stock alert if this sell-out crossed a threshold.
  const remaining = await getOnHand(input.distributor_id, input.product_id);
  const meta = await get<{ product_name: string; reorder_point: number; distributor_name: string }>(
    `SELECT p.name AS product_name, p.reorder_point, d.name AS distributor_name
     FROM products p, distributors d WHERE p.id = ? AND d.id = ?`,
    [input.product_id, input.distributor_id]
  );
  if (meta) {
    if (remaining <= 0) {
      await createInsightIfAbsent({
        insight_type: "OUT_OF_STOCK",
        severity: "CRITICAL",
        entity_type: "distributor",
        entity_id: input.distributor_id,
        title: `Out of stock: ${meta.product_name} at ${meta.distributor_name}`,
        description: "On-hand has reached zero after this sell-out.",
        recommendation: `Urgent replenishment of ${meta.product_name}.`,
        confidence: 1,
      });
    } else if (remaining <= meta.reorder_point) {
      const qty = Math.max(12, meta.reorder_point * 2 - remaining);
      await createInsightIfAbsent({
        insight_type: "REORDER_POINT",
        severity: "WARNING",
        entity_type: "distributor",
        entity_id: input.distributor_id,
        title: `Reorder point hit: ${meta.product_name} at ${meta.distributor_name}`,
        description: `On-hand ${remaining} is at/below the reorder point (${meta.reorder_point}).`,
        recommendation: `Replenishment order of ${qty} units.`,
        confidence: 0.9,
      });
    }
  }

  return { ok: true };
}
