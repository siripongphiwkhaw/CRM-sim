// Domain constants for the loyalty / CDP platform. Brand names below are
// fictional placeholders and do not refer to any real company or product.

export const BRANDS = [
  "Umeya",
  "Sunmato",
  "VitaCharge",
  "GoldLeaf",
  "FreshPantry",
  "NutriWell",
] as const;
export type Brand = (typeof BRANDS)[number];

export const TIERS = ["Bronze", "Silver", "Gold"] as const;
export type Tier = (typeof TIERS)[number];

// B2C vs B2B members: drives loyalty earn rate and channel eligibility.
export const CUST_TYPES = ["B2C", "B2B"] as const;
export type CustType = (typeof CUST_TYPES)[number];

// Purchase transaction channels. POS/ECOM/D2C are B2C; SFA is B2B.
export const TX_CHANNELS = ["POS", "ECOM", "D2C", "SFA"] as const;
export type TxChannel = (typeof TX_CHANNELS)[number];

export const TX_CHANNEL_LABELS: Record<TxChannel, string> = {
  POS: "Point of Sale",
  ECOM: "E-Commerce",
  D2C: "Direct to Consumer",
  SFA: "Sales Force (B2B)",
};

export const DEALER_TYPES = ["Dealer", "Retailer"] as const;
export type DealerType = (typeof DEALER_TYPES)[number];

// PDPA consent: per-purpose, with a granted/denied/withdrawn lifecycle.
// IDENTITY_VERIFICATION gates storage of a 13-digit identity number. Under
// PDPA a national ID is sensitive personal data, so it is only ever stored
// against an explicit, separately-granted purpose — never bundled into
// MARKETING or ANALYTICS consent.
export const CONSENT_PURPOSES = [
  "MARKETING",
  "ANALYTICS",
  "PROFILING",
  "IDENTITY_VERIFICATION",
] as const;
export type ConsentPurpose = (typeof CONSENT_PURPOSES)[number];

export const CONSENT_PURPOSE_LABELS: Record<ConsentPurpose, string> = {
  MARKETING: "Marketing",
  ANALYTICS: "Analytics",
  PROFILING: "Profiling",
  IDENTITY_VERIFICATION: "Identity verification",
};

export const CONSENT_STATUSES = ["GRANTED", "DENIED", "WITHDRAWN"] as const;
export type ConsentStatus = (typeof CONSENT_STATUSES)[number];

export const REWARD_TYPES = ["VOUCHER", "PRODUCT", "DISCOUNT", "EXPERIENCE"] as const;
export type RewardType = (typeof REWARD_TYPES)[number];

export const REWARD_STATUSES = ["DRAFT", "PUBLISHED", "SUSPENDED"] as const;
export type RewardStatus = (typeof REWARD_STATUSES)[number];

export const MISSION_TYPES = ["GENERAL", "PURCHASE", "SOCIAL", "SURVEY"] as const;
export type MissionType = (typeof MISSION_TYPES)[number];

export const MISSION_STATUSES = ["DRAFT", "PUBLISHED", "SUSPENDED"] as const;
export type MissionStatus = (typeof MISSION_STATUSES)[number];

export const MISSION_SUBMISSION_STATUSES = ["PENDING", "APPROVED", "REJECTED"] as const;
export type MissionSubmissionStatus = (typeof MISSION_SUBMISSION_STATUSES)[number];

export const SEGMENT_TYPES = ["custom", "ai"] as const;
export type SegmentType = (typeof SEGMENT_TYPES)[number];

export const CAMPAIGN_CHANNELS = ["LINE", "Email", "Push", "SMS"] as const;
export type CampaignChannel = (typeof CAMPAIGN_CHANNELS)[number];

export const CAMPAIGN_STATUSES = ["DRAFT", "SCHEDULED", "RUNNING", "PAUSED", "DONE"] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

export const CHURN_LEVELS = ["High", "Medium", "Low"] as const;
export type ChurnLevel = (typeof CHURN_LEVELS)[number];

/**
 * What a customer's buying says they are, independent of the declared
 * cust_type. Follows the FMCG route-to-market ladder (Modern Trade / General
 * Trade / HoReCa / Wholesale) with one deliberate addition: industry channel
 * taxonomies have no CONSUMER member, because the consumer *ends* the channel
 * rather than sitting in it. This CRM serves B2C loyalty and B2B trade from
 * one customer table, so the end-consumer needs a home in the same enum.
 *
 * HORECA is the cross-channel leak case: a chef or small restaurant buying on
 * consumer channels while also holding a trade account.
 */
export const BEHAVIOR_CLASSES = [
  "CONSUMER",
  "HORECA",
  "TRADITIONAL_TRADE",
  "MODERN_TRADE",
  "WHOLESALER",
  "INSTITUTIONAL",
] as const;
export type BehaviorClass = (typeof BEHAVIOR_CLASSES)[number];

export const BEHAVIOR_CLASS_LABELS: Record<BehaviorClass, string> = {
  CONSUMER: "Consumer",
  HORECA: "HoReCa (food service)",
  TRADITIONAL_TRADE: "Traditional trade",
  MODERN_TRADE: "Modern trade",
  WHOLESALER: "Wholesaler",
  INSTITUTIONAL: "Institutional",
};

/**
 * INSTITUTIONAL (school / hospital / factory canteen) is deliberately absent:
 * nothing in transaction data separates it from HORECA — both buy in bulk on a
 * weekday cadence — so it is set by staff and never guessed. A class the
 * engine cannot populate honestly is a class that lies.
 */
export const INFERRABLE_BEHAVIOR_CLASSES = [
  "CONSUMER",
  "HORECA",
  "TRADITIONAL_TRADE",
  "MODERN_TRADE",
  "WHOLESALER",
] as const satisfies readonly BehaviorClass[];
export type InferrableBehaviorClass = (typeof INFERRABLE_BEHAVIOR_CLASSES)[number];

/** Every class except CONSUMER implies a business buyer. Callers should use
 * this rather than listing the five classes inline, so adding a class later
 * doesn't silently miss a check. */
export function isBusinessBehaviorClass(behaviorClass: BehaviorClass): boolean {
  return behaviorClass !== "CONSUMER";
}

/**
 * How confident we are in a classification, and therefore which source won.
 * A lower tier never overrides a higher one — when they disagree the higher
 * tier stands and a review flag is raised instead.
 */
export const RESOLUTION_TIERS = ["VERIFIED", "ANCHORED", "INFERRED", "DEFAULT"] as const;
export type ResolutionTier = (typeof RESOLUTION_TIERS)[number];

export const RESOLUTION_TIER_LABELS: Record<ResolutionTier, string> = {
  VERIFIED: "Verified (tax ID)",
  ANCHORED: "Anchored (dealer record)",
  INFERRED: "Inferred (behaviour)",
  DEFAULT: "Unclassified",
};

// Which channels a customer buys through. CONTESTED = active across ≥2
// channels in the window — the customer the channels are competing over.
export const CHANNEL_AFFINITIES = ["SINGLE_CHANNEL", "MULTI_CHANNEL", "CONTESTED"] as const;
export type ChannelAffinity = (typeof CHANNEL_AFFINITIES)[number];

export const CHANNEL_AFFINITY_LABELS: Record<ChannelAffinity, string> = {
  SINGLE_CHANNEL: "Single channel",
  MULTI_CHANNEL: "Multi-channel",
  CONTESTED: "Contested",
};

// Promo intent — an acquisition campaign spends to win new demand; a retention
// campaign keeps an existing customer. Drives the acquisition-waste guard.
export const CAMPAIGN_TYPES = ["acquisition", "retention"] as const;
export type CampaignType = (typeof CAMPAIGN_TYPES)[number];

export const AUDIT_ACTIONS = [
  "create", "update", "publish", "suspend", "delete", "launch", "pause", "resume",
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export const CASE_CATEGORIES = ["POINTS", "REDEMPTION", "PRODUCT", "DELIVERY", "ACCOUNT", "OTHER", "IDENTITY_REVIEW"] as const;
export type CaseCategory = (typeof CASE_CATEGORIES)[number];

export const CASE_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
export type CasePriority = (typeof CASE_PRIORITIES)[number];

export const CASE_STATUSES = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"] as const;
export type CaseStatus = (typeof CASE_STATUSES)[number];

export const CASE_STATUS_LABELS: Record<CaseStatus, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In Progress",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
};

export const INSIGHT_TYPES = [
  "CHANNEL_CONFLICT",
  "LOW_SELLOUT_RATE",
  "LOW_SELLIN_STOCK",
  "OUT_OF_STOCK",
  "REORDER_POINT",
  "CONSENT_GAP",
  "LIABILITY_HIGH",
  "CHURN_RISK",
  "DEALER_UNLINKED",
  "CHANNEL_CANNIBALIZATION",
  "RECLASSIFY_SUGGESTION",
] as const;
export type InsightType = (typeof INSIGHT_TYPES)[number];

export const INSIGHT_SEVERITIES = ["CRITICAL", "WARNING", "OPPORTUNITY", "INFO"] as const;
export type InsightSeverity = (typeof INSIGHT_SEVERITIES)[number];

export const CHANNELS = [
  "LINE OA",
  "SAP",
  "Web",
  "Store",
  "Mobile App",
] as const;
export type Channel = (typeof CHANNELS)[number];

// The RFP's "3 levels" of customer data collection.
export const DATA_LEVELS = [
  "Register",
  "Enrichment",
  "Purchase & Engagement",
] as const;
export type DataLevel = (typeof DATA_LEVELS)[number];

export const INTERACTION_TYPES = [
  "register",
  "enrichment",
  "purchase",
  "engagement",
] as const;
export type InteractionType = (typeof INTERACTION_TYPES)[number];

export const INTERACTION_TYPE_LABELS: Record<InteractionType, string> = {
  register: "Register",
  enrichment: "Enrichment",
  purchase: "Purchase",
  engagement: "Engagement",
};

// Data Cloud / integration source systems for data linkage.
export const SOURCE_TYPES = ["CDP", "SAP", "LINE OA", "SFA", "Web"] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

export const SOURCE_STATUSES = ["connected", "syncing", "error"] as const;
export type SourceStatus = (typeof SOURCE_STATUSES)[number];

export const SYNC_MODES = ["realtime", "batch"] as const;
export type SyncMode = (typeof SYNC_MODES)[number];

export const PRODUCT_CATEGORIES = [
  "Seasoning",
  "Beverage",
  "Health & Nutrition",
  "Frozen Food",
  "Sauce",
] as const;
export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

export const ROLES = ["admin", "user"] as const;
export type Role = (typeof ROLES)[number];

// Gateable modules. A department grants a subset of these to its members; the
// admin role always holds all of them. Home, Guide, SQL Console and Setup are
// deliberately absent: the first two are always available, the last two are
// admin-only and never granted through a department.
export const MODULES = [
  "customers",
  "loyalty",
  "cases",
  "insights",
  "products",
  "channel",
  "data-cloud",
  "marketing",
] as const;
export type ModuleKey = (typeof MODULES)[number];

export const MODULE_LABELS: Record<ModuleKey, string> = {
  customers: "Members",
  loyalty: "Loyalty",
  cases: "Cases",
  insights: "AI Insights",
  products: "Products",
  channel: "Sales & Channel",
  "data-cloud": "Data Cloud",
  marketing: "Marketing",
};

/** Route prefix each module owns — used by the rail and by proxy.ts gating. */
export const MODULE_ROUTES: Record<ModuleKey, string> = {
  customers: "/customers",
  loyalty: "/loyalty",
  cases: "/cases",
  insights: "/insights",
  products: "/products",
  channel: "/channel",
  "data-cloud": "/data-cloud",
  marketing: "/marketing",
};

// Sales/Trade & Channel Enablement: trade channels distributors sell through.
export const TRADE_CHANNELS = [
  "Modern Trade",
  "Traditional Trade",
  "E-Commerce",
  "Food Service",
] as const;
export type TradeChannel = (typeof TRADE_CHANNELS)[number];
