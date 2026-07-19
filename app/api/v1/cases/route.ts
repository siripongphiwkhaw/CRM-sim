import { requireApiAuth, jsonError, jsonOk } from "@/lib/apiAuth";
import { apiCaseSchema } from "@/lib/apiSchemas";
import { firstError } from "@/lib/validation";
import { createCase, getCase } from "@/db/queries/cases";

export async function POST(req: Request) {
  const auth = await requireApiAuth(req);
  if (!auth.ok) return auth.res;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "VALIDATION_ERROR", "Invalid JSON body.");
  }
  const parsed = apiCaseSchema.safeParse(body);
  if (!parsed.success) return jsonError(400, "VALIDATION_ERROR", firstError(parsed.error));

  const id = await createCase({
    customer_id: parsed.data.customer_id ?? null,
    subject: parsed.data.subject,
    description: parsed.data.description ?? null,
    category: parsed.data.category ?? null,
    priority: parsed.data.priority,
    created_by: auth.userId,
  });
  return jsonOk(await getCase(id), 201);
}
