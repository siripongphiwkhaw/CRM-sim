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

export function listChannelRecords(opts?: {
  search?: string;
}): Promise<ChannelRecordWithProduct[]> {
  const where = opts?.search
    ? "WHERE cr.dealer_name LIKE ? OR p.name LIKE ?"
    : "";
  const params = opts?.search
    ? [`%${opts.search}%`, `%${opts.search}%`]
    : [];
  return all<ChannelRecordWithProduct>(
    `SELECT cr.*, p.name AS product_name, p.brand AS brand
     FROM channel_records cr
     LEFT JOIN products p ON p.id = cr.product_id
     ${where}
     ORDER BY cr.recorded_at DESC`,
    params
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
