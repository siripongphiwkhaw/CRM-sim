import { requireApiAuth, jsonError, jsonOk } from "@/lib/apiAuth";
import { apiSellOutSchema } from "@/lib/apiSchemas";
import { firstError } from "@/lib/validation";
import { createDistributorReport } from "@/db/queries/reports";
import { getDistributor } from "@/db/queries/distributors";
import { getProduct } from "@/db/queries/products";

export async function POST(req: Request) {
  const auth = await requireApiAuth(req);
  if (!auth.ok) return auth.res;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "VALIDATION_ERROR", "Invalid JSON body.");
  }
  const parsed = apiSellOutSchema.safeParse(body);
  if (!parsed.success) return jsonError(400, "VALIDATION_ERROR", firstError(parsed.error));

  if (!(await getDistributor(parsed.data.dealer_id)) || !(await getProduct(parsed.data.product_id))) {
    return jsonError(404, "NOT_FOUND", "Dealer or product not found.");
  }

  const result = await createDistributorReport({
    distributor_id: parsed.data.dealer_id,
    product_id: parsed.data.product_id,
    period: parsed.data.period ?? new Date().toISOString().slice(0, 7),
    sell_out_qty: parsed.data.quantity,
    forecast_qty: 0,
    created_by: auth.userId,
  });
  if (!result.ok) {
    return jsonError(409, "OVER_STOCK", `Sell-out ${parsed.data.quantity} exceeds on-hand stock (${result.on_hand}).`);
  }
  return jsonOk({ recorded: true }, 201);
}
