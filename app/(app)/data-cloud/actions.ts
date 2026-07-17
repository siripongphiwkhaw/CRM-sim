"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/session";
import { markSourceSynced, syncAllSources } from "@/db/queries/dataSources";

export async function syncSourceAction(id: number) {
  await requireSession();
  if (id) {
    await markSourceSynced(id);
    revalidatePath("/data-cloud");
  }
}

export async function syncAllAction() {
  await requireSession();
  await syncAllSources();
  revalidatePath("/data-cloud");
}
