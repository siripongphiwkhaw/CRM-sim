import type { SqlValue } from "sql.js";
import { execRaw } from "../client";

// Statement keywords that mutate data or schema — rejected so the console is
// strictly read-only, even though it is already admin-gated.
const FORBIDDEN =
  /\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|REPLACE|ATTACH|DETACH|PRAGMA|VACUUM|REINDEX|TRIGGER|BEGIN|COMMIT|ROLLBACK|GRANT|SAVEPOINT)\b/i;

const MAX_ROWS = 500;

export interface QueryResult {
  columns: string[];
  rows: SqlValue[][];
  rowCount: number;
  truncated: boolean;
}

export interface QueryOutcome {
  ok: boolean;
  error?: string;
  result?: QueryResult;
}

/** Validates a statement is a single read-only SELECT, then executes it. */
export async function runReadOnlyQuery(input: string): Promise<QueryOutcome> {
  const sql = input.trim().replace(/;\s*$/, "");

  if (!sql) return { ok: false, error: "Enter a SQL query." };
  if (sql.includes(";")) {
    return { ok: false, error: "Only a single statement is allowed." };
  }
  if (!/^(select|with)\b/i.test(sql)) {
    return { ok: false, error: "Only SELECT (or WITH … SELECT) queries are allowed." };
  }
  if (FORBIDDEN.test(sql)) {
    return { ok: false, error: "Only read-only queries are allowed — no data or schema changes." };
  }

  try {
    const sets = await execRaw(sql);
    const first = sets[0];
    if (!first) {
      return { ok: true, result: { columns: [], rows: [], rowCount: 0, truncated: false } };
    }
    return {
      ok: true,
      result: {
        columns: first.columns,
        rows: first.values.slice(0, MAX_ROWS),
        rowCount: first.values.length,
        truncated: first.values.length > MAX_ROWS,
      },
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Query failed." };
  }
}

export interface TableSchema {
  table: string;
  columns: string[];
}

/** Lists tables and their columns to show as a reference in the console UI. */
export async function getSchemaInfo(): Promise<TableSchema[]> {
  const tables = await execRaw(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
  );
  const names = (tables[0]?.values ?? []).map((r) => String(r[0]));

  const schema: TableSchema[] = [];
  for (const table of names) {
    const info = await execRaw(`PRAGMA table_info("${table}")`);
    const cols = (info[0]?.values ?? []).map((r) => String(r[1]));
    schema.push({ table, columns: cols });
  }
  return schema;
}
