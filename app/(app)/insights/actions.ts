"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/session";
import { generateInsights, dismissInsight } from "@/db/queries/insights";

export async function regenerateInsightsAction() {
  await requireSession();
  await generateInsights();
  revalidatePath("/insights");
}

export async function dismissInsightAction(id: number) {
  await requireSession();
  await dismissInsight(id);
  revalidatePath("/insights");
}
