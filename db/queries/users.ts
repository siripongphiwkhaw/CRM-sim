import { get, all, run } from "../client";
import type { Role } from "@/lib/constants";

export interface User {
  id: number;
  name: string;
  email: string;
  password_hash: string;
  role: Role;
  created_at: string;
}

export interface UserSummary {
  id: number;
  name: string;
  email: string;
  role: Role;
  created_at: string;
}

export function getUserByEmail(email: string): Promise<User | undefined> {
  return get<User>("SELECT * FROM users WHERE email = ?", [email]);
}

export function getUserById(id: number): Promise<User | undefined> {
  return get<User>("SELECT * FROM users WHERE id = ?", [id]);
}

export function listUsers(): Promise<UserSummary[]> {
  return all<UserSummary>(
    "SELECT id, name, email, role, created_at FROM users ORDER BY role, name"
  );
}

export async function setUserRole(id: number, role: Role): Promise<void> {
  await run("UPDATE users SET role = ? WHERE id = ?", [role, id]);
}

export async function createUser(input: {
  name: string;
  email: string;
  password_hash: string;
  role: Role;
}): Promise<number> {
  return run(
    "INSERT INTO users (name, email, password_hash, role) VALUES (@name, @email, @password_hash, @role)",
    {
      name: input.name,
      email: input.email,
      password_hash: input.password_hash,
      role: input.role,
    }
  );
}
