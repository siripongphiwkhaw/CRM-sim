import { get, all } from "../client";

export interface User {
  id: number;
  name: string;
  email: string;
  password_hash: string;
  created_at: string;
}

export function getUserByEmail(email: string): Promise<User | undefined> {
  return get<User>("SELECT * FROM users WHERE email = ?", [email]);
}

export function getUserById(id: number): Promise<User | undefined> {
  return get<User>("SELECT * FROM users WHERE id = ?", [id]);
}

export function listUsers(): Promise<User[]> {
  return all<User>("SELECT * FROM users ORDER BY name");
}
