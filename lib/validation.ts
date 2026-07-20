import { z } from "zod";
import {
  BRANDS,
  DATA_LEVELS,
  INTERACTION_TYPES,
  PRODUCT_CATEGORIES,
  ROLES,
  CUST_TYPES,
  TX_CHANNELS,
  DEALER_TYPES,
  CONSENT_PURPOSES,
  CONSENT_STATUSES,
  REWARD_TYPES,
  CASE_CATEGORIES,
  CASE_PRIORITIES,
  CASE_STATUSES,
} from "./constants";

export const customerSchema = z.object({
  first_name: z.string().min(1, "First name is required"),
  last_name: z.string().min(1, "Last name is required"),
  email: z.string().email().or(z.literal("")).optional(),
  phone: z.string().optional(),
  brand: z.enum(BRANDS),
  cust_type: z.enum(CUST_TYPES),
  register_channel: z.string().optional(),
  data_level: z.enum(DATA_LEVELS),
  consent_mode: z.enum(["all", "no_marketing"]).default("all"),
});

export const productSchema = z.object({
  sku: z.string().min(1, "SKU is required"),
  name: z.string().min(1, "Product name is required"),
  brand: z.enum(BRANDS),
  category: z.enum(PRODUCT_CATEGORIES).or(z.literal("")).optional(),
  unit_price: z.coerce.number().min(0).default(0),
  reorder_point: z.coerce.number().int().min(0).default(20),
  image_url: z
    .string()
    .url("Image URL must be a valid URL")
    .or(z.literal(""))
    .optional(),
});

export const transactionCreateSchema = z.object({
  customer_id: z.coerce.number().int().positive(),
  channel: z.enum(TX_CHANNELS),
  amount_thb: z.coerce.number().min(0),
});

export const redeemSchema = z.object({
  customer_id: z.coerce.number().int().positive(),
  reward_id: z.coerce.number().int().positive(),
});

export const consentRecordSchema = z.object({
  customer_id: z.coerce.number().int().positive(),
  purpose: z.enum(CONSENT_PURPOSES),
  status: z.enum(CONSENT_STATUSES),
});

export const rewardSchema = z.object({
  name: z.string().min(1, "Reward name is required"),
  description: z.string().optional(),
  reward_type: z.enum(REWARD_TYPES),
  points_cost: z.coerce.number().int().positive(),
});

export const caseCreateSchema = z.object({
  customer_id: z.coerce.number().int().positive().optional(),
  subject: z.string().min(1, "Subject is required"),
  description: z.string().optional(),
  category: z.enum(CASE_CATEGORIES).optional(),
  priority: z.enum(CASE_PRIORITIES).default("MEDIUM"),
});

export const caseStatusSchema = z.object({
  status: z.enum(CASE_STATUSES),
  resolution: z.string().optional(),
});

export const interactionSchema = z.object({
  type: z.enum(INTERACTION_TYPES),
  channel: z.string().optional(),
  amount: z.coerce.number().min(0).default(0),
  points: z.coerce.number().int().default(0),
  description: z.string().optional(),
});

export const roleSchema = z.object({
  role: z.enum(ROLES),
});

export const newUserSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("A valid email is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(ROLES),
});

export const distributorSchema = z.object({
  name: z.string().min(1, "Name is required"),
  region: z.string().optional(),
  channel: z.string().optional(),
  status: z.enum(["active", "inactive"]),
  dealer_type: z.enum(DEALER_TYPES).default("Dealer"),
  area: z.string().optional(),
  customer_id: z.coerce.number().int().positive().optional(),
  contact_name: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().or(z.literal("")).optional(),
  address: z.string().optional(),
  credit_limit: z.coerce.number().min(0).default(0),
});

export const orderLineItemSchema = z.object({
  product_id: z.coerce.number().int().positive(),
  quantity: z.coerce.number().int().positive(),
});

export const orderCreateSchema = z.object({
  distributor_id: z.coerce.number().int().positive(),
  requested_delivery_date: z.string().optional(),
  items: z.array(orderLineItemSchema).min(1, "Add at least one line item"),
});

export const orderDecisionSchema = z.object({
  note: z.string().optional(),
});

export const orderRejectSchema = z.object({
  note: z.string().min(1, "A rejection reason is required"),
});

export const deliveryPlanSchema = z.object({
  distributor_id: z.coerce.number().int().positive(),
  product_id: z.coerce.number().int().positive(),
  plan_date: z.string().min(1, "Plan date is required"),
  planned_qty: z.coerce.number().int().positive(),
});

/** For scheduling delivery of an existing order's lines — see createDeliveryPlanFromOrderAction. */
export const scheduleOrderDeliverySchema = z.object({
  order_id: z.coerce.number().int().positive(),
  plan_date: z.string().min(1, "Plan date is required"),
});

export const inventoryAdjustmentSchema = z.object({
  distributor_id: z.coerce.number().int().positive(),
  product_id: z.coerce.number().int().positive(),
  quantity: z.coerce.number().int().refine((v) => v !== 0, "Quantity must not be zero"),
  note: z.string().optional(),
});

export const distributorReportSchema = z.object({
  distributor_id: z.coerce.number().int().positive(),
  product_id: z.coerce.number().int().positive(),
  period: z.string().min(1, "Period is required"),
  sell_out_qty: z.coerce.number().int().min(0).default(0),
  forecast_qty: z.coerce.number().int().min(0).default(0),
});

export const departmentSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export interface FormState {
  error?: string;
  success?: string;
}

/** Returns the first human-readable message from a failed Zod parse. */
export function firstError(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Please check the form and try again.";
}

/** Normalizes an empty string / whitespace to null, otherwise trims. */
export function nullifyEmpty(value: FormDataEntryValue | null): string | null {
  if (value == null) return null;
  const trimmed = String(value).trim();
  return trimmed === "" ? null : trimmed;
}
