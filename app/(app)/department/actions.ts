"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/session";
import { isPicOfDepartment, updateDepartment } from "@/db/queries/departments";

export interface DepartmentSettingsState {
  error?: string;
  success?: string;
}

/**
 * The PIC-facing "frontend control" surface — deliberately separate from
 * /admin. Any signed-in user may call this, but it only takes effect if
 * they're actually a PIC of the specific department being edited.
 */
export async function updateMyDepartmentAction(
  _prev: DepartmentSettingsState,
  formData: FormData
): Promise<DepartmentSettingsState> {
  const session = await requireSession();
  const departmentId = Number(formData.get("department_id"));
  const description = String(formData.get("description") ?? "");

  if (!departmentId) return { error: "Missing department." };
  if (!(await isPicOfDepartment(session.userId!, departmentId))) {
    return { error: "You are not a PIC of this department." };
  }

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Name is required." };

  await updateDepartment(departmentId, { name, description: description || null });
  revalidatePath("/department");
  revalidatePath("/admin");
  return { success: "Saved." };
}
