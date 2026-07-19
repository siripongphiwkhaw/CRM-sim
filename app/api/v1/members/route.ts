import { requireApiAuth, jsonError, jsonOk } from "@/lib/apiAuth";
import { apiMemberSchema } from "@/lib/apiSchemas";
import { firstError } from "@/lib/validation";
import { createCustomer, findDuplicate, getCustomer } from "@/db/queries/customers";

export async function POST(req: Request) {
  const auth = await requireApiAuth(req);
  if (!auth.ok) return auth.res;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "VALIDATION_ERROR", "Invalid JSON body.");
  }
  const parsed = apiMemberSchema.safeParse(body);
  if (!parsed.success) return jsonError(400, "VALIDATION_ERROR", firstError(parsed.error));

  const dup = await findDuplicate(parsed.data.phone, parsed.data.email);
  if (dup) {
    return jsonError(409, "DUPLICATE_MEMBER", `A member already exists with this phone or email (${dup.member_code}).`);
  }

  const { consent_mode, ...input } = parsed.data;
  const id = await createCustomer(input, consent_mode);
  const created = await getCustomer(id);
  return jsonOk(created, 201);
}
