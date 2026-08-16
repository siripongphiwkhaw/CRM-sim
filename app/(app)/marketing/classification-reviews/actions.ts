"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/session";
import { getCase } from "@/db/queries/cases";
import { isPicOfDepartment } from "@/db/queries/departments";
import {
  getClassificationReview,
  decideClassificationReview,
} from "@/db/queries/classificationReviews";
import type { FormState } from "@/lib/validation";

/**
 * Confirm or reject a classification disagreement review. Only an admin, or a
 * PIC of the department the review case was routed to, may decide — same
 * authorisation split as decideIdentityLinkAction.
 */
export async function decideClassificationReviewAction(
  reviewId: number,
  decision: "CONFIRMED" | "REJECTED"
): Promise<FormState> {
  const session = await requireSession();

  const review = await getClassificationReview(reviewId);
  if (!review) return { error: "Review not found." };

  let authorized = session.role === "admin";
  if (!authorized && review.case_id != null && session.userId) {
    const routedCase = await getCase(review.case_id);
    if (routedCase?.department_id != null) {
      authorized = await isPicOfDepartment(session.userId, routedCase.department_id);
    }
  }
  if (!authorized) {
    return { error: "Only an admin or a PIC of the routed department can decide this." };
  }

  const result = await decideClassificationReview(reviewId, decision, session.userId ?? null);
  if (!result.ok) {
    return {
      error: result.error === "ALREADY_DECIDED" ? "This review was already decided." : "Review not found.",
    };
  }

  revalidatePath("/customers", "layout");
  revalidatePath("/cases");
  return {
    success:
      decision === "CONFIRMED"
        ? "Confirmed — update the member's declared type from their profile if you're acting on this."
        : "Rejected as a false positive.",
  };
}
