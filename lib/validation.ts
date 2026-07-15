import { z } from "zod";
import { DEAL_STAGES, TASK_TYPES } from "./constants";

export const contactSchema = z.object({
  first_name: z.string().min(1, "First name is required"),
  last_name: z.string().min(1, "Last name is required"),
  email: z.string().email().or(z.literal("")).optional(),
  phone: z.string().optional(),
  title: z.string().optional(),
  company_id: z.coerce.number().int().positive().optional().nullable(),
  notes: z.string().optional(),
});

export const companySchema = z.object({
  name: z.string().min(1, "Company name is required"),
  industry: z.string().optional(),
  website: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
});

export const dealSchema = z.object({
  title: z.string().min(1, "Deal title is required"),
  value: z.coerce.number().min(0).default(0),
  stage: z.enum(DEAL_STAGES),
  contact_id: z.coerce.number().int().positive().optional().nullable(),
  company_id: z.coerce.number().int().positive().optional().nullable(),
  expected_close_date: z.string().optional(),
});

export const taskSchema = z.object({
  type: z.enum(TASK_TYPES),
  subject: z.string().min(1, "Subject is required"),
  description: z.string().optional(),
  due_date: z.string().optional(),
  contact_id: z.coerce.number().int().positive().optional().nullable(),
  deal_id: z.coerce.number().int().positive().optional().nullable(),
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
