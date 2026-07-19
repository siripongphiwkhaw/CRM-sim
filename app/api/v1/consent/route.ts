import { requireApiAuth, jsonError, jsonOk } from "@/lib/apiAuth";
import { apiConsentSchema } from "@/lib/apiSchemas";
import { firstError } from "@/lib/validation";
import { recordConsent } from "@/db/queries/consent";
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
  const parsed = apiConsentSchema.safeParse(body);
  if (!parsed.success) return jsonError(400, "VALIDATION_ERROR", firstError(parsed.error));

  if (!(await getCustomer(parsed.data.customer_id))) {
    return jsonError(404, "NOT_FOUND", "Member not found.");
  }
  const id = await recordConsent({ ...parsed.data, source: "api" });
  return jsonOk({ id, ...parsed.data }, 201);
}
