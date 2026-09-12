import { requireApiAuth, jsonOk } from "@/lib/apiAuth";
import { listInsights, generateInsights } from "@/db/queries/insights";
import { SYSTEM_SCOPE } from "@/lib/customerScope";

export async function GET(req: Request) {
  const auth = await requireApiAuth(req);
  if (!auth.ok) return auth.res;
  return jsonOk({ insights: await listInsights(SYSTEM_SCOPE) });
}

export async function POST(req: Request) {
  const auth = await requireApiAuth(req);
  if (!auth.ok) return auth.res;
  const { created } = await generateInsights();
  return jsonOk({ created, insights: await listInsights(SYSTEM_SCOPE) });
}
