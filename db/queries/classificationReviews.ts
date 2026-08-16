import { get, all, run } from "../client";
import { createCase } from "./cases";
import { getDepartmentByName } from "./departments";
import { DEPARTMENTS_BY_CUST_TYPE } from "@/lib/constants";
import type { CustType, BehaviorClass, ResolutionTier } from "@/lib/constants";

/**
 * Classification review workflow: when classifyCustomer()'s evidence tiers
 * disagreed (customer_scores.disagreement_flag), a customer gets a routed,
 * accountable review instead of a silently dismissible insight. Mirrors
 * db/queries/identityLinks.ts — PENDING waits on the routed department's
 * PICs, CONFIRMED means staff reviewed it and will act (the actual
 * customers.cust_type edit stays a separate manual step, deliberately never
 * automatic — see db/schema.ts), REJECTED dismisses a false positive.
 */

export type ReviewStatus = "PENDING" | "CONFIRMED" | "REJECTED";

export interface ClassificationReview {
  id: number;
  customer_id: number;
  cust_type: CustType;
  behavior_class: BehaviorClass;
  resolution_tier: ResolutionTier;
  note: string | null;
  status: ReviewStatus;
  case_id: number | null;
  confirmed_by: number | null;
  created_at: string;
  confirmed_at: string | null;
}

export function getClassificationReview(id: number): Promise<ClassificationReview | undefined> {
  return get<ClassificationReview>("SELECT * FROM customer_classification_reviews WHERE id = ?", [id]);
}

/** The still-pending review a routed case is about — same "resolve without a
 * case_id back-ref" pattern as identityLinks.getPendingLinkForCustomer(). */
export function getPendingReviewForCustomer(customerId: number): Promise<ClassificationReview | undefined> {
  return get<ClassificationReview>(
    `SELECT * FROM customer_classification_reviews WHERE customer_id = ? AND status = 'PENDING' LIMIT 1`,
    [customerId]
  );
}

interface DisagreementRow {
  customer_id: number;
  cust_type: CustType;
  behavior_class: BehaviorClass;
  resolution_tier: ResolutionTier;
  first_name: string;
  last_name: string;
  member_code: string;
}

/**
 * Reads the disagreements recomputeScores() just wrote and opens a routed
 * review for any that don't already have one pending — no independent scan
 * over raw transactions is needed here (unlike runIdentityLinkScan), since
 * customer_scores is the freshly-written source of truth. Called right after
 * recomputeScores() in the same "Recompute scores & insights" action.
 */
export async function syncClassificationReviews(actorId: number | null): Promise<{ found: number }> {
  const rows = await all<DisagreementRow>(
    `SELECT c.id AS customer_id, c.cust_type, c.first_name, c.last_name, c.member_code,
            s.behavior_class, s.resolution_tier
       FROM customers c
       JOIN customer_scores s ON s.customer_id = c.id
      WHERE s.disagreement_flag = 1
        AND s.behavior_class IS NOT NULL AND s.resolution_tier IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM customer_classification_reviews r
           WHERE r.customer_id = c.id AND r.status = 'PENDING'
        )`
  );

  let found = 0;
  for (const row of rows) {
    const note =
      `Declared ${row.cust_type}, resolved as ${row.behavior_class} via the ${row.resolution_tier} tier — ` +
      `the evidence tiers disagreed. Review and, if it's a real reclassification, update the member's ` +
      `type from their profile — this never happens automatically.`;

    const review = await get<{ id: number }>(
      `INSERT INTO customer_classification_reviews
         (customer_id, cust_type, behavior_class, resolution_tier, note, status)
       VALUES (@cid, @ct, @bc, @rt, @note, 'PENDING')
       ON CONFLICT (customer_id) WHERE status = 'PENDING' DO NOTHING
       RETURNING id`,
      { cid: row.customer_id, ct: row.cust_type, bc: row.behavior_class, rt: row.resolution_tier, note }
    );
    // Lost a race against a concurrent recompute — nothing to route.
    if (!review) continue;

    let firstCaseId: number | null = null;
    for (const deptName of DEPARTMENTS_BY_CUST_TYPE[row.cust_type]) {
      const dept = await getDepartmentByName(deptName);
      const caseId = await createCase({
        customer_id: row.customer_id,
        subject: `Reclassify review: ${row.member_code} (${row.first_name} ${row.last_name}) — declared ${row.cust_type}, behaves as ${row.behavior_class}`,
        description: note,
        category: "CLASSIFICATION_REVIEW",
        priority: "MEDIUM",
        created_by: actorId,
        department_id: dept?.id ?? null,
      });
      if (firstCaseId == null) firstCaseId = caseId;
    }

    if (firstCaseId != null) {
      await run("UPDATE customer_classification_reviews SET case_id = @c WHERE id = @id", {
        c: firstCaseId,
        id: review.id,
      });
    }
    found += 1;
  }

  return { found };
}

export type ConfirmResult = { ok: true } | { ok: false; error: "NOT_FOUND" | "ALREADY_DECIDED" };

/** Sets a review CONFIRMED/REJECTED and resolves its routed case on either
 * decision. Authorisation (PIC of the routed department, or admin) is
 * enforced in the server action, not here — same split as confirmIdentityLink. */
export async function decideClassificationReview(
  id: number,
  decision: "CONFIRMED" | "REJECTED",
  actorId: number | null
): Promise<ConfirmResult> {
  const review = await getClassificationReview(id);
  if (!review) return { ok: false, error: "NOT_FOUND" };
  if (review.status !== "PENDING") return { ok: false, error: "ALREADY_DECIDED" };

  await run(
    `UPDATE customer_classification_reviews
        SET status = @status, confirmed_by = @actor, confirmed_at = now()
      WHERE id = @id`,
    { id, status: decision, actor: actorId }
  );

  await run(
    `UPDATE cases
        SET status = 'RESOLVED', resolved_at = COALESCE(resolved_at, now()::text),
            resolution = @res, updated_at = now()
      WHERE category = 'CLASSIFICATION_REVIEW'
        AND status IN ('OPEN','IN_PROGRESS')
        AND customer_id = @cid`,
    {
      cid: review.customer_id,
      res:
        decision === "CONFIRMED"
          ? "Confirmed — staff will update the member's declared type from their profile."
          : "Rejected as a false positive.",
    }
  );
  return { ok: true };
}
