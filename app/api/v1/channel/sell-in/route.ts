import { requireApiAuth, jsonError, jsonOk } from "@/lib/apiAuth";
import { apiSellInSchema } from "@/lib/apiSchemas";
import { firstError } from "@/lib/validation";
import { recordInventoryTransaction } from "@/db/queries/inventory";
import { getDistributor } from "@/db/queries/distributors";
import { getProduct } from "@/db/queries/products";
import { createTransaction } from "@/db/queries/transactions";

export async function POST(req: Request) {
  const auth = await requireApiAuth(req);
  if (!auth.ok) return auth.res;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "VALIDATION_ERROR", "Invalid JSON body.");
  }
  const parsed = apiSellInSchema.safeParse(body);
  if (!parsed.success) return jsonError(400, "VALIDATION_ERROR", firstError(parsed.error));

  const dealer = await getDistributor(parsed.data.dealer_id);
  const product = await getProduct(parsed.data.product_id);
  if (!dealer || !product) return jsonError(404, "NOT_FOUND", "Dealer or product not found.");

  const txnId = await recordInventoryTransaction({
    distributor_id: parsed.data.dealer_id,
    product_id: parsed.data.product_id,
    txn_type: "stock_in",
    quantity: parsed.data.quantity,
    reference_type: "manual",
    note: "Sell-in (API)",
    created_by: auth.userId,
  });

  // Linked dealer → a real B2B purchase + loyalty earn.
  let earned = null;
  if (dealer.customer_id) {
    const result = await createTransaction({
      customer_id: dealer.customer_id,
      channel: "SFA",
      amount_thb: product.unit_price * parsed.data.quantity,
      source_ref: `sell_in:${txnId}`,
      created_by: auth.userId,
    });
    earned = { tx_code: result.txCode, points: result.earned.points };
  }
  return jsonOk({ inventory_txn_id: txnId, earned }, 201);
}
