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
 * classifyCustomer — the evidence resolver
 * ------------------------------------------------------------------------ */

/**
 * EXECUTION ORDER (what actually runs, top to bottom):
 *
 *   1. institutionalOverride  staff said so. Wins over everything, never flags.
 *   2. dealer anchor          → ANCHORED
 *   3. JURISTIC tax ID        → VERIFIED
 *   4. behaviour              → INFERRED, or DEFAULT when it lands on CONSUMER
 *
 * Note this is NOT the "Tier 1 / Tier 2" numbering used in the customer UI,
 * which labels the tax ID "Tier 1" and the dealer link "Tier 2". The dealer
 * anchor short-circuits FIRST. The numbering is a labelling convention only —
 * do not describe VERIFIED as outranking ANCHORED.
 *
 * What each tier can honestly conclude:
 *
 *   VERIFIED  a corporate tax ID proves the customer is a *registered company*.
 *             It does NOT say which trade class — a company can be a wholesaler
 *             or a one-person consultancy. So it sets evidence strength, and
 *             the class still comes from behaviour. A NATURAL (individual) ID
 *             has no effect at all.
 *   ANCHORED  a dealer record states the trade class as fact. Also carries the
 *             staff INSTITUTIONAL override, for want of a "manual" tier value.
 *   INFERRED  behaviour produced HORECA or WHOLESALER. Deliberately limited:
 *             nothing in transaction data distinguishes a corner shop from a
 *             supermarket chain, so TRADITIONAL_TRADE and MODERN_TRADE are
 *             reachable ONLY through a dealer anchor. Guessing between them
 *             would be fabrication dressed as classification.
 *   DEFAULT   behaviour landed on CONSUMER. This is NOT "no evidence" — a
 *             customer with 40 orders and small baskets lands here too. The
 *             reason codes distinguish the cases; the tier alone does not.
 *
 * INSTITUTIONAL is staff-assigned and never inferred (see constants.ts).
 */

/** Absolute baht floors. A class needs to clear the floor AND, once there are
 * enough peers to rank against, the peer percentile too. The floor is what
 * lets the engine answer "nobody here is a business" — a percentile alone
 * always finds a top quartile, even in a population of pure consumers. */
export const HORECA_AOV_FLOOR = 3000;
export const WHOLESALER_AOV_FLOOR = 8000;

/** Below this many customers in the peer population, percentile ranking is
 * meaningless and is switched off entirely — floors alone decide. Note the
 * population counts customers ACTIVE IN THE WINDOW, not all scored customers
 * (see PeerContext.population). */
export const MIN_POPULATION_FOR_PERCENTILE = 30;

/** Rolling window the CLASSIFIER judges on, and the window bounding the
 * line-item aggregates (max pack size, distinct SKUs) stored alongside it.
 * RFM/churn/channel-affinity deliberately keep using all-time figures — "what
 * they're worth" and "what they are right now" are different questions, and a
 * closed restaurant should stop reading as HoReCa without also erasing its
 * lifetime value.
 *
 * Lives here rather than beside the query that uses it so that UI explaining
 * the classifier can cite the window without importing db/queries/* — which
 * would pull the Postgres driver into a client bundle. */
export const CLASSIFY_WINDOW_DAYS = 90;

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

/** One piece of evidence, recorded language-neutrally.
 *
 * These used to be pre-baked English sentences. They are now (code, params)
 * so the same trace can render in Thai or English, and so the numbers that
 * actually drove the decision survive into storage — the windowed AOV is NOT
 * recoverable from customer_scores afterwards (the stored rfm_* columns are
 * all-time quintile *scores*, not amounts).
 *
 * PII invariant, previously only a comment: no variant carries a field
 * sourced from customers.tax_id_*. JURISTIC_TAX_ID has no params at all, so
 * an identity number cannot end up in here by construction.
 */
type Reason<C extends string, P> = { code: C; params: P };

export type ClassificationReason =
  | Reason<"TOO_FEW_ORDERS", { frequency: number; minFrequency: number; windowDays: number }>
  | Reason<"AOV_BELOW_PEER_P75", { aov: number; aovP75: number }>
  | Reason<"PEER_RANKING_OFF", { population: number; minPopulation: number; windowDays: number }>
  | Reason<"AOV_CLEARS_WHOLESALER_FLOOR", { aov: number; floor: number }>
  | Reason<"TRADE_CHANNEL_SHARE_HIGH", { sfaShare: number; threshold: number }>
  | Reason<"AOV_CLEARS_HORECA_FLOOR", { aov: number; floor: number }>
  | Reason<"BULK_PACK_FORMATS", { maxPackSize: number }>
  | Reason<"WEEKDAY_CONCENTRATION", { weekdayShare: number }>
  | Reason<"AOV_BELOW_ALL_FLOORS", { aov: number; horecaFloor: number; wholesalerFloor: number }>
  | Reason<"STAFF_INSTITUTIONAL_OVERRIDE", Record<string, never>>
  | Reason<"DEALER_ANCHOR", { dealerType: string; channel: string | null }>
  | Reason<"ANCHOR_BEHAVIOUR_DISAGREE", { inferredClass: BehaviorClass }>
  | Reason<"JURISTIC_TAX_ID", Record<string, never>>
  | Reason<"JURISTIC_BUT_CONSUMER", Record<string, never>>;

export type ReasonCode = ClassificationReason["code"];

export interface ClassificationResult {
  behaviorClass: BehaviorClass;
  tier: import("./constants").ResolutionTier;
  /** Evidence tiers point different ways — a human should look. */
  disagreement: boolean;
  /** Trace of the branch that actually ran, in the order it ran. Render via
   * lib/classificationCopy.ts — never interpolate a raw code into UI. */
  reasons: ClassificationReason[];
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
): { behaviorClass: BehaviorClass; reasons: ClassificationReason[] } {
  const reasons: ClassificationReason[] = [];
  const aov = input.frequency > 0 ? input.monetary / input.frequency : 0;

  if (input.frequency < BUSINESS_MIN_FREQUENCY) {
    return {
      behaviorClass: "CONSUMER",
      reasons: [
        {
          code: "TOO_FEW_ORDERS",
          params: {
            frequency: input.frequency,
            minFrequency: BUSINESS_MIN_FREQUENCY,
            windowDays: CLASSIFY_WINDOW_DAYS,
          },
        },
      ],
    };
  }

  // Percentile gate, but only once there are enough peers to rank against.
  const percentileApplies = peers.population >= MIN_POPULATION_FOR_PERCENTILE && peers.aovP75 != null;
  if (percentileApplies && aov < (peers.aovP75 as number)) {
    return {
      behaviorClass: "CONSUMER",
      reasons: [
        { code: "AOV_BELOW_PEER_P75", params: { aov, aovP75: peers.aovP75 as number } },
      ],
    };
  }
  if (!percentileApplies) {
    reasons.push({
      code: "PEER_RANKING_OFF",
      params: {
        population: peers.population,
        minPopulation: MIN_POPULATION_FOR_PERCENTILE,
        windowDays: CLASSIFY_WINDOW_DAYS,
      },
    });
  }

  const total = Object.values(input.channelCounts).reduce((sum, n) => sum + (n ?? 0), 0);
  const sfaShare = total > 0 ? (input.channelCounts.SFA ?? 0) / total : 0;

  if (aov >= WHOLESALER_AOV_FLOOR || (input.custType === "B2B" && sfaShare >= TRADE_CHANNEL_SHARE)) {
    reasons.push(
      aov >= WHOLESALER_AOV_FLOOR
        ? { code: "AOV_CLEARS_WHOLESALER_FLOOR", params: { aov, floor: WHOLESALER_AOV_FLOOR } }
        : { code: "TRADE_CHANNEL_SHARE_HIGH", params: { sfaShare, threshold: TRADE_CHANNEL_SHARE } }
    );
    return { behaviorClass: "WHOLESALER", reasons };
  }

  if (aov >= HORECA_AOV_FLOOR && sfaShare < TRADE_CHANNEL_SHARE) {
    reasons.push({ code: "AOV_CLEARS_HORECA_FLOOR", params: { aov, floor: HORECA_AOV_FLOOR } });
    // Supporting colour only — neither of these can change the class. They are
    // pushed inside the HoReCa branch that has ALREADY been taken. Any UI must
    // present them as corroboration, never as a cause.
    if (input.maxPackSize != null && input.maxPackSize >= 5) {
      reasons.push({ code: "BULK_PACK_FORMATS", params: { maxPackSize: input.maxPackSize } });
    }
    if (input.weekdayShare != null && input.weekdayShare >= 0.8) {
      reasons.push({ code: "WEEKDAY_CONCENTRATION", params: { weekdayShare: input.weekdayShare } });
    }
    return { behaviorClass: "HORECA", reasons };
  }

  reasons.push({
    code: "AOV_BELOW_ALL_FLOORS",
    params: { aov, horecaFloor: HORECA_AOV_FLOOR, wholesalerFloor: WHOLESALER_AOV_FLOOR },
  });
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
      // NOTE: recorded as ANCHORED because there is no "manual" tier value.
      // UI must special-case this — RESOLUTION_TIER_LABELS.ANCHORED reads
      // "Anchored (dealer record)", which is false for a staff override.
      // Detect it via this reason code or behaviorClass === "INSTITUTIONAL".
      tier: "ANCHORED",
      disagreement: false,
      reasons: [{ code: "STAFF_INSTITUTIONAL_OVERRIDE", params: {} }],
    };
  }

  const inferred = inferFromBehaviour(input, peers);

  // A dealer record states the class outright. Note this is evaluated BEFORE
  // the tax-ID check below — despite the "Tier 1 / Tier 2" naming used in the
  // UI, the dealer anchor short-circuits first.
  if (input.dealer) {
    const anchored = classFromDealer(input.dealer.dealerType, input.dealer.channel);
    const disagreement = inferred.behaviorClass !== anchored;
    return {
      behaviorClass: anchored,
      tier: "ANCHORED",
      disagreement,
      reasons: [
        {
          code: "DEALER_ANCHOR",
          params: { dealerType: input.dealer.dealerType, channel: input.dealer.channel },
        },
        ...(disagreement
          ? ([
              {
                code: "ANCHOR_BEHAVIOUR_DISAGREE",
                params: { inferredClass: inferred.behaviorClass },
              },
            ] as ClassificationReason[])
          : []),
      ],
    };
  }

  // A corporate tax ID proves "registered company", not which class. So the
  // class still comes from behaviour; the tier only records that we have hard
  // proof of the entity, and any "buys like a consumer" result is flagged
  // rather than overwritten (a one-person company, or an employee expensing
  // purchases, both look exactly like this).
  //
  // A NATURAL (individual) ID has no branch here and no effect whatsoever.
  if (input.taxEntityType === "JURISTIC") {
    const disagreement = inferred.behaviorClass === "CONSUMER";
    return {
      behaviorClass: inferred.behaviorClass,
      tier: "VERIFIED",
      disagreement,
      reasons: [
        { code: "JURISTIC_TAX_ID", params: {} },
        ...inferred.reasons,
        ...(disagreement
          ? ([{ code: "JURISTIC_BUT_CONSUMER", params: {} }] as ClassificationReason[])
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
