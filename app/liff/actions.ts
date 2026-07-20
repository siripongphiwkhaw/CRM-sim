"use server";

import { revalidatePath } from "next/cache";
import {
  requireMember,
  establishMemberSession,
  establishDemoSession,
  clearMemberSession,
  demoAccessAllowed,
} from "@/lib/liffAuth";
import { liffRedeemSchema, liffConsentSchema, firstError, type FormState } from "@/lib/validation";
import { redeemReward } from "@/db/queries/loyalty";
import { recordConsent } from "@/db/queries/consent";
import { createCase } from "@/db/queries/cases";

/** Exchanges a LIFF ID token for a member session. Verification happens server-side. */
export async function signInWithLineAction(idToken: string): Promise<{ ok: boolean; error?: string }> {
  if (!idToken) return { ok: false, error: "No LINE ID token was provided." };
  const result = await establishMemberSession(idToken);
  revalidatePath("/liff");
  if (result.ok) return { ok: true };
  if (result.reason === "UNLINKED") return { ok: true }; // /liff renders the link screen
  return { ok: false, error: result.error ?? "Could not sign you in." };
}

/**
 * Demo/staff-preview sign-in. Re-checks authorisation itself rather than
 * trusting the page guard — a server action is an independently addressable
 * POST endpoint, so a stale client bundle could still hold its action id.
 */
export async function impersonateMemberAction(customerId: number): Promise<{ ok: boolean; error?: string }> {
  if (!(await demoAccessAllowed())) return { ok: false, error: "Demo mode is not available." };
  const result = await establishDemoSession(customerId);
  revalidatePath("/liff");
  return result;
}

export async function signOutMemberAction(): Promise<void> {
  await clearMemberSession();
  revalidatePath("/liff");
}

/**
 * Member self-redemption.
 *
 * The customer is taken from the session, never from the form — the schema has
 * no customer_id field at all, so redeeming against someone else's account is
 * not representable. redeemReward re-checks the balance server-side and
 * recomputes the points cache, so a stale client cannot overdraw.
 */
export async function liffRedeemAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const auth = await requireMember();
  if (!auth.ok) return { error: "Your session expired. Please reopen the app." };

  const parsed = liffRedeemSchema.safeParse({ reward_id: formData.get("reward_id") });
  if (!parsed.success) return { error: firstError(parsed.error) };

  const result = await redeemReward(auth.customerId, parsed.data.reward_id, null, "liff");

  revalidatePath("/liff");
  revalidatePath("/liff/rewards");
  revalidatePath("/liff/history");

  if (!result.ok) {
    if (result.error === "INSUFFICIENT_POINTS") {
      return { error: "You don't have enough points for this reward yet." };
    }
    if (result.error === "REWARD_INACTIVE") {
      return { error: "This reward is no longer available." };
    }
    return { error: "That reward could not be found." };
  }
  return { success: `Redeemed. You have ${result.balance.toLocaleString("en-US")} points left.` };
}

/** Consent toggle — customer also derived from the session, never the form. */
export async function liffConsentAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const auth = await requireMember();
  if (!auth.ok) return { error: "Your session expired. Please reopen the app." };

  const parsed = liffConsentSchema.safeParse({
    purpose: formData.get("purpose"),
    status: formData.get("status"),
  });
  if (!parsed.success) return { error: firstError(parsed.error) };

  await recordConsent({
    customer_id: auth.customerId,
    purpose: parsed.data.purpose,
    status: parsed.data.status,
    source: "liff",
  });
  revalidatePath("/liff/account");
  return { success: "Preference saved." };
}

/**
 * Unlinked members request staff-assisted linking. Deliberately NOT a
 * self-serve match on phone number: phone numbers aren't secrets and
 * customers.phone is free text, so matching on one would hand over a stranger's
 * balance and the ability to burn it. Staff verify identity out of band.
 */
export async function requestLinkAction(
  _prev: FormState,
  _formData: FormData
): Promise<FormState> {
  const auth = await requireMember();
  if (auth.ok) return { success: "Your account is already linked." };
  if (auth.reason !== "UNLINKED" || !auth.lineUserId) {
    return { error: "Please reopen the app from LINE and try again." };
  }

  await createCase({
    customer_id: null,
    subject: "LINE account linking request",
    description:
      `A LINE user asked to link their Only-One membership.\n` +
      `LINE display name: ${auth.displayName ?? "(unknown)"}\n` +
      `LINE user id: ${auth.lineUserId}\n\n` +
      `Verify identity out of band, then paste the LINE user id into the member's record.`,
    category: "ACCOUNT",
    priority: "MEDIUM",
    created_by: null,
  });
  return { success: "Request sent. Our team will link your account shortly." };
}
