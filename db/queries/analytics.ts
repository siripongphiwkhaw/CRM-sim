import { get, all } from "../client";
import { TIERS, BRANDS, DATA_LEVELS, type Tier } from "@/lib/constants";
import { getConsentGapStats } from "./consent";

export interface Overview {
  total_customers: number;
  active_customers: number;
  avg_clv: number;
  total_points: number;
  total_clv: number;
  repeat_rate: number;
  brands: number;
}

export async function getOverview(): Promise<Overview> {
  const base = await get<{
    total_customers: number;
    avg_clv: number;
    total_points: number;
    total_clv: number;
    brands: number;
  }>(
    `SELECT
       COUNT(*) AS total_customers,
       COALESCE(AVG(clv), 0) AS avg_clv,
       COALESCE(SUM(points), 0) AS total_points,
       COALESCE(SUM(clv), 0) AS total_clv,
       COUNT(DISTINCT brand) AS brands
     FROM customers`
  );

  const active = await get<{ n: number }>(
    `SELECT COUNT(DISTINCT customer_id) AS n FROM transactions
     WHERE tx_date >= datetime('now', '-90 days')`
  );

  const repeat = await get<{ buyers: number; repeat_buyers: number }>(
    `WITH pc AS (
       SELECT customer_id, COUNT(*) AS n FROM transactions GROUP BY customer_id
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
    `SELECT strftime('%Y-%m', tx_date) AS month,
       COALESCE(SUM(amount_thb), 0) AS total,
       COUNT(*) AS orders
     FROM transactions
     WHERE tx_date >= datetime('now', '-6 months')
     GROUP BY month
     ORDER BY month ASC`
  );
}

/** Members whose current MARKETING consent is not GRANTED. */
export async function getMembersWithoutPdpa(): Promise<number> {
  return (await getConsentGapStats()).without_marketing;
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
