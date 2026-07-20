import { getIronSession, type IronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";
import { SESSION_PASSWORD, getSession } from "./session";
import { LINE_CHANNEL_ID, LIFF_CONFIGURED, DEV_FALLBACK_ENABLED } from "./liffEnv";
import { getOrCreateLineMember } from "@/db/queries/member";

/**
 * Member-side auth for the Only-One LIFF app. Deliberately separate from
 * lib/session.ts: that cookie carries a STAFF identity, and requireSession /
 * requireAdmin / proxy.ts all key off session.userId. A member must never be
 * able to satisfy any of those, so members get their own cookie entirely.
 */

export interface MemberSessionData {
  lineUserId?: string;
  customerId?: number;
  displayName?: string;
  pictureUrl?: string;
  /** Set for the dev picker / staff preview so the UI can flag it. */
  demo?: boolean;
  impersonatedBy?: number;
}

const memberSessionOptions: SessionOptions = {
  password: SESSION_PASSWORD,
  cookieName: "member_session",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    // The encrypted cookie IS the ID-token verification cache. LIFF apps are
    // opened fresh rather than left running, so re-establishing is invisible
    // to the user and a short window limits exposure of a stolen cookie.
    maxAge: 60 * 60,
  },
};

export function getMemberSession(): Promise<IronSession<MemberSessionData>> {
  return cookies().then((c) => getIronSession<MemberSessionData>(c, memberSessionOptions));
}

export type MemberAuth =
  | { ok: true; customerId: number; lineUserId: string | null; demo: boolean }
  | { ok: false; reason: "NO_SESSION" | "UNLINKED"; lineUserId?: string; displayName?: string };

/**
 * Result-shaped rather than throwing (mirrors lib/apiAuth.ts). LIFF has three
 * genuinely different outcomes — signed in, needs re-init, needs linking —
 * and an exception would flatten them into one error boundary.
 */
export async function requireMember(): Promise<MemberAuth> {
  const session = await getMemberSession();
  if (session.customerId) {
    return {
      ok: true,
      customerId: session.customerId,
      lineUserId: session.lineUserId ?? null,
      demo: Boolean(session.demo),
    };
  }
  if (session.lineUserId) {
    return {
      ok: false,
      reason: "UNLINKED",
      lineUserId: session.lineUserId,
      displayName: session.displayName,
    };
  }
  return { ok: false, reason: "NO_SESSION" };
}

interface LineVerifyResponse {
  iss: string;
  sub: string;
  aud: string;
  exp: number;
  iat: number;
  name?: string;
  picture?: string;
  email?: string;
}

/**
 * Verifies a LIFF ID token with LINE and opens a member session.
 *
 * Server-side verification is mandatory, not defence in depth: the redeem and
 * consent actions resolve customer_id from this identity, so trusting a
 * client-supplied LINE user id would let any member claim another member's
 * account and burn their points. The ID token is a JWT signed by LINE, and
 * this endpoint is what binds the claimed identity to that signature.
 *
 * We use LINE's verify endpoint rather than checking the JWT signature
 * ourselves — fetching and caching JWKS for local RS256 verification is more
 * code and more failure modes for no benefit.
 */
export async function establishMemberSession(
  idToken: string
): Promise<MemberAuth & { error?: string }> {
  if (!LIFF_CONFIGURED) {
    return { ok: false, reason: "NO_SESSION", error: "LINE is not configured." };
  }

  const res = await fetch("https://api.line.me/oauth2/v2.1/verify", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ id_token: idToken, client_id: LINE_CHANNEL_ID }),
    cache: "no-store",
  });

  if (!res.ok) {
    return { ok: false, reason: "NO_SESSION", error: "Could not verify your LINE account." };
  }

  const payload = (await res.json()) as LineVerifyResponse;

  // Belt and braces — the endpoint enforces both, but the cost is two lines.
  if (payload.aud !== LINE_CHANNEL_ID) {
    return { ok: false, reason: "NO_SESSION", error: "This token was issued for another channel." };
  }
  if (payload.exp * 1000 <= Date.now()) {
    return { ok: false, reason: "NO_SESSION", error: "Your LINE session expired. Please reopen." };
  }

  const session = await getMemberSession();
  session.lineUserId = payload.sub;
  session.displayName = payload.name;
  session.pictureUrl = payload.picture;
  session.demo = false;
  session.impersonatedBy = undefined;

  // First login auto-registers a membership from the LINE profile and links it.
  const customer = await getOrCreateLineMember(payload.sub, payload.name);
  session.customerId = customer.id;
  await session.save();

  return { ok: true, customerId: customer.id, lineUserId: payload.sub, demo: false };
}

/**
 * Opens a demo session as an arbitrary member. Guarded twice over: the local
 * dev fallback, or a signed-in staff user previewing on a deployed instance
 * without LINE credentials. Never reachable once LINE is configured.
 */
export async function establishDemoSession(
  customerId: number
): Promise<{ ok: boolean; error?: string }> {
  const staff = await getSession();
  const staffPreview = !LIFF_CONFIGURED && Boolean(staff.userId);
  if (!DEV_FALLBACK_ENABLED && !staffPreview) {
    return { ok: false, error: "Demo mode is not available." };
  }

  const session = await getMemberSession();
  session.customerId = customerId;
  session.lineUserId = undefined;
  session.displayName = undefined;
  session.pictureUrl = undefined;
  session.demo = true;
  session.impersonatedBy = staff.userId;
  await session.save();
  return { ok: true };
}

export async function clearMemberSession(): Promise<void> {
  const session = await getMemberSession();
  session.destroy();
}

/** True when the demo picker may be shown/used at all. */
export async function demoAccessAllowed(): Promise<boolean> {
  if (DEV_FALLBACK_ENABLED) return true;
  if (LIFF_CONFIGURED) return false;
  const staff = await getSession();
  return Boolean(staff.userId);
}
