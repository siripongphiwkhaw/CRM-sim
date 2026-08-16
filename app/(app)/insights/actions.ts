"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/session";
import { generateInsights, dismissInsight } from "@/db/queries/insights";
import { recomputeScores } from "@/db/queries/scores";
import { syncClassificationReviews } from "@/db/queries/classificationReviews";

export async function regenerateInsightsAction() {
  const session = await requireSession();
  // Scores first: the CHURN_RISK generator reads customer_scores.churn_score
  // for severity, so this ordering keeps the two always in sync.
  await recomputeScores();
  await generateInsights();
  // Reads the disagreement_flag recomputeScores() just wrote — no separate
  // scan needed, unlike runIdentityLinkScan (which reads raw transactions).
  await syncClassificationReviews(session.userId ?? null);
  revalidatePath("/insights");
  revalidatePath("/customers", "layout");
  revalidatePath("/cases");
}

export async function dismissInsightAction(id: number) {
  await requireSession();
  await dismissInsight(id);
  revalidatePath("/insights");
}
