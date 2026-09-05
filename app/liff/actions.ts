"use server";

import { revalidatePath } from "next/cache";
import {
  requireMember,
  establishMemberSession,
  establishDemoSession,
  clearMemberSession,
  demoAccessAllowed,
} from "@/lib/liffAuth";
import {
  liffRedeemSchema,
  liffConsentSchema,
  liffEarnSchema,
  liffRegisterSchema,
  missionSubmitSchema,
  firstError,
  type FormState,
} from "@/lib/validation";
import { redeemReward } from "@/db/queries/loyalty";
import { submitMission } from "@/db/queries/missions";
import { recordConsent } from "@/db/queries/consent";
import { createTransaction } from "@/db/queries/transactions";
import { registerLineMember } from "@/db/queries/member";
import { getMemberSession } from "@/lib/liffAuth";

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
    if (result.error === "REWARD_LIMIT_REACHED") {
      return { error: "You've already redeemed this reward the maximum number of times." };
    }
    return { error: "That reward could not be found." };
  }
  return { success: `Redeemed. You have ${result.balance.toLocaleString("en-US")} points left.` };
}

/**
 * Member completes a mission from LIFF. Identity from the session, never the
 * form — same IDOR rule as redeem/consent.
 */
export async function submitMissionAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const auth = await requireMember();
  if (!auth.ok) return { error: "Your session expired. Please reopen the app." };

  const parsed = missionSubmitSchema.safeParse({
    mission_id: formData.get("mission_id"),
    proof_note: formData.get("proof_note") || undefined,
  });
  if (!parsed.success) return { error: firstError(parsed.error) };

  const result = await submitMission(auth.customerId, parsed.data.mission_id, parsed.data.proof_note ?? null);

  revalidatePath("/liff/missions");
  revalidatePath("/liff");

  if (!result.ok) {
    if (result.error === "MISSION_UNAVAILABLE") return { error: "This mission is no longer available." };
    if (result.error === "ALREADY_SUBMITTED") return { error: "You've already submitted this mission." };
    return { error: "That mission could not be found." };
  }
  return {
    success:
      result.status === "APPROVED"
        ? "Completed — points awarded."
        : "Submitted — you'll be notified once staff review it.",
  };
}

/**
 * Demo: simulate a purchase to earn points. Not a real-world flow (members
 * don't award themselves points) — it's here to show the full loop end to end.
 * The customer is the session; brand/qty/price come from the form. Writes a
 * real transaction, so the earn shows in the CRM too, then the balance updates.
 *
 * Gated on demoAccessAllowed() for the same reason impersonateMemberAction is:
 * a server action is an independently addressable POST endpoint, so hiding the
 * form in the UI does not stop anyone holding its action id from posting to it.
 * Without this the amount is self-declared and unverified, which mints points
 * outright — ฿999,999 through this form is ~50,000 points, and because tier is
 * derived from lifetime earned it also buys a permanent earn multiplier.
 */
export async function liffEarnAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const auth = await requireMember();
  if (!auth.ok) return { error: "Your session expired. Please reopen the app." };
  if (!(await demoAccessAllowed())) {
    return { error: "Points are earned from verified purchases, not entered by hand." };
  }

  const parsed = liffEarnSchema.safeParse({
    brand: formData.get("brand"),
    quantity: formData.get("quantity"),
    unit_price: formData.get("unit_price"),
  });
  if (!parsed.success) return { error: firstError(parsed.error) };

  const amount = parsed.data.quantity * parsed.data.unit_price;
  const result = await createTransaction({
    customer_id: auth.customerId,
    channel: "D2C",
    amount_thb: amount,
    brand: parsed.data.brand,
    source_ref: "liff-demo",
    created_by: null,
    source: "liff",
  });

  revalidatePath("/liff");
  revalidatePath("/liff/history");
  return {
    success: `+${result.earned.points} points — ฿${amount.toLocaleString("en-US")} at ${parsed.data.brand}.`,
  };
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
 * First-time registration from inside LIFF. Creates a membership bound to the
 * verified LINE identity (from the session, never the form) with the profile
 * details the member enters, then opens their session.
 *
 * Phone/email are stored as profile data only — they are not matched against
 * existing members, so registering can never take over someone else's account.
 */
export async function registerLineMemberAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const auth = await requireMember();
  if (auth.ok) return { success: "You're already registered." };
  if (auth.reason !== "UNLINKED" || !auth.lineUserId) {
    return { error: "Please reopen the app from LINE and try again." };
  }

  const parsed = liffRegisterSchema.safeParse({
    first_name: formData.get("first_name"),
    last_name: formData.get("last_name"),
    phone: formData.get("phone"),
    email: formData.get("email"),
    referral_code: formData.get("referral_code") || undefined,
  });
  if (!parsed.success) return { error: firstError(parsed.error) };

  let memberId: number;
  try {
    const member = await registerLineMember(auth.lineUserId, {
      firstName: parsed.data.first_name,
      lastName: parsed.data.last_name,
      phone: parsed.data.phone,
      email: parsed.data.email,
      referralCode: parsed.data.referral_code,
    });
    memberId = member.id;
  } catch {
    // Never leave the button as a silent no-op — surface a retryable message.
    return { error: "Could not create your membership. Please try again." };
  }

  // Open the member's session so the next render resolves straight to points.
  const session = await getMemberSession();
  session.customerId = memberId;
  await session.save();

  // Deliberately NOT redirect(): a Server-Action redirect is a client
  // navigation the LINE in-app WebView often swallows, which stranded members
  // on the form even though the account was created. Returning success lets the
  // client router.refresh() re-render /liff, which now resolves to the points
  // screen because the session cookie carries customerId.
  revalidatePath("/liff");
  return { success: "Membership created." };
}
