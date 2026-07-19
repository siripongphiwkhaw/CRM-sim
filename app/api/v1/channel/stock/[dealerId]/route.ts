import { requireApiAuth, jsonError, jsonOk } from "@/lib/apiAuth";
import { getDistributor } from "@/db/queries/distributors";
import { listStockWithReorder } from "@/db/queries/inventory";

export async function GET(req: Request, { params }: { params: Promise<{ dealerId: string }> }) {
  const auth = await requireApiAuth(req);
  if (!auth.ok) return auth.res;
  const { dealerId } = await params;
  const dealer = await getDistributor(Number(dealerId));
  if (!dealer) return jsonError(404, "NOT_FOUND", "Dealer not found.");
  const stock = await listStockWithReorder(dealer.id);
  return jsonOk({ dealer_id: dealer.id, stock });
}
