"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/session";
import { markSourceSynced } from "@/db/queries/dataSources";

export async function syncSourceAction(id: number) {
  await requireSession();
  if (id) {
    await markSourceSynced(id);
    revalidatePath("/data-cloud");
  }
}
