import { z } from "zod";
import {
  BRANDS,
  DATA_LEVELS,
  CUST_TYPES,
  TX_CHANNELS,
  CONSENT_PURPOSES,
  CONSENT_STATUSES,
  CASE_CATEGORIES,
  CASE_PRIORITIES,
} from "./constants";

export const apiMemberSchema = z.object({
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  brand: z.enum(BRANDS),
  cust_type: z.enum(CUST_TYPES).default("B2C"),
  register_channel: z.string().optional(),
  data_level: z.enum(DATA_LEVELS).default("Register"),
  consent_mode: z.enum(["all", "no_marketing"]).default("all"),
});

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
