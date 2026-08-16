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

/**
 * LEGACY — superseded by classifyCustomer() below, kept only so
 * db/queries/scores.ts keeps working until it is switched over. Judges on AOV
 * and frequency alone, with invented thresholds and no time window, so it
 * cannot tell a rich consumer from a small restaurant. Do not extend it.
 */
export function behaviorClassFor(input: BehaviorInput): BehaviorClass {
  const aov = input.frequency > 0 ? input.monetary / input.frequency : 0;
  const businessSized = input.frequency >= BUSINESS_MIN_FREQUENCY;

  // Reseller-scale — very large baskets, or a declared B2B buying primarily
  // through the trade (SFA) channel. The old single "TRADE" class now maps to
  // WHOLESALER, the closest member of the six-class ladder; the finer
  // traditional/modern split needs signals this function never had.
  if (businessSized && (aov >= TRADE_AOV || (input.custType === "B2B" && input.sfaShare >= 0.5))) {
    return "WHOLESALER";
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

/* ------------------------------------------------------------------------ *
 * classifyCustomer — the three-tier resolver
 * ------------------------------------------------------------------------ */

/**
 * What each tier can honestly conclude:
 *
 *   VERIFIED  a corporate tax ID proves the customer is a *registered company*.
 *             It does NOT say which trade class — a company can be a wholesaler
 *             or a one-person consultancy. So it sets evidence strength, not
 *             the class itself.
 *   ANCHORED  a dealer record states the trade class as fact.
 *   INFERRED  behaviour. Deliberately limited to CONSUMER / HORECA / WHOLESALER:
 *             nothing in transaction data distinguishes a corner shop from a
 *             supermarket chain, so TRADITIONAL_TRADE and MODERN_TRADE are
 *             reachable ONLY through a dealer anchor. Guessing between them
 *             would be fabrication dressed as classification.
 *   DEFAULT   no evidence at all → CONSUMER.
 *
 * INSTITUTIONAL is staff-assigned and never inferred (see constants.ts).
 */

/** Absolute baht floors. A class needs to clear the floor AND, once there are
 * enough peers to rank against, the peer percentile too. The floor is what
 * lets the engine answer "nobody here is a business" — a percentile alone
 * always finds a top quartile, even in a population of pure consumers. */
export const HORECA_AOV_FLOOR = 3000;
export const WHOLESALER_AOV_FLOOR = 8000;

/** Below this many scored customers, percentile ranking is meaningless and is
 * switched off entirely — floors alone decide. */
export const MIN_POPULATION_FOR_PERCENTILE = 30;

/** Share of a customer's orders on the SFA (trade) channel that reads as
 * "buys through the trade motion". */
export const TRADE_CHANNEL_SHARE = 0.5;

export interface PeerContext {
  /** Number of scored customers available to rank against. */
  population: number;
  /** 75th-percentile average order value across peers, or null when the
   * population is too small to compute one. */
  aovP75: number | null;
}

export interface ClassificationInput {
  custType: CustType;
  /** Tier 1 — from lib/thaiId.ts. JURISTIC means a registered company. */
  taxEntityType?: "JURISTIC" | "NATURAL" | null;
  /** Tier 2 — the linked dealer record, if any. */
  dealer?: { dealerType: string; channel: string | null } | null;
  /** Tier 3 — rolling-window behaviour. */
  frequency: number;
  monetary: number;
  channelCounts: Partial<Record<TxChannel, number>>;
  /** Largest pack size bought, when line items are available. */
  maxPackSize?: number | null;
  /** Share (0–1) of orders placed on weekdays — restaurants skew high. */
  weekdayShare?: number | null;
  /** Staff override; wins over everything. */
  institutionalOverride?: boolean;
}

export interface ClassificationResult {
  behaviorClass: BehaviorClass;
  tier: import("./constants").ResolutionTier;
  /** Evidence tiers point different ways — a human should look. */
  disagreement: boolean;
  /** Plain-language evidence, safe to show staff. Never contains an ID number. */
  reasons: string[];
}

/** Dealer record → trade class. DEALER_TYPES is only Dealer|Retailer and
 * TRADE_CHANNELS carries no wholesaler entry, so "Dealer ⇒ redistributes
 * onward ⇒ wholesaler" is a derivation from the data model, not a fact
 * asserted by it. Confirm against the real business before trusting it. */
function classFromDealer(dealerType: string, channel: string | null): BehaviorClass {
  if (channel === "Food Service") return "HORECA";
  if (dealerType === "Dealer") return "WHOLESALER";
  if (channel === "Modern Trade") return "MODERN_TRADE";
  if (channel === "Traditional Trade") return "TRADITIONAL_TRADE";
  return "TRADITIONAL_TRADE";
}

/** Behaviour-only inference. Returns CONSUMER when the evidence doesn't clear
 * the bar — that is the correct answer far more often than not. */
function inferFromBehaviour(
  input: ClassificationInput,
  peers: PeerContext
): { behaviorClass: BehaviorClass; reasons: string[] } {
  const reasons: string[] = [];
  const aov = input.frequency > 0 ? input.monetary / input.frequency : 0;

  if (input.frequency < BUSINESS_MIN_FREQUENCY) {
    return {
      behaviorClass: "CONSUMER",
      reasons: [`Only ${input.frequency} order(s) in window — too few to read a pattern.`],
    };
  }

  // Percentile gate, but only once there are enough peers to rank against.
  const percentileApplies = peers.population >= MIN_POPULATION_FOR_PERCENTILE && peers.aovP75 != null;
  if (percentileApplies && aov < (peers.aovP75 as number)) {
    return {
      behaviorClass: "CONSUMER",
      reasons: [
        `Average order ฿${Math.round(aov)} is below the peer 75th percentile (฿${Math.round(peers.aovP75 as number)}).`,
      ],
    };
  }
  if (!percentileApplies) {
    reasons.push(
      `Peer ranking off (${peers.population} scored customers, need ${MIN_POPULATION_FOR_PERCENTILE}) — absolute floors only.`
    );
  }

  const total = Object.values(input.channelCounts).reduce((sum, n) => sum + (n ?? 0), 0);
  const sfaShare = total > 0 ? (input.channelCounts.SFA ?? 0) / total : 0;

  if (aov >= WHOLESALER_AOV_FLOOR || (input.custType === "B2B" && sfaShare >= TRADE_CHANNEL_SHARE)) {
    reasons.push(
      aov >= WHOLESALER_AOV_FLOOR
        ? `Average order ฿${Math.round(aov)} clears the wholesaler floor (฿${WHOLESALER_AOV_FLOOR}).`
        : `${Math.round(sfaShare * 100)}% of orders on the trade channel.`
    );
    return { behaviorClass: "WHOLESALER", reasons };
  }

  if (aov >= HORECA_AOV_FLOOR && sfaShare < TRADE_CHANNEL_SHARE) {
    reasons.push(
      `Average order ฿${Math.round(aov)} clears the HoReCa floor (฿${HORECA_AOV_FLOOR}) on consumer channels.`
    );
    if (input.maxPackSize != null && input.maxPackSize >= 5) {
      reasons.push(`Buys bulk formats (largest pack ${input.maxPackSize}).`);
    }
    if (input.weekdayShare != null && input.weekdayShare >= 0.8) {
      reasons.push(`${Math.round(input.weekdayShare * 100)}% of orders on weekdays.`);
    }
    return { behaviorClass: "HORECA", reasons };
  }

  reasons.push(`Average order ฿${Math.round(aov)} is below every business floor.`);
  return { behaviorClass: "CONSUMER", reasons };
}

export function classifyCustomer(
  input: ClassificationInput,
  peers: PeerContext
): ClassificationResult {
  // Staff override outranks every signal — a human said so.
  if (input.institutionalOverride) {
    return {
      behaviorClass: "INSTITUTIONAL",
      tier: "ANCHORED",
      disagreement: false,
      reasons: ["Set to institutional by staff."],
    };
  }

  const inferred = inferFromBehaviour(input, peers);

  // Tier 2 — a dealer record states the class outright.
  if (input.dealer) {
    const anchored = classFromDealer(input.dealer.dealerType, input.dealer.channel);
    const disagreement = inferred.behaviorClass !== anchored;
    return {
      behaviorClass: anchored,
      tier: "ANCHORED",
      disagreement,
      reasons: [
        `Linked dealer record: ${input.dealer.dealerType}${input.dealer.channel ? ` · ${input.dealer.channel}` : ""}.`,
        ...(disagreement
          ? [`Buying behaviour reads as ${inferred.behaviorClass} instead — worth a look.`]
          : []),
      ],
    };
  }

  // Tier 1 — a corporate tax ID proves "registered company", not which class.
  // So the class still comes from behaviour; the tier records that we have
  // hard proof, and any "buys like a consumer" result is flagged rather than
  // overwritten (a one-person company, or an employee expensing purchases,
  // both look exactly like this).
  if (input.taxEntityType === "JURISTIC") {
    const disagreement = inferred.behaviorClass === "CONSUMER";
    return {
      behaviorClass: inferred.behaviorClass,
      tier: "VERIFIED",
      disagreement,
      reasons: [
        "Registered company (corporate tax ID on file).",
        ...inferred.reasons,
        ...(disagreement
          ? ["Registered as a company but buying like a consumer — confirm the owning side."]
          : []),
      ],
    };
  }

  // Tier 3 / default.
  const isDefault = inferred.behaviorClass === "CONSUMER";
  return {
    behaviorClass: inferred.behaviorClass,
    tier: isDefault ? "DEFAULT" : "INFERRED",
    // A declared B2B that behaves like a consumer is worth a look too.
    disagreement: input.custType === "B2B" && isDefault,
    reasons: inferred.reasons,
  };
}
