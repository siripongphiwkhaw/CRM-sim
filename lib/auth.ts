import bcrypt from "bcryptjs";
import { getUserByEmail } from "@/db/queries/users";
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
  await session.save();

  return { success: true };
}

export async function logout(): Promise<void> {
  const session = await getSession();
  session.destroy();
}
