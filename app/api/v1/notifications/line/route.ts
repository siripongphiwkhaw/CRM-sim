import { requireApiAuth, jsonError, jsonOk } from "@/lib/apiAuth";
import { apiNotificationSchema } from "@/lib/apiSchemas";
import { firstError } from "@/lib/validation";
import { getCustomer } from "@/db/queries/customers";
import { hasMarketingConsent } from "@/db/queries/consent";
import { createInteraction } from "@/db/queries/interactions";

/**
 * Simulated LINE send — consent-guarded. Blocks (403) when the member has not
 * granted MARKETING consent; otherwise logs an engagement interaction (no real
 * message is sent — the LINE integration is a later phase).
 */
export async function POST(req: Request) {
  const auth = await requireApiAuth(req);
  if (!auth.ok) return auth.res;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "VALIDATION_ERROR", "Invalid JSON body.");
  }
  const parsed = apiNotificationSchema.safeParse(body);
  if (!parsed.success) return jsonError(400, "VALIDATION_ERROR", firstError(parsed.error));

  const member = await getCustomer(parsed.data.customer_id);
  if (!member) return jsonError(404, "NOT_FOUND", "Member not found.");

  if (!(await hasMarketingConsent(parsed.data.customer_id))) {
    return jsonError(403, "NO_MARKETING_CONSENT", "Member has not granted marketing consent.");
  }

  await createInteraction({
    customer_id: parsed.data.customer_id,
    type: "engagement",
    channel: "LINE OA",
    amount: 0,
    points: 0,
    description: `LINE message (simulated): ${parsed.data.message}`,
  });
  return jsonOk({ sent: true, simulated: true }, 200);
}
