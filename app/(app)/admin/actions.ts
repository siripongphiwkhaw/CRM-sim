"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { requireAdmin } from "@/lib/session";
import {
  roleSchema,
  newUserSchema,
  departmentSchema,
  firstError,
  type FormState,
} from "@/lib/validation";
import { setUserRole, createUser, getUserByEmail } from "@/db/queries/users";
import {
  createDepartment,
  updateDepartment,
  deleteDepartment,
  addDepartmentPic,
  removeDepartmentPic,
} from "@/db/queries/departments";

export async function setRoleAction(userId: number, role: string) {
  await requireAdmin();
  const parsed = roleSchema.safeParse({ role });
  if (!parsed.success || !userId) return;

  await setUserRole(userId, parsed.data.role);
  revalidatePath("/admin");
}

export interface NewUserState {
  error?: string;
  success?: string;
}

export async function createUserAction(
  _prev: NewUserState,
  formData: FormData
): Promise<NewUserState> {
  await requireAdmin();
  const parsed = newUserSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    role: formData.get("role"),
  });
  if (!parsed.success) return { error: firstError(parsed.error) };

  if (await getUserByEmail(parsed.data.email)) {
    return { error: "A user with that email already exists." };
  }

  await createUser({
    name: parsed.data.name,
    email: parsed.data.email,
    password_hash: bcrypt.hashSync(parsed.data.password, 10),
    role: parsed.data.role,
  });
  revalidatePath("/admin");
  return { success: `User ${parsed.data.email} created.` };
}

export async function createDepartmentAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  await requireAdmin();
  const parsed = departmentSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") ?? "",
  });
  if (!parsed.success) return { error: firstError(parsed.error) };

  await createDepartment({ name: parsed.data.name, description: parsed.data.description || null });
  revalidatePath("/admin");
  return {};
}

export async function updateDepartmentAction(formData: FormData) {
  await requireAdmin();
  const id = Number(formData.get("id"));
  const name = String(formData.get("name") ?? "").trim();
  if (!id || !name) return;

  await updateDepartment(id, {
    name,
    description: (formData.get("description") as string) || null,
  });
  revalidatePath("/admin");
}

export async function deleteDepartmentAction(formData: FormData) {
  await requireAdmin();
  const id = Number(formData.get("id"));
  if (id) {
    await deleteDepartment(id);
    revalidatePath("/admin");
  }
}

export async function addPicAction(departmentId: number, userId: number) {
  await requireAdmin();
  if (departmentId && userId) {
    await addDepartmentPic(departmentId, userId);
    revalidatePath("/admin");
  }
}

export async function removePicAction(departmentId: number, userId: number) {
  await requireAdmin();
  await removeDepartmentPic(departmentId, userId);
  revalidatePath("/admin");
}
