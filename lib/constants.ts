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

export const TIERS = ["Bronze", "Silver", "Gold", "Platinum"] as const;
export type Tier = (typeof TIERS)[number];

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

// Sales/Trade & Channel Enablement: trade channels distributors sell through.
export const TRADE_CHANNELS = [
  "Modern Trade",
  "Traditional Trade",
  "E-Commerce",
  "Food Service",
] as const;
export type TradeChannel = (typeof TRADE_CHANNELS)[number];
