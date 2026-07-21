import { get, all, run } from "../client";
import type { SqlValue } from "../client";
import type { Tier, Brand, CustType, ChurnLevel, SegmentType } from "@/lib/constants";

/**
 * Segment audiences for campaigns. The rule is an allow-listed filter set
 * (never raw SQL from the client) — segmentQuery() is the one place that
 * translates it, parameterized the same disciplined way listCustomers()
 * builds its WHERE clause.
 */

export interface SegmentRule {
  tier?: Tier;
  brand?: Brand;
  cust_type?: CustType;
  min_points?: number;
  churn_level?: ChurnLevel;
  /** true = must have current GRANTED marketing consent; false = must not. */
  marketing_consent?: boolean;
}

export interface Segment {
  id: number;
  name: string;
  segment_type: SegmentType;
  rule_json: string;
  live_count: number;
  created_by: number | null;
  created_at: string;
  updated_at: string;
}

function segmentQuery(rule: SegmentRule): {
  from: string;
  where: string;
  params: Record<string, SqlValue>;
} {
  const clauses: string[] = [];
  const params: Record<string, SqlValue> = {};
  if (rule.tier) {
    clauses.push("c.tier = @tier");
    params.tier = rule.tier;
  }
  if (rule.brand) {
    clauses.push("c.brand = @brand");
    params.brand = rule.brand;
  }
  if (rule.cust_type) {
    clauses.push("c.cust_type = @cust_type");
    params.cust_type = rule.cust_type;
  }
  if (rule.min_points != null) {
    clauses.push("c.points >= @min_points");
    params.min_points = rule.min_points;
  }
  if (rule.churn_level) {
    clauses.push("s.churn_score = @churn_level");
    params.churn_level = rule.churn_level;
  }
  if (rule.marketing_consent != null) {
    // "Current" consent = latest row per customer for the MARKETING purpose,
    // same latest-by-id resolution consent.ts's getCurrentConsents uses.
    const existsGranted = `EXISTS (
      SELECT 1 FROM consents co
      JOIN (
        SELECT customer_id, MAX(id) AS mid FROM consents
         WHERE purpose = 'MARKETING' GROUP BY customer_id
      ) latest ON co.id = latest.mid
      WHERE co.customer_id = c.id AND co.status = 'GRANTED'
    )`;
    clauses.push(rule.marketing_consent ? existsGranted : `NOT ${existsGranted}`);
  }
  return {
    from: "FROM customers c LEFT JOIN customer_scores s ON s.customer_id = c.id",
    where: clauses.length ? `WHERE ${clauses.join(" AND ")}` : "",
    params,
  };
}

export async function countSegmentMembers(rule: SegmentRule): Promise<number> {
  const { from, where, params } = segmentQuery(rule);
  const row = await get<{ n: number }>(`SELECT COUNT(*)::int AS n ${from} ${where}`, params);
  return row?.n ?? 0;
}

export function getSegmentMembers(rule: SegmentRule): Promise<{ id: number }[]> {
  const { from, where, params } = segmentQuery(rule);
  return all<{ id: number }>(`SELECT c.id ${from} ${where}`, params);
}

export function listSegments(): Promise<Segment[]> {
  return all<Segment>("SELECT * FROM segments ORDER BY created_at DESC");
}

export function getSegment(id: number): Promise<Segment | undefined> {
  return get<Segment>("SELECT * FROM segments WHERE id = ?", [id]);
}

export function parseSegmentRule(seg: Segment): SegmentRule {
  return JSON.parse(seg.rule_json) as SegmentRule;
}

export async function createSegment(
  name: string,
  segmentType: SegmentType,
  rule: SegmentRule,
  createdBy: number | null
): Promise<number> {
  const liveCount = await countSegmentMembers(rule);
  return run(
    `INSERT INTO segments (name, segment_type, rule_json, live_count, created_by)
     VALUES (@name, @type, @rule, @count, @by) RETURNING id`,
    { name, type: segmentType, rule: JSON.stringify(rule), count: liveCount, by: createdBy }
  );
}

/** Re-runs the count against current data — segment membership can drift as
 * customers earn points, churn score changes, etc. */
export async function refreshSegmentCount(id: number): Promise<number> {
  const seg = await getSegment(id);
  if (!seg) return 0;
  const count = await countSegmentMembers(parseSegmentRule(seg));
  await run("UPDATE segments SET live_count = @count, updated_at = now() WHERE id = @id", { id, count });
  return count;
}

export async function deleteSegment(id: number): Promise<void> {
  await run("DELETE FROM segments WHERE id = ?", [id]);
}
