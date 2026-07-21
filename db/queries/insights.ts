import { get, all, run } from "../client";
import { nextBestAction, type NbaResult } from "@/lib/nba";
import { getConsentGapStats, hasMarketingConsent } from "./consent";
import { getLiabilityStats, getLoyaltySummary } from "./loyalty";
import type { InsightType, InsightSeverity, Tier, CustType } from "@/lib/constants";

export interface Insight {
  id: number;
  insight_type: InsightType;
  severity: InsightSeverity;
  entity_type: "customer" | "distributor" | "product" | "global" | null;
  entity_id: number | null;
  title: string;
  description: string | null;
  recommendation: string | null;
  confidence: number | null;
  dismissed_at: string | null;
  created_at: string;
}

export interface InsightWithEntity extends Insight {
  entity_label: string | null;
}

export function listInsights(opts?: {
  includeDismissed?: boolean;
  type?: string;
}): Promise<Insight[]> {
  const clauses: string[] = [];
  const params: (string | number)[] = [];
  if (!opts?.includeDismissed) clauses.push("dismissed_at IS NULL");
  if (opts?.type) {
    clauses.push("insight_type = ?");
    params.push(opts.type);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const order = `ORDER BY CASE severity
      WHEN 'CRITICAL' THEN 0 WHEN 'WARNING' THEN 1
      WHEN 'OPPORTUNITY' THEN 2 ELSE 3 END, created_at DESC`;
  return all<Insight>(`SELECT * FROM ai_insights ${where} ${order}`, params);
}

export function dismissInsight(id: number): Promise<number> {
  return run("UPDATE ai_insights SET dismissed_at = now() WHERE id = ?", [id]);
}

interface InsightInput {
  insight_type: InsightType;
  severity: InsightSeverity;
  entity_type: Insight["entity_type"];
  entity_id: number | null;
  title: string;
  description?: string | null;
  recommendation?: string | null;
  confidence?: number | null;
}

async function insertInsight(input: InsightInput): Promise<number> {
  return run(
    `INSERT INTO ai_insights
       (insight_type, severity, entity_type, entity_id, title, description, recommendation, confidence)
     VALUES (@type, @sev, @etype, @eid, @title, @desc, @rec, @conf) RETURNING id`,
    {
      type: input.insight_type,
      sev: input.severity,
      etype: input.entity_type,
      eid: input.entity_id,
      title: input.title,
      desc: input.description ?? null,
      rec: input.recommendation ?? null,
      conf: input.confidence ?? null,
    }
  );
}

/** Insert only if no non-dismissed row exists for the same (type, entity). */
export async function createInsightIfAbsent(input: InsightInput): Promise<number | null> {
  const existing = await get<{ id: number }>(
    `SELECT id FROM ai_insights
     WHERE insight_type = @type AND entity_type IS NOT DISTINCT FROM @etype
       AND entity_id IS NOT DISTINCT FROM @eid AND dismissed_at IS NULL LIMIT 1`,
    { type: input.insight_type, etype: input.entity_type, eid: input.entity_id }
  );
  if (existing) return null;
  return insertInsight(input);
}

const ANALYTIC_TYPES = [
  "CHANNEL_CONFLICT",
  "LOW_SELLOUT_RATE",
  "LOW_SELLIN_STOCK",
  "OUT_OF_STOCK",
  "CONSENT_GAP",
  "LIABILITY_HIGH",
  "CHURN_RISK",
  "DEALER_UNLINKED",
];

/**
 * Rebuilds the eight analytic insight types from current data. Transactional
 * stock alerts (REORDER_POINT, and inline OUT_OF_STOCK from sell-out) are left
 * untouched. Dismissed rows stay dismissed (only non-dismissed analytic rows
 * are cleared before regeneration).
 */
export async function generateInsights(): Promise<{ created: number }> {
  await run(
    `DELETE FROM ai_insights
     WHERE dismissed_at IS NULL AND insight_type IN (${ANALYTIC_TYPES.map((t) => `'${t}'`).join(",")})`
  );
  let created = 0;
  const add = async (i: InsightInput) => {
    await insertInsight(i);
    created++;
  };

  // CHANNEL_CONFLICT — members transacting in both a B2C channel and SFA.
  const conflicts = await all<{ customer_id: number; name: string }>(
    `SELECT t.customer_id, (c.first_name || ' ' || c.last_name) AS name
     FROM transactions t JOIN customers c ON c.id = t.customer_id
     GROUP BY t.customer_id, c.first_name, c.last_name
     HAVING SUM(CASE WHEN t.channel='SFA' THEN 1 ELSE 0 END) > 0
        AND SUM(CASE WHEN t.channel IN ('POS','ECOM','D2C') THEN 1 ELSE 0 END) > 0`
  );
  for (const row of conflicts) {
    await add({
      insight_type: "CHANNEL_CONFLICT",
      severity: "WARNING",
      entity_type: "customer",
      entity_id: row.customer_id,
      title: `Channel conflict: ${row.name}`,
      description: "This member buys through both B2B (SFA) and B2C channels — a cross-channel arbitrage risk.",
      recommendation: "Review the member's pricing corridor and confirm channel eligibility.",
      confidence: 0.9,
    });
  }

  // Stock-based rules per distributor × product.
  const stock = await all<{
    distributor_id: number;
    distributor_name: string;
    product_id: number;
    product_name: string;
    reorder_point: number;
    total_in: number;
    total_out: number;
    on_hand: number;
  }>(
    `SELECT it.distributor_id, d.name AS distributor_name,
       it.product_id, p.name AS product_name, p.reorder_point,
       SUM(CASE WHEN it.quantity > 0 THEN it.quantity ELSE 0 END) AS total_in,
       SUM(CASE WHEN it.quantity < 0 THEN -it.quantity ELSE 0 END) AS total_out,
       SUM(it.quantity) AS on_hand
     FROM inventory_transactions it
     JOIN distributors d ON d.id = it.distributor_id
     JOIN products p ON p.id = it.product_id
     GROUP BY it.distributor_id, d.name, it.product_id, p.name, p.reorder_point`
  );
  for (const s of stock) {
    const sellThrough = s.total_in > 0 ? s.total_out / s.total_in : 0;
    if (s.on_hand <= 0 && s.total_in > 0) {
      await add({
        insight_type: "OUT_OF_STOCK",
        severity: "CRITICAL",
        entity_type: "distributor",
        entity_id: s.distributor_id,
        title: `Out of stock: ${s.product_name} at ${s.distributor_name}`,
        description: "On-hand has reached zero — sales are being lost until replenished.",
        recommendation: `Urgent replenishment of ${s.product_name}.`,
        confidence: 1,
      });
    } else if (s.on_hand <= s.reorder_point && sellThrough >= 0.6) {
      const qty = Math.max(12, s.reorder_point * 2 - s.on_hand);
      await add({
        insight_type: "LOW_SELLIN_STOCK",
        severity: "WARNING",
        entity_type: "distributor",
        entity_id: s.distributor_id,
        title: `Reorder soon: ${s.product_name} at ${s.distributor_name}`,
        description: `On-hand ${s.on_hand} is at/below the reorder point (${s.reorder_point}) with strong ${Math.round(sellThrough * 100)}% sell-through.`,
        recommendation: `Replenishment order of ${qty} units.`,
        confidence: 0.85,
      });
    } else if (sellThrough < 0.4 && s.on_hand > s.reorder_point) {
      await add({
        insight_type: "LOW_SELLOUT_RATE",
        severity: "OPPORTUNITY",
        entity_type: "distributor",
        entity_id: s.distributor_id,
        title: `Slow sell-out: ${s.product_name} at ${s.distributor_name}`,
        description: `Only ${Math.round(sellThrough * 100)}% of stock has sold through while on-hand stays high.`,
        recommendation: "Run a co-op promotion before the next sell-in.",
        confidence: 0.75,
      });
    }
  }

  // CONSENT_GAP — global.
  const gap = await getConsentGapStats();
  if (gap.pct > 20) {
    await add({
      insight_type: "CONSENT_GAP",
      severity: "WARNING",
      entity_type: "global",
      entity_id: null,
      title: `${gap.pct}% of members lack marketing consent`,
      description: `${gap.without_marketing} of ${gap.total_members} members cannot be reached by marketing.`,
      recommendation: "Launch a consent-request journey on LINE with an incentive.",
      confidence: 1,
    });
  }

  // LIABILITY_HIGH — global.
  const liability = await getLiabilityStats();
  if (liability.redemption_rate < 30 && liability.earned > 0) {
    await add({
      insight_type: "LIABILITY_HIGH",
      severity: "OPPORTUNITY",
      entity_type: "global",
      entity_id: null,
      title: `Low redemption (${liability.redemption_rate}%) — points liability building`,
      description: `${liability.outstanding.toLocaleString("en-US")} points outstanding with a ${liability.redemption_rate}% redemption rate.`,
      recommendation: "Promote low-cost rewards to encourage members to burn points.",
      confidence: 0.9,
    });
  }

  // CHURN_RISK — active members with no transaction in 60+ days (cap 10).
  // Severity reflects the stored churn score (see recomputeScores()) when
  // it's been computed, for consistency with the Customer 360 panel and
  // segment builder that read the same column; falls back to WARNING when
  // scores haven't been run yet, rather than requiring that ordering.
  const churn = await all<{ id: number; name: string; last_tx: string | null; churn_score: string | null }>(
    `SELECT c.id, (c.first_name || ' ' || c.last_name) AS name,
       MAX(t.tx_date) AS last_tx, s.churn_score
     FROM customers c
     JOIN transactions t ON t.customer_id = c.id
     LEFT JOIN customer_scores s ON s.customer_id = c.id
     GROUP BY c.id, s.churn_score
     HAVING now() - MAX(t.tx_date)::timestamptz > interval '60 days'
     ORDER BY last_tx DESC LIMIT 10`
  );
  for (const row of churn) {
    await add({
      insight_type: "CHURN_RISK",
      severity: row.churn_score === "High" ? "CRITICAL" : "WARNING",
      entity_type: "customer",
      entity_id: row.id,
      title: `Churn risk: ${row.name}`,
      description: "No purchase in over 60 days.",
      recommendation: "Send a win-back campaign with a personalized offer.",
      confidence: 0.7,
    });
  }

  // DEALER_UNLINKED — active Dealers not linked to a CRM member.
  const unlinked = await all<{ id: number; name: string }>(
    `SELECT id, name FROM distributors
     WHERE status='active' AND dealer_type='Dealer' AND customer_id IS NULL`
  );
  for (const row of unlinked) {
    await add({
      insight_type: "DEALER_UNLINKED",
      severity: "INFO",
      entity_type: "distributor",
      entity_id: row.id,
      title: `Dealer not linked: ${row.name}`,
      description: "This dealer has no linked CRM member, breaking the identity chain.",
      recommendation: "Link the dealer to a B2B member to enable sell-in loyalty earn.",
      confidence: 1,
    });
  }

  return { created };
}

export async function getNbaForCustomer(customerId: number): Promise<NbaResult> {
  const customer = await get<{
    id: number;
    cust_type: CustType;
    clv: number;
    created_at: string;
  }>("SELECT id, cust_type, clv, created_at FROM customers WHERE id = ?", [customerId]);
  if (!customer) {
    return { action: "NONE", title: "Member not found", reason: "" };
  }
  const [summary, marketing, recent] = await Promise.all([
    getLoyaltySummary(customerId),
    hasMarketingConsent(customerId),
    get<{ n: number }>(
      `SELECT COUNT(*) AS n FROM transactions
       WHERE customer_id = ? AND now() - tx_date::timestamptz <= interval '30 days'`,
      [customerId]
    ),
  ]);
  const ageDays = Math.floor(
    (Date.now() - new Date(customer.created_at).getTime()) / 86400000
  );
  return nextBestAction({
    hasMarketing: marketing,
    tier: summary.tier as Tier,
    clv: customer.clv,
    balance: summary.balance,
    txLast30d: recent?.n ?? 0,
    memberAgeDays: ageDays,
  });
}
