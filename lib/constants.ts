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
export const CONSENT_PURPOSES = ["MARKETING", "ANALYTICS", "PROFILING"] as const;
export type ConsentPurpose = (typeof CONSENT_PURPOSES)[number];

export const CONSENT_PURPOSE_LABELS: Record<ConsentPurpose, string> = {
  MARKETING: "Marketing",
  ANALYTICS: "Analytics",
  PROFILING: "Profiling",
};

export const CONSENT_STATUSES = ["GRANTED", "DENIED", "WITHDRAWN"] as const;
export type ConsentStatus = (typeof CONSENT_STATUSES)[number];

export const REWARD_TYPES = ["VOUCHER", "PRODUCT", "DISCOUNT", "EXPERIENCE"] as const;
export type RewardType = (typeof REWARD_TYPES)[number];

export const CASE_CATEGORIES = ["POINTS", "REDEMPTION", "PRODUCT", "DELIVERY", "ACCOUNT", "OTHER"] as const;
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
};

// Sales/Trade & Channel Enablement: trade channels distributors sell through.
export const TRADE_CHANNELS = [
  "Modern Trade",
  "Traditional Trade",
  "E-Commerce",
  "Food Service",
] as const;
export type TradeChannel = (typeof TRADE_CHANNELS)[number];
