import { requireApiAuth, jsonError, jsonOk } from "@/lib/apiAuth";
import { resolveMember } from "@/lib/apiResolve";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiAuth(req);
  if (!auth.ok) return auth.res;
  const { id } = await params;
  const member = await resolveMember(id);
  if (!member) return jsonError(404, "NOT_FOUND", "Member not found.");
  return jsonOk(member);
}
