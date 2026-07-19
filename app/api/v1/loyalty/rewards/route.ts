import { requireApiAuth, jsonOk } from "@/lib/apiAuth";
import { listRewards } from "@/db/queries/loyalty";

export async function GET(req: Request) {
  const auth = await requireApiAuth(req);
  if (!auth.ok) return auth.res;
  const rewards = await listRewards({ activeOnly: true });
  return jsonOk({ rewards });
}
