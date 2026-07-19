import type { Tier } from "./constants";

/**
 * Next Best Action — consent-aware, rule-ordered (first match wins). Pure so it
 * can be unit-tested; db/queries/insights.ts gathers the inputs and delegates.
 */

export interface NbaInput {
  hasMarketing: boolean;
  tier: Tier;
  clv: number;
  balance: number;
  txLast30d: number;
  memberAgeDays: number;
}

export interface NbaResult {
  action: string;
  title: string;
  reason: string;
}

export function nextBestAction(input: NbaInput): NbaResult {
  if (!input.hasMarketing) {
    return {
      action: "REQUEST_CONSENT",
      title: "Request marketing consent",
      reason:
        "No marketing consent on file — every outbound journey is blocked until the member opts in.",
    };
  }
  if (input.tier === "Gold" && input.clv >= 20000) {
    return {
      action: "PREMIUM_INVITE",
      title: "Invite to premium sampling",
      reason: "High-value Gold member — a good candidate for a premium product sampling invitation.",
    };
  }
  if (input.balance > 400 && input.txLast30d === 0) {
    return {
      action: "PUSH_REDEMPTION",
      title: "Nudge to redeem points",
      reason: `Sitting on ${input.balance} points with no purchase in 30 days — a redemption reminder re-engages them.`,
    };
  }
  if (input.memberAgeDays < 30) {
    return {
      action: "ONBOARDING",
      title: "Send onboarding journey",
      reason: "New member (< 30 days) — walk them through earning and rewards to build the habit.",
    };
  }
  return {
    action: "SEGMENT_CAMPAIGN",
    title: "Include in next segment campaign",
    reason: "No urgent signal — target through the standard campaign calendar for their segment.",
  };
}
