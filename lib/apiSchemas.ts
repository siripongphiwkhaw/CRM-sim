import { z } from "zod";
import {
  BRANDS,
  DATA_LEVELS,
  TX_CHANNELS,
  PAYMENT_TERMS,
  CONSENT_PURPOSES,
  CONSENT_STATUSES,
  CASE_CATEGORIES,
  CASE_PRIORITIES,
} from "./constants";

const apiMemberBaseFields = {
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  brand: z.enum(BRANDS),
  register_channel: z.string().optional(),
  data_level: z.enum(DATA_LEVELS).default("Register"),
  consent_mode: z.enum(["all", "no_marketing"]).default("all"),
};

// A body with no cust_type is treated as B2C, keeping existing API clients
// working. A B2B body must carry the company profile the DB CHECK requires —
// the API cannot create a half-formed B2B account.
export const apiMemberSchema = z.preprocess(
  (v) =>
    v && typeof v === "object" && !("cust_type" in v)
      ? { ...v, cust_type: "B2C" }
      : v,
  z.discriminatedUnion("cust_type", [
    z.object({ ...apiMemberBaseFields, cust_type: z.literal("B2C") }),
    z.object({
      ...apiMemberBaseFields,
      cust_type: z.literal("B2B"),
      company_name: z.string().min(1, "company_name is required for a B2B member"),
      billing_address: z.string().min(1, "billing_address is required for a B2B member"),
      payment_terms: z.enum(PAYMENT_TERMS),
      company_branch_code: z.string().optional(),
      contact_person: z.string().optional(),
      credit_limit: z.coerce.number().min(0).default(0),
    }),
  ])
);

export const apiConsentSchema = z.object({
  customer_id: z.coerce.number().int().positive(),
  purpose: z.enum(CONSENT_PURPOSES),
  status: z.enum(CONSENT_STATUSES),
});

export const apiTransactionSchema = z.object({
  customer_id: z.coerce.number().int().positive(),
  channel: z.enum(TX_CHANNELS),
  amount_thb: z.coerce.number().min(0),
  // Optional here (unlike the staff form) so existing API clients keep working;
  // unattributed rows just fall into the "Unattributed" breakdown bucket.
  brand: z.enum(BRANDS).optional(),
});

export const apiEarnSchema = z.object({
  customer_id: z.coerce.number().int().positive(),
  points: z.coerce.number().int().positive(),
  note: z.string().optional(),
});

export const apiRedeemSchema = z.object({
  customer_id: z.coerce.number().int().positive(),
  reward_id: z.coerce.number().int().positive(),
});

export const apiCaseSchema = z.object({
  customer_id: z.coerce.number().int().positive().optional(),
  subject: z.string().min(1),
  description: z.string().optional(),
  category: z.enum(CASE_CATEGORIES).optional(),
  priority: z.enum(CASE_PRIORITIES).default("MEDIUM"),
});

export const apiSellInSchema = z.object({
  dealer_id: z.coerce.number().int().positive(),
  product_id: z.coerce.number().int().positive(),
  quantity: z.coerce.number().int().positive(),
});

export const apiSellOutSchema = z.object({
  dealer_id: z.coerce.number().int().positive(),
  product_id: z.coerce.number().int().positive(),
  quantity: z.coerce.number().int().positive(),
  period: z.string().optional(),
});

export const apiReorderSchema = z.object({
  dealer_id: z.coerce.number().int().positive(),
  product_id: z.coerce.number().int().positive(),
});

export const apiNotificationSchema = z.object({
  customer_id: z.coerce.number().int().positive(),
  message: z.string().min(1),
});
