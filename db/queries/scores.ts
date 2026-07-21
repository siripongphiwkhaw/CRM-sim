import { get, all, batch } from "../client";
import { getNbaForCustomer } from "./insights";
import type { ChurnLevel } from "@/lib/constants";

/**
 * RFM (Recency/Frequency/Monetary) + churn scoring. Recomputed on demand
 * (mirrors generateInsights()) rather than on a schedule — see the Version 2
 * plan's "on-demand jobs, no scheduler yet" note.
 */

export interface CustomerScore {
  customer_id: number;
  rfm_recency: number | null;
  rfm_frequency: number | null;
  rfm_monetary: number | null;
  rfm_cell: string | null;
  churn_score: ChurnLevel | null;
  nba_action: string | null;
  calculated_at: string | null;
}

export function getCustomerScore(customerId: number): Promise<CustomerScore | undefined> {
  return get<CustomerScore>("SELECT * FROM customer_scores WHERE customer_id = ?", [customerId]);
}

interface RawRfm {
  customer_id: number;
  recency_days: number;
  frequency: number;
  monetary: number;
}

/**
 * Ranks `values` into quintile buckets 1–5 (5 = best), aligned with the input
 * order. Ranked in JS rather than SQL NTILE — one less dialect surprise on
 * top of this codebase's already-idiosyncratic mixed-format timestamp text.
 */
function quintileScores(values: number[], higherIsBetter: boolean): number[] {
  const n = values.length;
  if (n === 0) return [];
  const order = values
    .map((_, i) => i)
    .sort((a, b) => (higherIsBetter ? values[b] - values[a] : values[a] - values[b]));
  const scores = new Array<number>(n);
  order.forEach((idx, rank) => {
    scores[idx] = Math.max(1, Math.min(5, 5 - Math.floor((rank * 5) / n)));
  });
  return scores;
}

/**
 * Deterministic churn rule (documented, not a trained model): quiet AND
 * infrequent is High risk; quiet alone is Medium; anything more recent than
 * that is Low.
 */
function churnFor(recencyDays: number, frequency: number): ChurnLevel {
  if (recencyDays > 90 && frequency < 2) return "High";
  if (recencyDays > 60) return "Medium";
  return "Low";
}

export async function recomputeScores(): Promise<{ scored: number }> {
  const raw = await all<RawRfm>(
    `SELECT c.id AS customer_id,
            COALESCE(EXTRACT(DAY FROM (now() - MAX(t.tx_date::timestamptz)))::int, 9999) AS recency_days,
            COUNT(t.id)::int AS frequency,
            COALESCE(SUM(t.amount_thb), 0) AS monetary
       FROM customers c
       LEFT JOIN transactions t ON t.customer_id = c.id
      GROUP BY c.id`
  );
  if (raw.length === 0) return { scored: 0 };

  const rScores = quintileScores(raw.map((r) => r.recency_days), false);
  const fScores = quintileScores(raw.map((r) => r.frequency), true);
  const mScores = quintileScores(raw.map((r) => r.monetary), true);
  const nbaResults = await Promise.all(raw.map((r) => getNbaForCustomer(r.customer_id)));

  const statements = raw.map((row, i) => ({
    sql: `INSERT INTO customer_scores
            (customer_id, rfm_recency, rfm_frequency, rfm_monetary, rfm_cell, churn_score, nba_action, calculated_at)
          VALUES (@cid, @r, @f, @m, @cell, @churn, @nba, now())
          ON CONFLICT (customer_id) DO UPDATE SET
            rfm_recency = EXCLUDED.rfm_recency, rfm_frequency = EXCLUDED.rfm_frequency,
            rfm_monetary = EXCLUDED.rfm_monetary, rfm_cell = EXCLUDED.rfm_cell,
            churn_score = EXCLUDED.churn_score, nba_action = EXCLUDED.nba_action,
            calculated_at = EXCLUDED.calculated_at`,
    args: {
      cid: row.customer_id,
      r: rScores[i],
      f: fScores[i],
      m: mScores[i],
      cell: `${rScores[i]}${fScores[i]}${mScores[i]}`,
      churn: churnFor(row.recency_days, row.frequency),
      nba: nbaResults[i].action,
    },
  }));
  await batch(statements);
  return { scored: raw.length };
}
