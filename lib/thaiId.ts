/**
 * Thai 13-digit identity numbers — validation and entity-type derivation.
 *
 * This is the hard key that separates B2B from B2C. In Thailand a natural
 * person's tax ID (เลขประจำตัวผู้เสียภาษี) IS their national ID card number
 * (เลขบัตรประชาชน) — the same 13 digits — so there is only ONE field, and the
 * B2B/B2C question is answered by *which kind* of 13-digit number it is:
 *
 *   leading digit 0    → juristic person (นิติบุคคล), i.e. a registered
 *                        company from the DBD registry            → B2B
 *   leading digit 1-8  → natural person (บัตรประชาชน)              → B2C
 *
 * Both kinds share the same mod-11 checksum, so one validator covers both.
 *
 * PRIVACY: a juristic-person number is public business data (published in the
 * DBD registry). A natural-person number is sensitive personal data under
 * PDPA — it must be consent-gated, encrypted at rest, masked in every UI, and
 * subject to a retention policy. Nothing in this module persists or logs a
 * value; it only inspects one. Keep it that way — this file must stay safe to
 * call from anywhere.
 */

export type ThaiEntityType = "JURISTIC" | "NATURAL";

export interface ThaiIdInspection {
  /** Digits only, separators stripped. Never log this. */
  normalized: string;
  valid: boolean;
  entityType: ThaiEntityType | null;
  /** Why validation failed, for form feedback. Never contains the number. */
  reason?: "LENGTH" | "NON_NUMERIC" | "CHECKSUM" | "UNKNOWN_PREFIX";
}

/** Strips the spaces/hyphens Thai IDs are commonly formatted with
 * (e.g. "0-1055-68110-45-9"). */
export function normalizeThaiId(input: string): string {
  return input.replace(/[\s-]/g, "");
}

/**
 * Mod-11 check digit, the standard algorithm for both personal and
 * juristic-person numbers: each of the first 12 digits is weighted by its
 * descending position (13 down to 2), and the check digit closes the sum to a
 * multiple of 11.
 */
function checksumValid(digits: string): boolean {
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += Number(digits[i]) * (13 - i);
  }
  const expected = (11 - (sum % 11)) % 10;
  return expected === Number(digits[12]);
}

export function inspectThaiId(input: string): ThaiIdInspection {
  const normalized = normalizeThaiId(input);

  if (!/^\d+$/.test(normalized)) {
    return { normalized, valid: false, entityType: null, reason: "NON_NUMERIC" };
  }
  if (normalized.length !== 13) {
    return { normalized, valid: false, entityType: null, reason: "LENGTH" };
  }
  if (!checksumValid(normalized)) {
    return { normalized, valid: false, entityType: null, reason: "CHECKSUM" };
  }

  const lead = normalized[0];
  // 9 is not issued as a leading digit for either kind — treat as unknown
  // rather than guessing, so a typo can't silently classify someone as B2B.
  const entityType: ThaiEntityType | null =
    lead === "0" ? "JURISTIC" : /^[1-8]$/.test(lead) ? "NATURAL" : null;

  if (!entityType) {
    return { normalized, valid: false, entityType: null, reason: "UNKNOWN_PREFIX" };
  }
  return { normalized, valid: true, entityType };
}

/** Convenience: does this number belong to a registered company? */
export function isJuristicPerson(input: string): boolean {
  return inspectThaiId(input).entityType === "JURISTIC";
}

/**
 * Display form — last 4 digits only. A full national ID must never reach the
 * UI, a log line, or an API response; mirrors maskLineId() in lib/format.ts.
 * Juristic-person numbers are public and could be shown in full, but they are
 * masked here too so no call site has to decide.
 */
export function maskThaiId(input: string | null | undefined): string {
  if (!input) return "—";
  const digits = normalizeThaiId(input);
  if (digits.length < 4) return "••••";
  return `•••••••••${digits.slice(-4)}`;
}
