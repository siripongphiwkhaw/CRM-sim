import { get, all } from "../client";

export interface ChannelRecord {
  id: number;
  dealer_name: string;
  product_id: number | null;
  channel: string | null;
  sell_out_qty: number;
  stock_on_hand: number;
  forecast_qty: number;
  recorded_at: string;
}

export interface ChannelRecordWithProduct extends ChannelRecord {
  product_name: string | null;
  brand: string | null;
}

// Trade channels present in the seed data (used for filters).
export const TRADE_CHANNELS = [
  "Modern Trade",
  "Traditional Trade",
  "E-Commerce",
  "Food Service",
] as const;

const SORT_COLUMNS: Record<string, string> = {
  dealer: "cr.dealer_name",
  sellout: "cr.sell_out_qty",
  stock: "cr.stock_on_hand",
  forecast: "cr.forecast_qty",
  recorded: "cr.recorded_at",
};

export function listChannelRecords(opts?: {
  search?: string;
  channel?: string;
  sort?: string;
  dir?: string;
}): Promise<ChannelRecordWithProduct[]> {
  const clauses: string[] = [];
  const params: (string | number)[] = [];
  if (opts?.search) {
    clauses.push("(cr.dealer_name LIKE ? OR p.name LIKE ?)");
    params.push(`%${opts.search}%`, `%${opts.search}%`);
  }
  if (opts?.channel) {
    clauses.push("cr.channel = ?");
    params.push(opts.channel);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const column = SORT_COLUMNS[opts?.sort ?? ""] ?? "cr.recorded_at";
  const dir = opts?.dir === "asc" ? "ASC" : "DESC";
  return all<ChannelRecordWithProduct>(
    `SELECT cr.*, p.name AS product_name, p.brand AS brand
     FROM channel_records cr
     LEFT JOIN products p ON p.id = cr.product_id
     ${where}
     ORDER BY ${column} ${dir}`,
    params
  );
}

export function listChannelRecordsByProduct(
  productId: number
): Promise<ChannelRecordWithProduct[]> {
  return all<ChannelRecordWithProduct>(
    `SELECT cr.*, p.name AS product_name, p.brand AS brand
     FROM channel_records cr
     LEFT JOIN products p ON p.id = cr.product_id
     WHERE cr.product_id = ?
     ORDER BY cr.recorded_at DESC`,
    [productId]
  );
}

export interface ChannelSummary {
  total_sell_out: number;
  total_stock: number;
  total_forecast: number;
  record_count: number;
  dealer_count: number;
}

export async function getChannelSummary(): Promise<ChannelSummary> {
  const row = await get<ChannelSummary>(
    `SELECT
       COALESCE(SUM(sell_out_qty), 0) AS total_sell_out,
       COALESCE(SUM(stock_on_hand), 0) AS total_stock,
       COALESCE(SUM(forecast_qty), 0) AS total_forecast,
       COUNT(*) AS record_count,
       COUNT(DISTINCT dealer_name) AS dealer_count
     FROM channel_records`
  );
  return (
    row ?? {
      total_sell_out: 0,
      total_stock: 0,
      total_forecast: 0,
      record_count: 0,
      dealer_count: 0,
    }
  );
}

export interface ChannelBreakdownRow {
  channel: string;
  sell_out: number;
  forecast: number;
}

export function getChannelBreakdown(): Promise<ChannelBreakdownRow[]> {
  return all<ChannelBreakdownRow>(
    `SELECT COALESCE(channel, 'Unassigned') AS channel,
       COALESCE(SUM(sell_out_qty), 0) AS sell_out,
       COALESCE(SUM(forecast_qty), 0) AS forecast
     FROM channel_records
     GROUP BY channel
     ORDER BY sell_out DESC`
  );
}
