import { requireApiAuth, jsonError, jsonOk } from "@/lib/apiAuth";
import { resolveMember } from "@/lib/apiResolve";
import { getNbaForCustomer } from "@/db/queries/insights";

export async function GET(req: Request, { params }: { params: Promise<{ customerId: string }> }) {
  const auth = await requireApiAuth(req);
  if (!auth.ok) return auth.res;
  const { customerId } = await params;
  const member = await resolveMember(customerId);
  if (!member) return jsonError(404, "NOT_FOUND", "Member not found.");
  return jsonOk({ customer_id: member.id, ...(await getNbaForCustomer(member.id)) });
}
