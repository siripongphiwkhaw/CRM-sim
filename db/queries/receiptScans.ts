import { get, all, run } from "../client";
import type { MatchedLine, ScanMatchStatus } from "@/lib/receiptMatch";

export interface ReceiptScan {
  id: number;
  scan_type: "order_verification" | "retail_audit";
  order_id: number | null;
  store_name: string | null;
  channel: string | null;
  receipt_date: string | null;
  receipt_total: number | null;
  currency: string | null;
  raw_summary: string | null;
  match_status: ScanMatchStatus;
  note: string | null;
  created_by: number | null;
  created_at: string;
}

export interface ReceiptScanWithMeta extends ReceiptScan {
  created_by_name: string | null;
  order_number: string | null;
  line_count: number;
  matched_count: number;
}

export interface ReceiptScanLine {
  id: number;
  scan_id: number;
  product_id: number | null;
  ocr_name: string;
  quantity: number | null;
  unit_price: number | null;
  line_total: number | null;
  match_status: MatchedLine["matchStatus"];
  expected_quantity: number | null;
  expected_price: number | null;
  product_name: string | null;
  sku: string | null;
}

export interface ReceiptScanInput {
  scan_type: "order_verification" | "retail_audit";
  order_id?: number | null;
  store_name?: string | null;
  channel?: string | null;
  receipt_date?: string | null;
  receipt_total?: number | null;
  currency?: string | null;
  raw_summary?: string | null;
  match_status: ScanMatchStatus;
  note?: string | null;
  created_by?: number | null;
  lines: MatchedLine[];
}

export async function createReceiptScan(input: ReceiptScanInput): Promise<number> {
  const scanId = await run(
    `INSERT INTO receipt_scans
       (scan_type, order_id, store_name, channel, receipt_date, receipt_total, currency, raw_summary, match_status, note, created_by)
     VALUES (@scan_type, @order_id, @store_name, @channel, @receipt_date, @receipt_total, @currency, @raw_summary, @match_status, @note, @created_by)
     RETURNING id`,
    {
      scan_type: input.scan_type,
      order_id: input.order_id ?? null,
      store_name: input.store_name ?? null,
      channel: input.channel ?? null,
      receipt_date: input.receipt_date ?? null,
      receipt_total: input.receipt_total ?? null,
      currency: input.currency ?? null,
      raw_summary: input.raw_summary ?? null,
      match_status: input.match_status,
      note: input.note ?? null,
      created_by: input.created_by ?? null,
    }
  );
  for (const line of input.lines) {
    await run(
      `INSERT INTO receipt_scan_lines
         (scan_id, product_id, ocr_name, quantity, unit_price, line_total, match_status, expected_quantity, expected_price)
       VALUES (@scan_id, @product_id, @ocr_name, @quantity, @unit_price, @line_total, @match_status, @expected_quantity, @expected_price)`,
      {
        scan_id: scanId,
        product_id: line.productId,
        ocr_name: line.ocrName,
        quantity: line.quantity,
        unit_price: line.unitPrice,
        line_total: line.lineTotal,
        match_status: line.matchStatus,
        expected_quantity: line.expectedQuantity,
        expected_price: line.expectedPrice,
      }
    );
  }
  return scanId;
}

const SCAN_SELECT = `
  SELECT s.*, u.name AS created_by_name, o.order_number,
    (SELECT COUNT(*) FROM receipt_scan_lines l WHERE l.scan_id = s.id) AS line_count,
    (SELECT COUNT(*) FROM receipt_scan_lines l WHERE l.scan_id = s.id AND l.match_status = 'matched') AS matched_count
  FROM receipt_scans s
  LEFT JOIN users u ON u.id = s.created_by
  LEFT JOIN orders o ON o.id = s.order_id`;

export function listReceiptScans(opts?: {
  scanType?: "order_verification" | "retail_audit";
  orderId?: number;
  search?: string;
}): Promise<ReceiptScanWithMeta[]> {
  const clauses: string[] = [];
  const params: (string | number)[] = [];
  if (opts?.scanType) {
    clauses.push("s.scan_type = ?");
    params.push(opts.scanType);
  }
  if (opts?.orderId) {
    clauses.push("s.order_id = ?");
    params.push(opts.orderId);
  }
  if (opts?.search) {
    clauses.push("(s.store_name LIKE ? OR o.order_number LIKE ?)");
    params.push(`%${opts.search}%`, `%${opts.search}%`);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  return all<ReceiptScanWithMeta>(
    `${SCAN_SELECT} ${where} ORDER BY s.created_at DESC, s.id DESC`,
    params
  );
}

export function getReceiptScan(id: number): Promise<ReceiptScanWithMeta | undefined> {
  return get<ReceiptScanWithMeta>(`${SCAN_SELECT} WHERE s.id = ?`, [id]);
}

export function getReceiptScanLines(scanId: number): Promise<ReceiptScanLine[]> {
  return all<ReceiptScanLine>(
    `SELECT l.*, p.name AS product_name, p.sku
     FROM receipt_scan_lines l
     LEFT JOIN products p ON p.id = l.product_id
     WHERE l.scan_id = ?
     ORDER BY l.id`,
    [scanId]
  );
}

export interface AuditSummary {
  scan_count: number;
  store_count: number;
  own_item_lines: number;
  top_store: string | null;
}

export async function getAuditSummary(): Promise<AuditSummary> {
  const base = await get<{ scan_count: number; store_count: number }>(
    `SELECT COUNT(*) AS scan_count, COUNT(DISTINCT store_name) AS store_count
     FROM receipt_scans WHERE scan_type = 'retail_audit'`
  );
  const lines = await get<{ own_item_lines: number }>(
    `SELECT COUNT(*) AS own_item_lines
     FROM receipt_scan_lines l
     JOIN receipt_scans s ON s.id = l.scan_id
     WHERE s.scan_type = 'retail_audit' AND l.match_status = 'matched'`
  );
  const top = await get<{ store_name: string }>(
    `SELECT s.store_name, COUNT(*) AS sightings
     FROM receipt_scan_lines l
     JOIN receipt_scans s ON s.id = l.scan_id
     WHERE s.scan_type = 'retail_audit' AND l.match_status = 'matched' AND s.store_name IS NOT NULL
     GROUP BY s.store_name
     ORDER BY sightings DESC
     LIMIT 1`
  );
  return {
    scan_count: base?.scan_count ?? 0,
    store_count: base?.store_count ?? 0,
    own_item_lines: lines?.own_item_lines ?? 0,
    top_store: top?.store_name ?? null,
  };
}

/** Sightings of own products grouped by store — the "who sells my items" view. */
export interface StoreSightingRow {
  store_name: string;
  channel: string | null;
  scan_count: number;
  own_item_lines: number;
  last_seen: string;
}

export function listStoreSightings(): Promise<StoreSightingRow[]> {
  return all<StoreSightingRow>(
    `SELECT s.store_name, MAX(s.channel) AS channel,
       COUNT(DISTINCT s.id) AS scan_count,
       COALESCE(SUM(CASE WHEN l.match_status = 'matched' THEN 1 ELSE 0 END), 0) AS own_item_lines,
       MAX(s.created_at) AS last_seen
     FROM receipt_scans s
     LEFT JOIN receipt_scan_lines l ON l.scan_id = s.id
     WHERE s.scan_type = 'retail_audit' AND s.store_name IS NOT NULL
     GROUP BY s.store_name
     ORDER BY own_item_lines DESC, scan_count DESC`
  );
}
