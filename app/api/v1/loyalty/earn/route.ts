import { requireApiAuth, jsonError, jsonOk } from "@/lib/apiAuth";
import { apiEarnSchema } from "@/lib/apiSchemas";
import { firstError } from "@/lib/validation";
import { postAdjustment, getLoyaltySummary } from "@/db/queries/loyalty";
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
  const parsed = apiEarnSchema.safeParse(body);
  if (!parsed.success) return jsonError(400, "VALIDATION_ERROR", firstError(parsed.error));

  if (!(await getCustomer(parsed.data.customer_id))) {
    return jsonError(404, "NOT_FOUND", "Member not found.");
  }
  const entryId = await postAdjustment(
    parsed.data.customer_id,
    parsed.data.points,
    "EARN",
    parsed.data.note ?? "Manual earn (API)",
    auth.userId
  );
  const summary = await getLoyaltySummary(parsed.data.customer_id);
  return jsonOk({ entry_id: entryId, balance: summary.balance, tier: summary.tier }, 201);
}
