import { get, all, run } from "../client";
import {
  DEFAULT_TIER_RULES,
  tierForLifetime,
  multiplierForTier,
  type TierRule,
} from "@/lib/loyaltyEngine";
import type { Tier, RewardType } from "@/lib/constants";

export interface LedgerEntry {
  id: number;
  customer_id: number;
  entry_type: "EARN" | "BURN" | "ADJUST" | "EXPIRE";
  points: number;
  rate_applied: number | null;
  multiplier: number | null;
  tier_at_time: Tier | null;
  ref_type: string | null;
  ref_id: number | null;
  note: string | null;
  created_by: number | null;
  occurred_at: string;
}

export interface Reward {
  id: number;
  code: string;
  name: string;
  description: string | null;
  reward_type: RewardType;
  points_cost: number;
  active: number;
  created_at: string;
}

export async function getTierRules(): Promise<TierRule[]> {
  const rows = await all<TierRule>(
    "SELECT tier, min_lifetime_points, multiplier FROM tier_config ORDER BY min_lifetime_points"
  );
  return rows.length ? rows : DEFAULT_TIER_RULES;
}

export async function getBalance(customerId: number): Promise<number> {
  const row = await get<{ balance: number }>(
    // ::int is required — SUM() over integer returns bigint, which the Neon
    // driver hands back as a string. Without the cast this returns "4011"
    // rather than 4011 and every downstream comparison relies on coercion.
    `SELECT COALESCE(SUM(CASE WHEN entry_type='EARN' THEN points ELSE -points END), 0)::int AS balance
     FROM loyalty_ledger WHERE customer_id = ?`,
    [customerId]
  );
  return row?.balance ?? 0;
}

export async function getLifetimeEarned(customerId: number): Promise<number> {
  const row = await get<{ lifetime: number }>(
    `SELECT COALESCE(SUM(points), 0)::int AS lifetime
     FROM loyalty_ledger WHERE customer_id = ? AND entry_type = 'EARN'`,
    [customerId]
  );
  return row?.lifetime ?? 0;
}

export interface LoyaltySummary {
  balance: number;
  lifetime: number;
  tier: Tier;
  multiplier: number;
  /** Lifetime points at which the CURRENT tier starts — the floor of the
   * progress arc. Without it, progress toward the next tier can't be drawn. */
  tier_at: number;
  next_tier: Tier | null;
  next_tier_at: number | null;
}

export async function getLoyaltySummary(customerId: number): Promise<LoyaltySummary> {
  const rules = await getTierRules();
  const [balance, lifetime] = await Promise.all([
    getBalance(customerId),
    getLifetimeEarned(customerId),
  ]);
  const tier = tierForLifetime(lifetime, rules);
  const higher = rules
    .filter((r) => r.min_lifetime_points > lifetime)
    .sort((a, b) => a.min_lifetime_points - b.min_lifetime_points)[0];
  const current = rules.find((r) => r.tier === tier);
  return {
    balance,
    lifetime,
    tier,
    multiplier: multiplierForTier(tier, rules),
    tier_at: current?.min_lifetime_points ?? 0,
    next_tier: higher?.tier ?? null,
    next_tier_at: higher?.min_lifetime_points ?? null,
  };
}

export function listLedger(
  customerId: number,
  opts?: { limit?: number; entryType?: string }
): Promise<LedgerEntry[]> {
  const clauses = ["customer_id = ?"];
  const params: (string | number)[] = [customerId];
  if (opts?.entryType) {
    clauses.push("entry_type = ?");
    params.push(opts.entryType);
  }
  const limit = opts?.limit ?? 100;
  return all<LedgerEntry>(
    `SELECT * FROM loyalty_ledger WHERE ${clauses.join(" AND ")}
     ORDER BY occurred_at DESC, id DESC LIMIT ${limit}`,
    params
  );
}

export interface RecentLedgerRow extends LedgerEntry {
  member_code: string;
  member_name: string;
}

export function listRecentLedger(limit = 20): Promise<RecentLedgerRow[]> {
  return all<RecentLedgerRow>(
    `SELECT l.*, c.member_code, (c.first_name || ' ' || c.last_name) AS member_name
     FROM loyalty_ledger l
     JOIN customers c ON c.id = l.customer_id
     ORDER BY l.occurred_at DESC, l.id DESC LIMIT ${limit}`
  );
}

export interface BrandEarn {
  brand: string;
  points: number;
  tx_count: number;
  amount_thb: number;
}

/**
 * EARN points grouped by the brand each purchase happened at — the Only-One
 * cross-brand breakdown.
 *
 * `ref_type = 'transaction'` is load-bearing: ref_id is a bare INTEGER with no
 * foreign key and is reused across entry kinds (a 'reward' row stores
 * rewards.id there). Without that predicate this would join reward ids against
 * transaction ids and silently attribute points to the wrong brand.
 *
 * The ::int casts matter too — SUM() over integer returns bigint, which the
 * Neon driver hands back as a string, and the UI does arithmetic on these.
 */
export function getBrandEarnBreakdown(customerId: number): Promise<BrandEarn[]> {
  return all<BrandEarn>(
    `SELECT COALESCE(t.brand, 'Unattributed') AS brand,
            COALESCE(SUM(l.points), 0)::int   AS points,
            COUNT(*)::int                     AS tx_count,
            COALESCE(SUM(t.amount_thb), 0)    AS amount_thb
       FROM loyalty_ledger l
       JOIN transactions t ON t.id = l.ref_id
      WHERE l.customer_id = @cid
        AND l.entry_type = 'EARN'
        AND l.ref_type = 'transaction'
      GROUP BY COALESCE(t.brand, 'Unattributed')
      ORDER BY points DESC, brand ASC`,
    { cid: customerId }
  );
}

/** Everything the LIFF home screen needs, in one round of parallel reads. */
export async function getMemberHome(customerId: number) {
  const [summary, brands, recent] = await Promise.all([
    getLoyaltySummary(customerId),
    getBrandEarnBreakdown(customerId),
    listLedger(customerId, { limit: 5 }),
  ]);
  return { summary, brands, recent };
}

/** Single writer of the denormalized customers.points / customers.tier caches. */
export async function recomputeCustomerCache(customerId: number): Promise<void> {
  const summary = await getLoyaltySummary(customerId);
  await run(
    `UPDATE customers SET points = @points, tier = @tier, updated_at = now()
     WHERE id = @id`,
    { points: summary.balance, tier: summary.tier, id: customerId }
  );
}

/** Manual EARN or ADJUST credit (points>0). ADJUST does not count toward tier. */
export type LedgerSource = "staff" | "api" | "liff";

export async function postAdjustment(
  customerId: number,
  points: number,
  direction: "EARN" | "ADJUST",
  note: string | null,
  actorId: number | null,
  source: LedgerSource = "staff"
): Promise<number> {
  const summary = await getLoyaltySummary(customerId);
  const entryId = await run(
    `INSERT INTO loyalty_ledger
       (customer_id, entry_type, points, tier_at_time, ref_type, note, created_by, source)
     VALUES (@cid, @type, @points, @tier, 'manual', @note, @actor, @source) RETURNING id`,
    {
      cid: customerId,
      type: direction,
      points,
      tier: summary.tier,
      note,
      actor: actorId,
      source,
    }
  );
  await recomputeCustomerCache(customerId);
  return entryId;
}

export type RedeemResult =
  | { ok: true; entryId: number; balance: number }
  | { ok: false; error: "INSUFFICIENT_POINTS" | "REWARD_INACTIVE" | "REWARD_NOT_FOUND" };

/**
 * Burns points for a reward. `source` distinguishes a member self-redeeming in
 * LIFF from an API-key burn — both have created_by NULL (a member is a
 * customers row, not a users row), so without it they'd be indistinguishable
 * in the ledger.
 */
export async function redeemReward(
  customerId: number,
  rewardId: number,
  actorId: number | null,
  source: LedgerSource = "staff"
): Promise<RedeemResult> {
  const reward = await getReward(rewardId);
  if (!reward) return { ok: false, error: "REWARD_NOT_FOUND" };
  if (!reward.active) return { ok: false, error: "REWARD_INACTIVE" };

  const summary = await getLoyaltySummary(customerId);
  if (summary.balance < reward.points_cost) {
    return { ok: false, error: "INSUFFICIENT_POINTS" };
  }

  const entryId = await run(
    `INSERT INTO loyalty_ledger
       (customer_id, entry_type, points, tier_at_time, ref_type, ref_id, note, created_by, source)
     VALUES (@cid, 'BURN', @points, @tier, 'reward', @rid, @note, @actor, @source) RETURNING id`,
    {
      cid: customerId,
      points: reward.points_cost,
      tier: summary.tier,
      rid: rewardId,
      // The CRM ledger feed renders `note` directly, so staff see the origin
      // with no extra UI work.
      note: source === "liff" ? `Redeemed: ${reward.name} · via LINE` : `Redeemed: ${reward.name}`,
      actor: actorId,
      source,
    }
  );
  await recomputeCustomerCache(customerId);
  return { ok: true, entryId, balance: summary.balance - reward.points_cost };
}

/* ---------- Rewards catalog ---------- */

export function listRewards(opts?: { activeOnly?: boolean }): Promise<Reward[]> {
  const where = opts?.activeOnly ? "WHERE active = 1" : "";
  return all<Reward>(`SELECT * FROM rewards ${where} ORDER BY points_cost`);
}

export function getReward(id: number): Promise<Reward | undefined> {
  return get<Reward>("SELECT * FROM rewards WHERE id = ?", [id]);
}

export interface RewardInput {
  name: string;
  description?: string | null;
  reward_type: RewardType;
  points_cost: number;
}

export async function createReward(input: RewardInput): Promise<number> {
  const next = await get<{ n: number }>("SELECT COALESCE(MAX(id),0)+1 AS n FROM rewards");
  const code = `RWD-${String(next?.n ?? 1).padStart(3, "0")}`;
  return run(
    `INSERT INTO rewards (code, name, description, reward_type, points_cost)
     VALUES (@code, @name, @desc, @type, @cost) RETURNING id`,
    {
      code,
      name: input.name,
      desc: input.description ?? null,
      type: input.reward_type,
      cost: input.points_cost,
    }
  );
}

export function updateReward(id: number, input: RewardInput): Promise<number> {
  return run(
    `UPDATE rewards SET name=@name, description=@desc, reward_type=@type, points_cost=@cost WHERE id=@id`,
    {
      id,
      name: input.name,
      desc: input.description ?? null,
      type: input.reward_type,
      cost: input.points_cost,
    }
  );
}

export function setRewardActive(id: number, active: boolean): Promise<number> {
  return run("UPDATE rewards SET active = ? WHERE id = ?", [active ? 1 : 0, id]);
}

export interface LiabilityStats {
  outstanding: number;
  earned: number;
  burned: number;
  redemption_rate: number; // burned / earned, percent
  member_count: number;
}

export async function getLiabilityStats(): Promise<LiabilityStats> {
  const row = await get<{ earned: number; burned: number; outstanding: number }>(
    `SELECT
       COALESCE(SUM(CASE WHEN entry_type='EARN' THEN points ELSE 0 END), 0)::int AS earned,
       COALESCE(SUM(CASE WHEN entry_type='BURN' THEN points ELSE 0 END), 0)::int AS burned,
       COALESCE(SUM(CASE WHEN entry_type='EARN' THEN points ELSE -points END), 0)::int AS outstanding
     FROM loyalty_ledger`
  );
  const members = await get<{ n: number }>(
    "SELECT COUNT(DISTINCT customer_id)::int AS n FROM loyalty_ledger"
  );
  const earned = row?.earned ?? 0;
  const burned = row?.burned ?? 0;
  return {
    outstanding: row?.outstanding ?? 0,
    earned,
    burned,
    redemption_rate: earned > 0 ? Math.round((burned / earned) * 100) : 0,
    member_count: members?.n ?? 0,
  };
}
