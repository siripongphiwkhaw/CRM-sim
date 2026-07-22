import { get, all, batch } from "../client";
import { getNbaForCustomer } from "./insights";
import { behaviorClassFor, channelAffinityFor } from "@/lib/classification";
import type {
  ChurnLevel,
  BehaviorClass,
  ChannelAffinity,
  CustType,
  TxChannel,
} from "@/lib/constants";

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
  behavior_class: BehaviorClass | null;
  primary_channel: TxChannel | null;
  channel_affinity: ChannelAffinity | null;
  calculated_at: string | null;
}

export function getCustomerScore(customerId: number): Promise<CustomerScore | undefined> {
  return get<CustomerScore>("SELECT * FROM customer_scores WHERE customer_id = ?", [customerId]);
}

export interface ClassificationStats {
  scored: number;
  contested: number;
  horeca: number;
  trade: number;
  /** Declared type disagrees with behavioral class — candidates to reclassify. */
  reclassify: number;
}

/** Marketing-dashboard rollup of the classification axes. */
export async function getClassificationStats(): Promise<ClassificationStats> {
  const row = await get<ClassificationStats>(
    `SELECT
       COUNT(*)::int AS scored,
       COALESCE(SUM(CASE WHEN s.channel_affinity = 'CONTESTED' THEN 1 ELSE 0 END), 0)::int AS contested,
       COALESCE(SUM(CASE WHEN s.behavior_class = 'HORECA' THEN 1 ELSE 0 END), 0)::int AS horeca,
       COALESCE(SUM(CASE WHEN s.behavior_class = 'TRADE' THEN 1 ELSE 0 END), 0)::int AS trade,
       COALESCE(SUM(CASE
         WHEN (c.cust_type = 'B2C' AND s.behavior_class IN ('HORECA','TRADE'))
           OR (c.cust_type = 'B2B' AND s.behavior_class = 'CONSUMER')
         THEN 1 ELSE 0 END), 0)::int AS reclassify
     FROM customer_scores s JOIN customers c ON c.id = s.customer_id`
  );
  return row ?? { scored: 0, contested: 0, horeca: 0, trade: 0, reclassify: 0 };
}

interface RawRfm {
  customer_id: number;
  cust_type: CustType;
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
    `SELECT c.id AS customer_id, c.cust_type,
            COALESCE(EXTRACT(DAY FROM (now() - MAX(t.tx_date::timestamptz)))::int, 9999) AS recency_days,
            COUNT(t.id)::int AS frequency,
            COALESCE(SUM(t.amount_thb), 0) AS monetary
       FROM customers c
       LEFT JOIN transactions t ON t.customer_id = c.id
      GROUP BY c.id, c.cust_type`
  );
  if (raw.length === 0) return { scored: 0 };

  // Per-customer channel mix, for affinity + the SFA share the behavioral
  // classifier needs. One grouped read, folded into a map keyed by customer.
  const channelRows = await all<{ customer_id: number; channel: TxChannel; n: number }>(
    `SELECT customer_id, channel, COUNT(*)::int AS n
       FROM transactions GROUP BY customer_id, channel`
  );
  const channelByCustomer = new Map<number, Partial<Record<TxChannel, number>>>();
  for (const r of channelRows) {
    const m = channelByCustomer.get(r.customer_id) ?? {};
    m[r.channel] = r.n;
    channelByCustomer.set(r.customer_id, m);
  }

  const rScores = quintileScores(raw.map((r) => r.recency_days), false);
  const fScores = quintileScores(raw.map((r) => r.frequency), true);
  const mScores = quintileScores(raw.map((r) => r.monetary), true);
  const nbaResults = await Promise.all(raw.map((r) => getNbaForCustomer(r.customer_id)));

  const statements = raw.map((row, i) => {
    const counts = channelByCustomer.get(row.customer_id) ?? {};
    const total = Object.values(counts).reduce((sum, n) => sum + (n ?? 0), 0);
    const sfaShare = total > 0 ? (counts.SFA ?? 0) / total : 0;
    const behavior = behaviorClassFor({
      custType: row.cust_type,
      frequency: row.frequency,
      monetary: row.monetary,
      sfaShare,
    });
    const { primaryChannel, affinity } = channelAffinityFor(counts);

    return {
      sql: `INSERT INTO customer_scores
              (customer_id, rfm_recency, rfm_frequency, rfm_monetary, rfm_cell, churn_score,
               nba_action, behavior_class, primary_channel, channel_affinity, calculated_at)
            VALUES (@cid, @r, @f, @m, @cell, @churn, @nba, @behavior, @primary, @affinity, now())
            ON CONFLICT (customer_id) DO UPDATE SET
              rfm_recency = EXCLUDED.rfm_recency, rfm_frequency = EXCLUDED.rfm_frequency,
              rfm_monetary = EXCLUDED.rfm_monetary, rfm_cell = EXCLUDED.rfm_cell,
              churn_score = EXCLUDED.churn_score, nba_action = EXCLUDED.nba_action,
              behavior_class = EXCLUDED.behavior_class, primary_channel = EXCLUDED.primary_channel,
              channel_affinity = EXCLUDED.channel_affinity, calculated_at = EXCLUDED.calculated_at`,
      args: {
        cid: row.customer_id,
        r: rScores[i],
        f: fScores[i],
        m: mScores[i],
        cell: `${rScores[i]}${fScores[i]}${mScores[i]}`,
        churn: churnFor(row.recency_days, row.frequency),
        nba: nbaResults[i].action,
        behavior,
        primary: primaryChannel,
        affinity,
      },
    };
  });
  await batch(statements);
  return { scored: raw.length };
}
