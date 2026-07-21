import type { Tier, CustType, TxChannel } from "./constants";

/**
 * Pure loyalty math — no DB access, so it is unit-testable and safe to import
 * from the synchronous seed. The DB's tier_config table mirrors DEFAULT_TIER_RULES;
 * getTierRules() in db/queries/loyalty.ts falls back to these values.
 *
 * Rules (locked):
 *  - Earn rate is keyed by customer TYPE, never by channel: B2C = 1pt/฿20,
 *    B2B = 1pt/฿100. Channel only decides the eligibility flag.
 *  - Tiers by LIFETIME EARNED points (EARN entries only): Bronze <500,
 *    Silver 500–1999 (×1.10), Gold ≥2000 (×1.25).
 *  - points = floor(amount / rate × multiplier)  (floor applied once, after ×).
 */

export interface TierRule {
  tier: Tier;
  min_lifetime_points: number;
  multiplier: number;
}

export const DEFAULT_TIER_RULES: TierRule[] = [
  { tier: "Bronze", min_lifetime_points: 0, multiplier: 1.0 },
  { tier: "Silver", min_lifetime_points: 500, multiplier: 1.1 },
  { tier: "Gold", min_lifetime_points: 2000, multiplier: 1.25 },
];

export const RATE_B2C = 20; // ฿ per point on POS / ECOM / D2C
export const RATE_B2B = 100; // ฿ per point on SFA

// Flat bonuses (locked, demo values). Both sides of a referral get the same
// amount; birthday is a once-a-year courtesy credit.
export const REFERRAL_BONUS_POINTS = 100;
export const BIRTHDAY_BONUS_POINTS = 50;

/** B2C channels earn at the B2C rate, B2B (SFA) at the B2B rate. */
export function rateForCustType(custType: CustType): number {
  return custType === "B2B" ? RATE_B2B : RATE_B2C;
}

const B2C_CHANNELS: TxChannel[] = ["POS", "ECOM", "D2C"];

/**
 * A B2B member transacting through a B2C channel (or vice-versa) is recorded
 * but flagged for review — arbitrage control. Points still earn at the member's
 * own type rate regardless of channel.
 */
export function channelEligibility(
  custType: CustType,
  channel: TxChannel
): "OK" | "CHANNEL_ELIGIBILITY_WARNING" {
  const channelIsB2C = B2C_CHANNELS.includes(channel);
  const matches = custType === "B2C" ? channelIsB2C : !channelIsB2C;
  return matches ? "OK" : "CHANNEL_ELIGIBILITY_WARNING";
}

export function tierForLifetime(
  lifetimeEarned: number,
  rules: TierRule[] = DEFAULT_TIER_RULES
): Tier {
  let result: Tier = "Bronze";
  for (const rule of rules) {
    if (lifetimeEarned >= rule.min_lifetime_points) result = rule.tier;
  }
  return result;
}

export function multiplierForTier(
  tier: Tier,
  rules: TierRule[] = DEFAULT_TIER_RULES
): number {
  return rules.find((r) => r.tier === tier)?.multiplier ?? 1.0;
}

export interface EarnResult {
  points: number;
  rate: number;
  multiplier: number;
}

/** Points earned for a purchase, given the member's type and current tier. */
export function calcEarn(
  amountThb: number,
  custType: CustType,
  tier: Tier,
  rules: TierRule[] = DEFAULT_TIER_RULES
): EarnResult {
  const rate = rateForCustType(custType);
  const multiplier = multiplierForTier(tier, rules);
  const points = Math.floor((amountThb / rate) * multiplier);
  return { points, rate, multiplier };
}

type PublishStatus = "DRAFT" | "PUBLISHED" | "SUSPENDED";

/**
 * Shared by rewardAvailable/missionAvailable: is `now` inside [starts_at,
 * ends_at]? Parses with Date rather than comparing raw TEXT strings — staff
 * enter plain dates ("2026-07-21") while `now` is a full timestamp, and naive
 * string comparison would make a window ending "today" look already-expired
 * at any time past midnight. A bare end date is treated as through the end of
 * that day.
 */
function isWithinWindow(startsAt: string | null, endsAt: string | null): boolean {
  const now = Date.now();
  if (startsAt) {
    const starts = new Date(startsAt).getTime();
    if (!Number.isNaN(starts) && now < starts) return false;
  }
  if (endsAt) {
    const hasTime = endsAt.includes("T") || endsAt.includes(":");
    const ends = new Date(hasTime ? endsAt : `${endsAt}T23:59:59.999`).getTime();
    if (!Number.isNaN(ends) && now > ends) return false;
  }
  return true;
}

/**
 * Single source of truth for "can this reward be redeemed right now" — used by
 * both the staff and LIFF redeem paths so they can never disagree.
 */
export function rewardAvailable(reward: {
  status: PublishStatus;
  starts_at: string | null;
  ends_at: string | null;
}): boolean {
  if (reward.status !== "PUBLISHED") return false;
  return isWithinWindow(reward.starts_at, reward.ends_at);
}

/** Same rule, for missions — used by submitMission and the LIFF mission list. */
export function missionAvailable(mission: {
  status: PublishStatus;
  starts_at: string | null;
  ends_at: string | null;
}): boolean {
  if (mission.status !== "PUBLISHED") return false;
  return isWithinWindow(mission.starts_at, mission.ends_at);
}
