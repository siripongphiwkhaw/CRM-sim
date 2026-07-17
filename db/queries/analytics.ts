import { get, all } from "../client";
import { TIERS, BRANDS, DATA_LEVELS, type Tier } from "@/lib/constants";

export interface Overview {
  total_customers: number;
  active_customers: number;
  avg_clv: number;
  total_points: number;
  total_clv: number;
  repeat_rate: number;
  consent_pdpa: number;
  brands: number;
}

export async function getOverview(): Promise<Overview> {
  const base = await get<{
    total_customers: number;
    avg_clv: number;
    total_points: number;
    total_clv: number;
    consent_pdpa: number;
    brands: number;
  }>(
    `SELECT
       COUNT(*) AS total_customers,
       COALESCE(AVG(clv), 0) AS avg_clv,
       COALESCE(SUM(points), 0) AS total_points,
       COALESCE(SUM(clv), 0) AS total_clv,
       COALESCE(SUM(consent_pdpa), 0) AS consent_pdpa,
       COUNT(DISTINCT brand) AS brands
     FROM customers`
  );

  const active = await get<{ n: number }>(
    `SELECT COUNT(DISTINCT customer_id) AS n FROM interactions
     WHERE type = 'purchase' AND occurred_at >= datetime('now', '-90 days')`
  );

  const repeat = await get<{ buyers: number; repeat_buyers: number }>(
    `WITH pc AS (
       SELECT customer_id, COUNT(*) AS n FROM interactions
       WHERE type = 'purchase' GROUP BY customer_id
     )
     SELECT
       (SELECT COUNT(*) FROM pc) AS buyers,
       (SELECT COUNT(*) FROM pc WHERE n >= 2) AS repeat_buyers`
  );

  const buyers = repeat?.buyers ?? 0;
  const repeatRate = buyers > 0 ? (repeat!.repeat_buyers / buyers) * 100 : 0;

  return {
    total_customers: base?.total_customers ?? 0,
    active_customers: active?.n ?? 0,
    avg_clv: base?.avg_clv ?? 0,
    total_points: base?.total_points ?? 0,
    total_clv: base?.total_clv ?? 0,
    repeat_rate: repeatRate,
    consent_pdpa: base?.consent_pdpa ?? 0,
    brands: base?.brands ?? 0,
  };
}

export interface Bucket {
  label: string;
  count: number;
}

export async function getTierDistribution(): Promise<
  { tier: Tier; count: number }[]
> {
  const rows = await all<{ tier: Tier; count: number }>(
    "SELECT tier, COUNT(*) AS count FROM customers GROUP BY tier"
  );
  const map = new Map(rows.map((r) => [r.tier, r.count]));
  return TIERS.map((tier) => ({ tier, count: map.get(tier) ?? 0 }));
}

export async function getBrandDistribution(): Promise<Bucket[]> {
  const rows = await all<{ label: string; count: number }>(
    "SELECT brand AS label, COUNT(*) AS count FROM customers GROUP BY brand"
  );
  const map = new Map(rows.map((r) => [r.label, r.count]));
  return BRANDS.map((brand) => ({ label: brand, count: map.get(brand) ?? 0 }));
}

export interface MonthlyPurchases {
  month: string;
  total: number;
  orders: number;
}

/** Purchase revenue per month over the trailing six months (oldest first). */
export function getMonthlyPurchases(): Promise<MonthlyPurchases[]> {
  return all<MonthlyPurchases>(
    `SELECT strftime('%Y-%m', occurred_at) AS month,
       COALESCE(SUM(amount), 0) AS total,
       COUNT(*) AS orders
     FROM interactions
     WHERE type = 'purchase' AND occurred_at >= datetime('now', '-6 months')
     GROUP BY month
     ORDER BY month ASC`
  );
}

export async function getMembersWithoutPdpa(): Promise<number> {
  const row = await get<{ n: number }>(
    "SELECT COUNT(*) AS n FROM customers WHERE consent_pdpa = 0"
  );
  return row?.n ?? 0;
}

export interface ConsentStats {
  total: number;
  pdpa: number;
  marketing: number;
  migration: number;
}

export async function getConsentStats(): Promise<ConsentStats> {
  const row = await get<ConsentStats>(
    `SELECT
       COUNT(*) AS total,
       COALESCE(SUM(consent_pdpa), 0) AS pdpa,
       COALESCE(SUM(consent_marketing), 0) AS marketing,
       COALESCE(SUM(consent_migration), 0) AS migration
     FROM customers`
  );
  return row ?? { total: 0, pdpa: 0, marketing: 0, migration: 0 };
}

export async function getDataLevelDistribution(): Promise<Bucket[]> {
  const rows = await all<{ label: string; count: number }>(
    "SELECT data_level AS label, COUNT(*) AS count FROM customers GROUP BY data_level"
  );
  const map = new Map(rows.map((r) => [r.label, r.count]));
  return DATA_LEVELS.map((level) => ({
    label: level,
    count: map.get(level) ?? 0,
  }));
}
