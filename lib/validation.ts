import { z } from "zod";
import {
  BRANDS,
  TIERS,
  DATA_LEVELS,
  INTERACTION_TYPES,
  PRODUCT_CATEGORIES,
  ROLES,
} from "./constants";

export const customerSchema = z.object({
  first_name: z.string().min(1, "First name is required"),
  last_name: z.string().min(1, "Last name is required"),
  email: z.string().email().or(z.literal("")).optional(),
  phone: z.string().optional(),
  brand: z.enum(BRANDS),
  tier: z.enum(TIERS),
  points: z.coerce.number().int().min(0).default(0),
  register_channel: z.string().optional(),
  data_level: z.enum(DATA_LEVELS),
  consent_pdpa: z.boolean(),
  consent_marketing: z.boolean(),
  consent_migration: z.boolean(),
});

export const productSchema = z.object({
  sku: z.string().min(1, "SKU is required"),
  name: z.string().min(1, "Product name is required"),
  brand: z.enum(BRANDS),
  category: z.enum(PRODUCT_CATEGORIES).or(z.literal("")).optional(),
  unit_price: z.coerce.number().min(0).default(0),
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

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export interface FormState {
  error?: string;
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
