import { get, all, batch } from "../client";
import { getNbaForCustomer } from "./insights";
import { classifyCustomer, channelAffinityFor, type PeerContext } from "@/lib/classification";
import type {
  ChurnLevel,
  BehaviorClass,
  ChannelAffinity,
  CustType,
  TxChannel,
  ResolutionTier,
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
  /** Which evidence tier decided the class — see lib/classification.ts. */
  resolution_tier: ResolutionTier | null;
  /** 1 when the tiers pointed different ways and a human should review. */
  disagreement_flag: number | null;
  weekday_share: number | null;
  max_pack_size: number | null;
  distinct_skus: number | null;
  calculated_at: string | null;
}

export function getCustomerScore(customerId: number): Promise<CustomerScore | undefined> {
  return get<CustomerScore>("SELECT * FROM customer_scores WHERE customer_id = ?", [customerId]);
}

export interface ClassificationStats {
  scored: number;
  contested: number;
  horeca: number;
  /** TRADITIONAL_TRADE + MODERN_TRADE + WHOLESALER combined. */
  trade: number;
  /** Declared type disagrees with behavioral class — candidates to reclassify. */
  reclassify: number;
}

/**
 * Marketing-dashboard rollup of the classification axes.
 *
 * These predicates are written as "anything that is not CONSUMER" rather than
 * listing class names, because a SQL string literal is invisible to the
 * TypeScript compiler: when the taxonomy grew from three classes to six, an
 * `IN ('HORECA','TRADE')` list kept compiling happily while silently counting
 * the wrong rows. Negating CONSUMER cannot rot the same way.
 */
export async function getClassificationStats(): Promise<ClassificationStats> {
  const row = await get<ClassificationStats>(
    `SELECT
       COUNT(*)::int AS scored,
       COALESCE(SUM(CASE WHEN s.channel_affinity = 'CONTESTED' THEN 1 ELSE 0 END), 0)::int AS contested,
       COALESCE(SUM(CASE WHEN s.behavior_class = 'HORECA' THEN 1 ELSE 0 END), 0)::int AS horeca,
       COALESCE(SUM(CASE
         WHEN s.behavior_class IS NOT NULL
          AND s.behavior_class NOT IN ('CONSUMER','HORECA','INSTITUTIONAL')
         THEN 1 ELSE 0 END), 0)::int AS trade,
       COALESCE(SUM(CASE
         WHEN (c.cust_type = 'B2C' AND s.behavior_class IS NOT NULL AND s.behavior_class <> 'CONSUMER')
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

/** Rolling window the CLASSIFIER judges on. RFM/churn deliberately keep using
 * all-time figures — "what they're worth" and "what they are right now" are
 * different questions, and a closed restaurant should stop reading as HoReCa
 * without also erasing its lifetime value. */
export const CLASSIFY_WINDOW_DAYS = 90;

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

  // --- Classification inputs, all on the rolling window --------------------

  const windowRows = await all<{
    customer_id: number;
    frequency: number;
    monetary: number;
    weekday_share: number | null;
  }>(
    `SELECT customer_id,
            COUNT(*)::int AS frequency,
            COALESCE(SUM(amount_thb), 0) AS monetary,
            AVG(CASE WHEN EXTRACT(ISODOW FROM tx_date::timestamptz) <= 5 THEN 1.0 ELSE 0.0 END) AS weekday_share
       FROM transactions
      WHERE tx_date::timestamptz > now() - make_interval(days => ${CLASSIFY_WINDOW_DAYS})
      GROUP BY customer_id`
  );
  const windowByCustomer = new Map(windowRows.map((r) => [r.customer_id, r]));

  // Line-item signals. transaction_items may be empty (it is populated going
  // forward, never backfilled), in which case pack size stays null and the
  // classifier simply has one fewer piece of evidence.
  const itemRows = await all<{ customer_id: number; max_pack_size: number | null; distinct_skus: number }>(
    `SELECT t.customer_id,
            MAX(ti.pack_size) AS max_pack_size,
            COUNT(DISTINCT ti.product_id)::int AS distinct_skus
       FROM transaction_items ti
       JOIN transactions t ON t.id = ti.transaction_id
      WHERE t.tx_date::timestamptz > now() - make_interval(days => ${CLASSIFY_WINDOW_DAYS})
      GROUP BY t.customer_id`
  );
  const itemsByCustomer = new Map(itemRows.map((r) => [r.customer_id, r]));

  // Tier 1 — verified identity. Only the derived entity type is read here;
  // the encrypted number itself is never loaded for scoring.
  const identityRows = await all<{
    id: number;
    tax_entity_type: string | null;
    institutional_override: number;
  }>(`SELECT id, tax_entity_type, institutional_override FROM customers`);
  const identityByCustomer = new Map(identityRows.map((r) => [r.id, r]));

  // Tier 2 — dealer anchor.
  const dealerRows = await all<{ customer_id: number; dealer_type: string; channel: string | null }>(
    `SELECT customer_id, dealer_type, channel FROM distributors WHERE customer_id IS NOT NULL`
  );
  const dealerByCustomer = new Map(dealerRows.map((r) => [r.customer_id, r]));

  // Peer context: the 75th-percentile average order value across everyone with
  // activity in the window. Used ONLY when the population is large enough --
  // see MIN_POPULATION_FOR_PERCENTILE, and the note in lib/classification.ts
  // about percentiles always finding a top quartile even among pure consumers.
  const activeAovs = windowRows
    .filter((r) => r.frequency > 0)
    .map((r) => r.monetary / r.frequency)
    .sort((a, b) => a - b);
  const peers: PeerContext = {
    population: activeAovs.length,
    aovP75: activeAovs.length > 0 ? activeAovs[Math.floor(activeAovs.length * 0.75)] ?? null : null,
  };

  const rScores = quintileScores(raw.map((r) => r.recency_days), false);
  const fScores = quintileScores(raw.map((r) => r.frequency), true);
  const mScores = quintileScores(raw.map((r) => r.monetary), true);
  const nbaResults = await Promise.all(raw.map((r) => getNbaForCustomer(r.customer_id)));

  const statements = raw.map((row, i) => {
    const counts = channelByCustomer.get(row.customer_id) ?? {};
    const { primaryChannel, affinity } = channelAffinityFor(counts);

    const window = windowByCustomer.get(row.customer_id);
    const items = itemsByCustomer.get(row.customer_id);
    const identity = identityByCustomer.get(row.customer_id);
    const dealer = dealerByCustomer.get(row.customer_id);

    const resolved = classifyCustomer(
      {
        custType: row.cust_type,
        taxEntityType:
          identity?.tax_entity_type === "JURISTIC" || identity?.tax_entity_type === "NATURAL"
            ? identity.tax_entity_type
            : null,
        dealer: dealer ? { dealerType: dealer.dealer_type, channel: dealer.channel } : null,
        frequency: window?.frequency ?? 0,
        monetary: window?.monetary ?? 0,
        channelCounts: counts,
        maxPackSize: items?.max_pack_size ?? null,
        weekdayShare: window?.weekday_share ?? null,
        institutionalOverride: Boolean(identity?.institutional_override),
      },
      peers
    );

    return {
      sql: `INSERT INTO customer_scores
              (customer_id, rfm_recency, rfm_frequency, rfm_monetary, rfm_cell, churn_score,
               nba_action, behavior_class, primary_channel, channel_affinity,
               resolution_tier, disagreement_flag, weekday_share, max_pack_size, distinct_skus,
               calculated_at)
            VALUES (@cid, @r, @f, @m, @cell, @churn, @nba, @behavior, @primary, @affinity,
                    @tier, @flag, @weekday, @pack, @skus, now())
            ON CONFLICT (customer_id) DO UPDATE SET
              rfm_recency = EXCLUDED.rfm_recency, rfm_frequency = EXCLUDED.rfm_frequency,
              rfm_monetary = EXCLUDED.rfm_monetary, rfm_cell = EXCLUDED.rfm_cell,
              churn_score = EXCLUDED.churn_score, nba_action = EXCLUDED.nba_action,
              behavior_class = EXCLUDED.behavior_class, primary_channel = EXCLUDED.primary_channel,
              channel_affinity = EXCLUDED.channel_affinity,
              resolution_tier = EXCLUDED.resolution_tier,
              disagreement_flag = EXCLUDED.disagreement_flag,
              weekday_share = EXCLUDED.weekday_share, max_pack_size = EXCLUDED.max_pack_size,
              distinct_skus = EXCLUDED.distinct_skus,
              calculated_at = EXCLUDED.calculated_at`,
      args: {
        cid: row.customer_id,
        r: rScores[i],
        f: fScores[i],
        m: mScores[i],
        cell: `${rScores[i]}${fScores[i]}${mScores[i]}`,
        churn: churnFor(row.recency_days, row.frequency),
        nba: nbaResults[i].action,
        behavior: resolved.behaviorClass,
        primary: primaryChannel,
        affinity,
        tier: resolved.tier,
        flag: resolved.disagreement ? 1 : 0,
        weekday: window?.weekday_share ?? null,
        pack: items?.max_pack_size ?? null,
        skus: items?.distinct_skus ?? null,
      },
    };
  });
  await batch(statements);
  return { scored: raw.length };
}
