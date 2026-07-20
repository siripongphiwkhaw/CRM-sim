import bcrypt from "bcryptjs";
import { getUserByEmail } from "@/db/queries/users";
import { getModulesForUser, isApproverUser } from "@/db/queries/departments";
import { MODULES } from "./constants";
import { getSession } from "./session";

export interface LoginResult {
  success: boolean;
  error?: string;
}

export async function login(email: string, password: string): Promise<LoginResult> {
  const user = await getUserByEmail(email);
  if (!user) {
    return { success: false, error: "Invalid email or password" };
  }

  const valid = bcrypt.compareSync(password, user.password_hash);
  if (!valid) {
    return { success: false, error: "Invalid email or password" };
  }

  const session = await getSession();
  session.userId = user.id;
  session.email = user.email;
  session.name = user.name;
  session.role = user.role;
  // Resolve department-derived access once, here — proxy.ts reads it off the
  // cookie because middleware can't reach the database.
  const isAdminUser = user.role === "admin";
  session.modules = isAdminUser ? [...MODULES] : await getModulesForUser(user.id);
  session.canApprove = isAdminUser || (await isApproverUser(user.id));
  await session.save();

  return { success: true };
}

export async function logout(): Promise<void> {
  const session = await getSession();
  session.destroy();
}
