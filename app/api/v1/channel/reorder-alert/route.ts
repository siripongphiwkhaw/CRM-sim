import { requireApiAuth, jsonError, jsonOk } from "@/lib/apiAuth";
import { apiReorderSchema } from "@/lib/apiSchemas";
import { firstError } from "@/lib/validation";
import { getOnHand } from "@/db/queries/inventory";
import { getDistributor } from "@/db/queries/distributors";
import { getProduct } from "@/db/queries/products";
import { createInsightIfAbsent } from "@/db/queries/insights";

export async function POST(req: Request) {
  const auth = await requireApiAuth(req);
  if (!auth.ok) return auth.res;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "VALIDATION_ERROR", "Invalid JSON body.");
  }
  const parsed = apiReorderSchema.safeParse(body);
  if (!parsed.success) return jsonError(400, "VALIDATION_ERROR", firstError(parsed.error));

  const dealer = await getDistributor(parsed.data.dealer_id);
  const product = await getProduct(parsed.data.product_id);
  if (!dealer || !product) return jsonError(404, "NOT_FOUND", "Dealer or product not found.");

  const onHand = await getOnHand(parsed.data.dealer_id, parsed.data.product_id);
  if (onHand > product.reorder_point) {
    return jsonOk({ triggered: false, on_hand: onHand, reorder_point: product.reorder_point }, 200);
  }
  const qty = Math.max(12, product.reorder_point * 2 - onHand);
  const id = await createInsightIfAbsent({
    insight_type: onHand <= 0 ? "OUT_OF_STOCK" : "REORDER_POINT",
    severity: onHand <= 0 ? "CRITICAL" : "WARNING",
    entity_type: "distributor",
    entity_id: dealer.id,
    title: `Reorder: ${product.name} at ${dealer.name}`,
    description: `On-hand ${onHand} is at/below the reorder point (${product.reorder_point}).`,
    recommendation: `Replenishment order of ${qty} units.`,
    confidence: 1,
  });
  return jsonOk({ triggered: true, insight_id: id, on_hand: onHand, suggested_qty: qty }, 201);
}
