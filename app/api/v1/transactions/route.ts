import { requireApiAuth, jsonError, jsonOk } from "@/lib/apiAuth";
import { apiTransactionSchema } from "@/lib/apiSchemas";
import { firstError } from "@/lib/validation";
import { createTransaction } from "@/db/queries/transactions";
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
  const parsed = apiTransactionSchema.safeParse(body);
  if (!parsed.success) return jsonError(400, "VALIDATION_ERROR", firstError(parsed.error));

  if (!(await getCustomer(parsed.data.customer_id))) {
    return jsonError(404, "NOT_FOUND", "Member not found.");
  }
  const result = await createTransaction({
    customer_id: parsed.data.customer_id,
    channel: parsed.data.channel,
    amount_thb: parsed.data.amount_thb,
    source_ref: "api",
    created_by: auth.userId,
  });
  return jsonOk(
    {
      tx_code: result.txCode,
      channel_flag: result.channelFlag,
      earned: result.earned,
    },
    201
  );
}
