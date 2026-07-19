import { getSession } from "./session";

/**
 * Auth for /api/v1 route handlers. The proxy middleware excludes /api, so every
 * handler MUST call this. Accepts either a valid session cookie or a bearer
 * token equal to CRM_API_KEY (when that env var is set).
 */
export type ApiAuth =
  | { ok: true; via: "session" | "api_key"; userId: number | null }
  | { ok: false; res: Response };

export async function requireApiAuth(req: Request): Promise<ApiAuth> {
  const header = req.headers.get("authorization");
  const apiKey = process.env.CRM_API_KEY;
  if (apiKey && header === `Bearer ${apiKey}`) {
    return { ok: true, via: "api_key", userId: null };
  }

  const session = await getSession();
  if (session.userId) {
    return { ok: true, via: "session", userId: session.userId };
  }

  return { ok: false, res: jsonError(401, "UNAUTHORIZED", "Authentication required.") };
}

export function jsonError(status: number, code: string, message: string): Response {
  return Response.json({ error: { code, message } }, { status });
}

export function jsonOk(data: unknown, status = 200): Response {
  return Response.json(data, { status });
}
