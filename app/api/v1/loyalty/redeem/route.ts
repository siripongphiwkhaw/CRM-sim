import { requireApiAuth, jsonError, jsonOk } from "@/lib/apiAuth";
import { apiRedeemSchema } from "@/lib/apiSchemas";
import { firstError } from "@/lib/validation";
import { redeemReward } from "@/db/queries/loyalty";
import { getCustomer } from "@/db/queries/customers";

export async function POST(req: Request) {
  const auth = await requireApiAuth(req);
  if (!auth.ok) return auth.res;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "VALIDATION_ERROR", "Invalid JSON body.");
  }
  const parsed = apiRedeemSchema.safeParse(body);
  if (!parsed.success) return jsonError(400, "VALIDATION_ERROR", firstError(parsed.error));

  if (!(await getCustomer(parsed.data.customer_id))) {
    return jsonError(404, "NOT_FOUND", "Member not found.");
  }
  const result = await redeemReward(
    parsed.data.customer_id,
    parsed.data.reward_id,
    auth.userId,
    auth.via === "api_key" ? "api" : "staff"
  );
  if (!result.ok) {
    if (result.error === "INSUFFICIENT_POINTS") {
      return jsonError(403, "INSUFFICIENT_POINTS", "Not enough points for this reward.");
    }
    if (result.error === "REWARD_INACTIVE") {
      return jsonError(409, "REWARD_INACTIVE", "That reward is not active.");
    }
    return jsonError(404, "NOT_FOUND", "Reward not found.");
  }
  return jsonOk({ entry_id: result.entryId, balance: result.balance }, 201);
}
