import { getIronSession, type IronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";
import type { Role, ModuleKey } from "./constants";

export interface SessionData {
  userId?: number;
  email?: string;
  name?: string;
  role?: Role;
  /**
   * Modules this user may reach, resolved from their home department at login.
   * Stored on the session because proxy.ts runs on the Edge runtime and cannot
   * touch the sql.js database. Like `role`, a change an admin makes applies on
   * the user's next login rather than immediately.
   */
  modules?: ModuleKey[];
  /** Set when the user's home department is flagged as an approver unit. */
  canApprove?: boolean;
}

// Falls back to a built-in key so the app runs with zero configuration (this is
// an ephemeral demo with no durable data to protect). Set SESSION_SECRET in the
// environment to override it. iron-session requires at least 32 characters.
export const SESSION_PASSWORD =
  process.env.SESSION_SECRET ?? "simulated-crm-demo-session-secret-please-override";

export const sessionOptions: SessionOptions = {
  password: SESSION_PASSWORD,
  cookieName: "crm_session",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
  },
};

export async function getSession(): Promise<IronSession<SessionData>> {
  return getIronSession<SessionData>(await cookies(), sessionOptions);
}

export async function requireSession(): Promise<IronSession<SessionData>> {
  const session = await getSession();
  if (!session.userId) {
    throw new Error("Not authenticated");
  }
  return session;
}

/** Throws unless the current session belongs to an admin. */
export async function requireAdmin(): Promise<IronSession<SessionData>> {
  const session = await requireSession();
  if (session.role !== "admin") {
    throw new Error("Forbidden: admin only");
  }
  return session;
}

export async function isAdmin(): Promise<boolean> {
  const session = await getSession();
  return session.role === "admin";
}

/**
 * Throws unless the session may approve/reject submitted orders — admins
 * always may; other users need a home department flagged as an approver unit.
 */
export async function requireApprover(): Promise<IronSession<SessionData>> {
  const session = await requireSession();
  if (session.role !== "admin" && !session.canApprove) {
    throw new Error("Forbidden: approver only");
  }
  return session;
}
