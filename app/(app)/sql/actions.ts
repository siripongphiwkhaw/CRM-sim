"use server";

import { requireAdmin } from "@/lib/session";
import { runReadOnlyQuery, type QueryResult } from "@/db/queries/sqlconsole";

export type SqlState = {
  ok?: boolean;
  error?: string;
  result?: QueryResult;
  query?: string;
};

export async function runQueryAction(
  _prev: SqlState,
  formData: FormData
): Promise<SqlState> {
  await requireAdmin();
  const query = String(formData.get("query") ?? "");
  const outcome = await runReadOnlyQuery(query);
  return { ...outcome, query };
}
