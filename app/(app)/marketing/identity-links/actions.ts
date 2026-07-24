"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/session";
import { getCase } from "@/db/queries/cases";
import { isPicOfDepartment } from "@/db/queries/departments";
import {
  runIdentityLinkScan,
  getIdentityLink,
  confirmIdentityLink,
} from "@/db/queries/identityLinks";
import type { FormState } from "@/lib/validation";

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- useActionState's action signature requires both params even though this scan takes no form input.
export async function runIdentityScanAction(_prev: FormState, _formData: FormData): Promise<FormState> {
  const session = await requireSession();
  const { found } = await runIdentityLinkScan(session.userId ?? null);
  revalidatePath("/marketing/identity-links");
  revalidatePath("/cases");
  return {
    success:
      found === 0
        ? "No new shared-identity B2C/B2B pairs found."
        : `Found ${found} shared-identity pair${found === 1 ? "" : "s"} — routed to the owning department for review.`,
  };
}

/**
 * Confirm or reject a detected identity link. Only an admin, or a PIC of the
 * department the review case was routed to, may decide — so the owning side
 * (not just anyone) makes the call.
 */
export async function decideIdentityLinkAction(
  linkId: number,
  decision: "CONFIRMED" | "REJECTED"
): Promise<FormState> {
  const session = await requireSession();

  const link = await getIdentityLink(linkId);
  if (!link) return { error: "Identity link not found." };

  let authorized = session.role === "admin";
  if (!authorized && link.case_id != null && session.userId) {
    const routedCase = await getCase(link.case_id);
    if (routedCase?.department_id != null) {
      authorized = await isPicOfDepartment(session.userId, routedCase.department_id);
    }
  }
  if (!authorized) {
    return { error: "Only an admin or a PIC of the routed department can decide this." };
  }

  const result = await confirmIdentityLink(linkId, decision, session.userId ?? null);
  if (!result.ok) {
    return { error: result.error === "ALREADY_DECIDED" ? "This link was already decided." : "Identity link not found." };
  }

  revalidatePath("/marketing/identity-links");
  revalidatePath("/cases");
  return {
    success: decision === "CONFIRMED" ? "Confirmed — promotion now restricted to the dominant side." : "Rejected as a false match.",
  };
}
