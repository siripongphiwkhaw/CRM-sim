import { requireApiAuth, jsonError, jsonOk } from "@/lib/apiAuth";
import { resolveMember } from "@/lib/apiResolve";
import { getCurrentConsents, listConsentHistory } from "@/db/queries/consent";

export async function GET(req: Request, { params }: { params: Promise<{ customerId: string }> }) {
  const auth = await requireApiAuth(req);
  if (!auth.ok) return auth.res;
  const { customerId } = await params;
  const member = await resolveMember(customerId);
  if (!member) return jsonError(404, "NOT_FOUND", "Member not found.");
  const [current, history] = await Promise.all([
    getCurrentConsents(member.id),
    listConsentHistory(member.id),
  ]);
  return jsonOk({ customer_id: member.id, current, history });
}
