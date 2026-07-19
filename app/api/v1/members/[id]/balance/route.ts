import { requireApiAuth, jsonError, jsonOk } from "@/lib/apiAuth";
import { resolveMember } from "@/lib/apiResolve";
import { getLoyaltySummary } from "@/db/queries/loyalty";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiAuth(req);
  if (!auth.ok) return auth.res;
  const { id } = await params;
  const member = await resolveMember(id);
  if (!member) return jsonError(404, "NOT_FOUND", "Member not found.");
  const summary = await getLoyaltySummary(member.id);
  return jsonOk({ customer_id: member.id, member_code: member.member_code, ...summary });
}
