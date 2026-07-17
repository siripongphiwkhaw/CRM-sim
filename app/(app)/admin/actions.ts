"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { requireAdmin } from "@/lib/session";
import { roleSchema, newUserSchema, firstError } from "@/lib/validation";
import { setUserRole, createUser, getUserByEmail } from "@/db/queries/users";

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
