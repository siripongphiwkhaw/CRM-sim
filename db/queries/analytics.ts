import { get, all } from "../client";
import {
  customersFor,
  scopedCustomerIds,
  type ReadScope,
} from "@/lib/customerScope";
import { TIERS, BRANDS, type Tier } from "@/lib/constants";
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

export async function getOverview(scope: ReadScope): Promise<Overview> {
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
     FROM ${customersFor(scope)} c`
  );

  // transactions has no cust_type; restrict by the in-scope customer ids.
  const active = await get<{ n: number }>(
    `SELECT COUNT(DISTINCT customer_id) AS n FROM transactions
     WHERE tx_date::timestamptz >= now() - interval '90 days'
       AND ${scopedCustomerIds(scope)}`
  );

  const repeat = await get<{ buyers: number; repeat_buyers: number }>(
    `WITH pc AS (
       SELECT customer_id, COUNT(*) AS n FROM transactions
       WHERE ${scopedCustomerIds(scope)}
       GROUP BY customer_id
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

export async function getTierDistribution(
  scope: ReadScope
): Promise<{ tier: Tier; count: number }[]> {
  const rows = await all<{ tier: Tier; count: number }>(
    `SELECT tier, COUNT(*) AS count FROM ${customersFor(scope)} c GROUP BY tier`
  );
  const map = new Map(rows.map((r) => [r.tier, r.count]));
  return TIERS.map((tier) => ({ tier, count: map.get(tier) ?? 0 }));
}

export async function getBrandDistribution(scope: ReadScope): Promise<Bucket[]> {
  const rows = await all<{ label: string; count: number }>(
    `SELECT brand AS label, COUNT(*) AS count FROM ${customersFor(scope)} c GROUP BY brand`
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
export function getMonthlyPurchases(
  scope: ReadScope
): Promise<MonthlyPurchases[]> {
  return all<MonthlyPurchases>(
    `SELECT to_char(tx_date::timestamptz, 'YYYY-MM') AS month,
       COALESCE(SUM(amount_thb), 0) AS total,
       COUNT(*) AS orders
     FROM transactions
     WHERE tx_date::timestamptz >= now() - interval '6 months'
       AND ${scopedCustomerIds(scope)}
     GROUP BY month
     ORDER BY month ASC`
  );
}

/** Members whose current MARKETING consent is not GRANTED. */
export async function getMembersWithoutPdpa(scope: ReadScope): Promise<number> {
  return (await getConsentGapStats(scope)).without_marketing;
}
