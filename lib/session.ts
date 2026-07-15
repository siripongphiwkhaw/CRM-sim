import { getIronSession, type IronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";

export interface SessionData {
  userId?: number;
  email?: string;
  name?: string;
}

// Falls back to a built-in key so the app runs with zero configuration (this is
// an ephemeral demo with no durable data to protect). Set SESSION_SECRET in the
// environment to override it. iron-session requires at least 32 characters.
const SESSION_PASSWORD =
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
