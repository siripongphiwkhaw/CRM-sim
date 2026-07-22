import type { BehaviorClass, ChannelAffinity, CustType, TxChannel } from "./constants";

/**
 * Pure customer-classification rules — no DB access, unit-testable. Two derived
 * axes that the single-customer-view can compute but a single declared field
 * cannot express:
 *
 *  - behaviorClass: what the buying looks like, regardless of what they
 *    registered as. HORECA (chef / small restaurant) is the leak case — a
 *    business-sized buyer transacting on consumer channels.
 *  - channelAffinity: how spread the customer is across channels. CONTESTED
 *    means no single channel owns them, so channels end up spending promo
 *    budget competing for the same head.
 *
 * Thresholds are demo values, documented and deliberately conservative. With
 * no line-item/SKU data on transactions, "business-sized" is inferred from
 * average order value + frequency rather than bulk-pack share.
 */

// Average order value (฿) at/above which buying looks business-sized.
export const HORECA_AOV = 3000;
export const TRADE_AOV = 8000;
// Minimum orders before AOV is trusted as a pattern rather than a one-off.
export const BUSINESS_MIN_FREQUENCY = 3;

export interface BehaviorInput {
  custType: CustType;
  frequency: number;
  monetary: number;
  /** Fraction 0–1 of this customer's orders placed on the SFA (B2B) channel. */
  sfaShare: number;
}

export function behaviorClassFor(input: BehaviorInput): BehaviorClass {
  const aov = input.frequency > 0 ? input.monetary / input.frequency : 0;
  const businessSized = input.frequency >= BUSINESS_MIN_FREQUENCY;

  // TRADE: reseller-scale — very large baskets, or a declared B2B buying
  // primarily through the trade (SFA) channel.
  if (businessSized && (aov >= TRADE_AOV || (input.custType === "B2B" && input.sfaShare >= 0.5))) {
    return "TRADE";
  }
  // HORECA: business-sized baskets, but placed mostly on consumer channels
  // (or a declared B2B doing the same) — the cross-channel leak.
  if (businessSized && aov >= HORECA_AOV && input.sfaShare < 0.5) {
    return "HORECA";
  }
  if (input.custType === "B2B" && input.sfaShare < 0.5 && businessSized) {
    return "HORECA";
  }
  return "CONSUMER";
}

// A channel holding at least this share of a customer's orders "owns" them.
export const CHANNEL_DOMINANCE = 0.7;

export interface ChannelAffinityResult {
  primaryChannel: TxChannel | null;
  affinity: ChannelAffinity;
}

/** Classifies channel spread from a per-channel order count map. */
export function channelAffinityFor(
  channelCounts: Partial<Record<TxChannel, number>>
): ChannelAffinityResult {
  const entries = Object.entries(channelCounts) as [TxChannel, number][];
  const total = entries.reduce((sum, [, n]) => sum + n, 0);
  if (total === 0) return { primaryChannel: null, affinity: "SINGLE_CHANNEL" };

  const sorted = [...entries].sort((a, b) => b[1] - a[1]);
  const primaryChannel = sorted[0][0];
  const distinct = sorted.filter(([, n]) => n > 0).length;
  if (distinct <= 1) return { primaryChannel, affinity: "SINGLE_CHANNEL" };

  const topShare = sorted[0][1] / total;
  // One channel clearly owns them → multi-channel but not fought over.
  // Otherwise genuinely split → CONTESTED, the anti-cannibalization target.
  return {
    primaryChannel,
    affinity: topShare >= CHANNEL_DOMINANCE ? "MULTI_CHANNEL" : "CONTESTED",
  };
}
