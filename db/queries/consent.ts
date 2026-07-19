import { get, all, run } from "../client";
import { CONSENT_PURPOSES, type ConsentPurpose, type ConsentStatus } from "@/lib/constants";

export interface ConsentRow {
  id: number;
  customer_id: number;
  purpose: ConsentPurpose;
  status: ConsentStatus;
  source: string | null;
  note: string | null;
  captured_at: string;
}

/** Latest consent row per purpose for a customer (current effective status). */
export async function getCurrentConsents(
  customerId: number
): Promise<Partial<Record<ConsentPurpose, ConsentRow>>> {
  const rows = await all<ConsentRow>(
    `SELECT c.* FROM consents c
     JOIN (
       SELECT purpose, MAX(captured_at) AS mx, MAX(id) AS mid
       FROM consents WHERE customer_id = @cid GROUP BY purpose
     ) latest ON latest.purpose = c.purpose AND c.id = latest.mid
     WHERE c.customer_id = @cid`,
    { cid: customerId }
  );
  const result: Partial<Record<ConsentPurpose, ConsentRow>> = {};
  for (const row of rows) result[row.purpose] = row;
  return result;
}

export async function hasMarketingConsent(customerId: number): Promise<boolean> {
  const current = await getCurrentConsents(customerId);
  return current.MARKETING?.status === "GRANTED";
}

export interface ConsentInput {
  customer_id: number;
  purpose: ConsentPurpose;
  status: ConsentStatus;
  source?: string | null;
  note?: string | null;
}

export function recordConsent(input: ConsentInput): Promise<number> {
  return run(
    `INSERT INTO consents (customer_id, purpose, status, source, note)
     VALUES (@cid, @purpose, @status, @source, @note)`,
    {
      cid: input.customer_id,
      purpose: input.purpose,
      status: input.status,
      source: input.source ?? "staff",
      note: input.note ?? null,
    }
  );
}

export function listConsentHistory(customerId: number): Promise<ConsentRow[]> {
  return all<ConsentRow>(
    "SELECT * FROM consents WHERE customer_id = ? ORDER BY captured_at DESC, id DESC",
    [customerId]
  );
}

export interface ConsentGapStats {
  total_members: number;
  granted: number;
  without_marketing: number;
  pct: number; // percent WITHOUT marketing consent
}

export async function getConsentGapStats(): Promise<ConsentGapStats> {
  const total = await get<{ n: number }>("SELECT COUNT(*) AS n FROM customers");
  const granted = await get<{ n: number }>(
    `SELECT COUNT(*) AS n FROM (
       SELECT c.customer_id FROM consents c
       JOIN (
         SELECT customer_id, MAX(id) AS mid FROM consents
         WHERE purpose='MARKETING' GROUP BY customer_id
       ) latest ON c.id = latest.mid
       WHERE c.status='GRANTED'
     )`
  );
  const totalN = total?.n ?? 0;
  const grantedN = granted?.n ?? 0;
  const without = totalN - grantedN;
  return {
    total_members: totalN,
    granted: grantedN,
    without_marketing: without,
    pct: totalN > 0 ? Math.round((without / totalN) * 100) : 0,
  };
}

/** For the admin governance panel: counts of current GRANTED per purpose. */
export async function getConsentPurposeStats(): Promise<
  { purpose: ConsentPurpose; granted: number; total: number }[]
> {
  const total = await get<{ n: number }>("SELECT COUNT(*) AS n FROM customers");
  const totalN = total?.n ?? 0;
  const out: { purpose: ConsentPurpose; granted: number; total: number }[] = [];
  for (const purpose of CONSENT_PURPOSES) {
    const g = await get<{ n: number }>(
      `SELECT COUNT(*) AS n FROM (
         SELECT c.customer_id FROM consents c
         JOIN (
           SELECT customer_id, MAX(id) AS mid FROM consents
           WHERE purpose=@p GROUP BY customer_id
         ) latest ON c.id = latest.mid
         WHERE c.status='GRANTED'
       )`,
      { p: purpose }
    );
    out.push({ purpose, granted: g?.n ?? 0, total: totalN });
  }
  return out;
}
