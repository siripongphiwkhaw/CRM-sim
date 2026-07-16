"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/session";
import { roleSchema } from "@/lib/validation";
import { setUserRole } from "@/db/queries/users";

export async function setRoleAction(userId: number, role: string) {
  await requireAdmin();
  const parsed = roleSchema.safeParse({ role });
  if (!parsed.success || !userId) return;

  await setUserRole(userId, parsed.data.role);
  revalidatePath("/admin");
}
