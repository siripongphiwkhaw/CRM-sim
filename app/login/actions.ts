"use server";

import { redirect } from "next/navigation";
import { login as loginUser } from "@/lib/auth";
import { loginSchema } from "@/lib/validation";

export interface LoginFormState {
  error?: string;
}

export async function loginAction(
  _prevState: LoginFormState,
  formData: FormData
): Promise<LoginFormState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: "Please enter a valid email and password" };
  }

  const result = await loginUser(parsed.data.email, parsed.data.password);
  if (!result.success) {
    return { error: result.error };
  }

  redirect("/dashboard");
}
