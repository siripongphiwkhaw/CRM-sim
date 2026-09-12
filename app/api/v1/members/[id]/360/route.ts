import { requireApiAuth, jsonError, jsonOk } from "@/lib/apiAuth";
import { resolveMember } from "@/lib/apiResolve";
import { getLoyaltySummary } from "@/db/queries/loyalty";
import { getCustomerTimeline } from "@/db/queries/transactions";
import { getCurrentConsents } from "@/db/queries/consent";
import { getNbaForCustomer } from "@/db/queries/insights";
import { listCases } from "@/db/queries/cases";
import { SYSTEM_SCOPE } from "@/lib/customerScope";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiAuth(req);
  if (!auth.ok) return auth.res;
  const { id } = await params;
  const member = await resolveMember(id);
  if (!member) return jsonError(404, "NOT_FOUND", "Member not found.");

  const [loyalty, timeline, consents, nba, cases] = await Promise.all([
    getLoyaltySummary(member.id),
    getCustomerTimeline(member.id),
    getCurrentConsents(member.id),
    getNbaForCustomer(member.id),
    listCases(SYSTEM_SCOPE, { customerId: member.id }),
  ]);
  return jsonOk({ member, loyalty, consents, next_best_action: nba, timeline, cases });
}
