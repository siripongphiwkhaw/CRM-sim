"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/session";
import { generateInsights, dismissInsight } from "@/db/queries/insights";
import { recomputeScores } from "@/db/queries/scores";

export async function regenerateInsightsAction() {
  await requireSession();
  // Scores first: the CHURN_RISK generator reads customer_scores.churn_score
  // for severity, so this ordering keeps the two always in sync.
  await recomputeScores();
  await generateInsights();
  revalidatePath("/insights");
  revalidatePath("/customers", "layout");
}

export async function dismissInsightAction(id: number) {
  await requireSession();
  await dismissInsight(id);
  revalidatePath("/insights");
}
