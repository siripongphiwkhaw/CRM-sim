import { requireApiAuth, jsonOk } from "@/lib/apiAuth";
import { listInsights, generateInsights } from "@/db/queries/insights";

export async function GET(req: Request) {
  const auth = await requireApiAuth(req);
  if (!auth.ok) return auth.res;
  return jsonOk({ insights: await listInsights() });
}

export async function POST(req: Request) {
  const auth = await requireApiAuth(req);
  if (!auth.ok) return auth.res;
  const { created } = await generateInsights();
  return jsonOk({ created, insights: await listInsights() });
}
