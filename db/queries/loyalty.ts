import { get, all, run } from "../client";
import {
  DEFAULT_TIER_RULES,
  tierForLifetime,
  multiplierForTier,
  rewardAvailable,
  BIRTHDAY_BONUS_POINTS,
  type TierRule,
} from "@/lib/loyaltyEngine";
import type { Tier, RewardType, RewardStatus } from "@/lib/constants";

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
  /** Kept in sync with `status` (PUBLISHED ⇒ 1) for back-compat with the
   * existing active-only API/LIFF filters. */
  active: number;
  status: RewardStatus;
  starts_at: string | null;
  ends_at: string | null;
  per_member_limit: number | null;
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

/**
 * Generic EARN write with a specific ref_type/ref_id — used by mission
 * awards, referral bonuses, and birthday bonuses so each origin is traceable
 * in the ledger the same way transaction/reward entries already are.
 * postAdjustment() stays as-is for the manual staff credit/debit path
 * (ref_type is always 'manual' there); this is for everything else.
 */
export async function postEarn(
  customerId: number,
  points: number,
  opts: {
    refType: string;
    refId?: number | null;
    note?: string | null;
    actorId?: number | null;
    source?: LedgerSource;
  }
): Promise<number> {
  const summary = await getLoyaltySummary(customerId);
  const entryId = await run(
    `INSERT INTO loyalty_ledger
       (customer_id, entry_type, points, tier_at_time, ref_type, ref_id, note, created_by, source)
     VALUES (@cid, 'EARN', @points, @tier, @ref_type, @ref_id, @note, @actor, @source) RETURNING id`,
    {
      cid: customerId,
      points,
      tier: summary.tier,
      ref_type: opts.refType,
      ref_id: opts.refId ?? null,
      note: opts.note ?? null,
      actor: opts.actorId ?? null,
      source: opts.source ?? "staff",
    }
  );
  await recomputeCustomerCache(customerId);
  return entryId;
}

export type RedeemResult =
  | { ok: true; entryId: number; balance: number }
  | {
      ok: false;
      error: "INSUFFICIENT_POINTS" | "REWARD_INACTIVE" | "REWARD_NOT_FOUND" | "REWARD_LIMIT_REACHED";
    };

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
  if (!rewardAvailable(reward)) return { ok: false, error: "REWARD_INACTIVE" };

  if (reward.per_member_limit != null) {
    const prior = await get<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM loyalty_ledger
        WHERE customer_id = @cid AND entry_type = 'BURN'
          AND ref_type = 'reward' AND ref_id = @rid`,
      { cid: customerId, rid: rewardId }
    );
    if ((prior?.n ?? 0) >= reward.per_member_limit) {
      return { ok: false, error: "REWARD_LIMIT_REACHED" };
    }
  }

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

/**
 * `availableOnly` filters to status='PUBLISHED' in SQL, then applies the
 * starts_at/ends_at window in JS via rewardAvailable() — the window check
 * needs Date parsing (see the timestamp-format note in loyaltyEngine.ts),
 * which isn't safely expressible as a portable SQL comparison here.
 */
export async function listRewards(opts?: {
  activeOnly?: boolean;
  availableOnly?: boolean;
}): Promise<Reward[]> {
  if (opts?.availableOnly) {
    const rows = await all<Reward>(
      "SELECT * FROM rewards WHERE status = 'PUBLISHED' ORDER BY points_cost"
    );
    return rows.filter(rewardAvailable);
  }
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
  status?: RewardStatus;
  starts_at?: string | null;
  ends_at?: string | null;
  per_member_limit?: number | null;
}

export async function createReward(input: RewardInput): Promise<number> {
  const next = await get<{ n: number }>("SELECT COALESCE(MAX(id),0)+1 AS n FROM rewards");
  const code = `RWD-${String(next?.n ?? 1).padStart(3, "0")}`;
  const status = input.status ?? "PUBLISHED";
  return run(
    `INSERT INTO rewards
       (code, name, description, reward_type, points_cost, status, active, starts_at, ends_at, per_member_limit)
     VALUES (@code, @name, @desc, @type, @cost, @status, @active, @starts, @ends, @limit) RETURNING id`,
    {
      code,
      name: input.name,
      desc: input.description ?? null,
      type: input.reward_type,
      cost: input.points_cost,
      status,
      active: status === "PUBLISHED" ? 1 : 0,
      starts: input.starts_at ?? null,
      ends: input.ends_at ?? null,
      limit: input.per_member_limit ?? null,
    }
  );
}

export function updateReward(id: number, input: RewardInput): Promise<number> {
  const status = input.status ?? "PUBLISHED";
  return run(
    `UPDATE rewards SET
       name=@name, description=@desc, reward_type=@type, points_cost=@cost,
       status=@status, active=@active, starts_at=@starts, ends_at=@ends, per_member_limit=@limit
     WHERE id=@id`,
    {
      id,
      name: input.name,
      desc: input.description ?? null,
      type: input.reward_type,
      cost: input.points_cost,
      status,
      active: status === "PUBLISHED" ? 1 : 0,
      starts: input.starts_at ?? null,
      ends: input.ends_at ?? null,
      limit: input.per_member_limit ?? null,
    }
  );
}

/** Publish/suspend/draft a reward, keeping the legacy `active` flag in sync
 * so the existing active-only API/LIFF filters stay correct. */
export function setRewardStatus(id: number, status: RewardStatus): Promise<number> {
  return run("UPDATE rewards SET status = @status, active = @active WHERE id = @id", {
    id,
    status,
    active: status === "PUBLISHED" ? 1 : 0,
  });
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

/**
 * Awards a once-a-year bonus to every member whose birth_date's month+day
 * matches today, skipping anyone who already got one this calendar year
 * (checked against the ledger itself — no separate "last run" state needed,
 * so this is safe to click more than once a day). On-demand button, mirrors
 * generateInsights().
 */
export async function runBirthdayRewards(actorId: number | null): Promise<{ awarded: number }> {
  const due = await all<{ id: number }>(
    `SELECT c.id FROM customers c
      WHERE c.birth_date IS NOT NULL
        AND to_char(c.birth_date::date, 'MM-DD') = to_char(now(), 'MM-DD')
        AND NOT EXISTS (
          SELECT 1 FROM loyalty_ledger l
           WHERE l.customer_id = c.id AND l.ref_type = 'birthday'
             AND to_char(l.occurred_at::timestamptz, 'YYYY') = to_char(now(), 'YYYY')
        )`
  );
  for (const row of due) {
    await postEarn(row.id, BIRTHDAY_BONUS_POINTS, {
      refType: "birthday",
      note: "Happy birthday from Only-One!",
      actorId,
      source: "staff",
    });
  }
  return { awarded: due.length };
}

/**
 * Writes one EXPIRE entry per member for the portion of their EARN points
 * older than `months` that hasn't already been offset by a BURN or a prior
 * EXPIRE. Demo-simplified: it doesn't track which specific EARN lot a BURN
 * consumed (true FIFO lot accounting), just the aggregate old-vs-offset
 * balance — so this is an approximation, not exact expiry accounting.
 * Naturally idempotent: re-running with nothing newly due computes 0 and
 * writes nothing, since already-expired points show up as already "offset".
 */
export async function runPointExpiry(
  months: number,
  actorId: number | null
): Promise<{ expired: number; totalPoints: number }> {
  if (!Number.isInteger(months) || months <= 0) {
    throw new Error("months must be a positive integer");
  }
  const rows = await all<{ customer_id: number; old_earn: number; offset_total: number; balance: number }>(
    `SELECT customer_id,
            COALESCE(SUM(CASE WHEN entry_type='EARN'
                                AND occurred_at::timestamptz < now() - interval '${months} months'
                               THEN points ELSE 0 END), 0)::int AS old_earn,
            COALESCE(SUM(CASE WHEN entry_type IN ('BURN','EXPIRE') THEN points ELSE 0 END), 0)::int AS offset_total,
            COALESCE(SUM(CASE WHEN entry_type='EARN' THEN points ELSE -points END), 0)::int AS balance
       FROM loyalty_ledger
      GROUP BY customer_id`
  );

  let expiredMembers = 0;
  let totalPoints = 0;
  for (const row of rows) {
    const expiring = Math.max(0, Math.min(row.balance, row.old_earn - row.offset_total));
    if (expiring <= 0) continue;
    await run(
      `INSERT INTO loyalty_ledger
         (customer_id, entry_type, points, ref_type, note, created_by, source)
       VALUES (@cid, 'EXPIRE', @points, 'expire', @note, @actor, 'staff')`,
      {
        cid: row.customer_id,
        points: expiring,
        note: `${expiring} points older than ${months} months expired`,
        actor: actorId,
      }
    );
    await recomputeCustomerCache(row.customer_id);
    expiredMembers += 1;
    totalPoints += expiring;
  }
  return { expired: expiredMembers, totalPoints };
}
