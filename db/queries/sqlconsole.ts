import { execRaw, type SqlValue } from "../client";

// Statement keywords that mutate data/schema or are Postgres-specific risks —
// rejected so the console is strictly read-only, even though it is already
// admin-gated and execRaw() itself wraps every call in a READ ONLY
// transaction as a DB-level backstop.
const FORBIDDEN =
  /\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|REPLACE|ATTACH|DETACH|PRAGMA|VACUUM|REINDEX|TRIGGER|BEGIN|COMMIT|ROLLBACK|GRANT|SAVEPOINT|COPY|DO|CALL|EXECUTE|LISTEN|NOTIFY|SET|DBLINK|PG_SLEEP|PG_TERMINATE_BACKEND|PG_CANCEL_BACKEND|PG_READ_FILE|PG_READ_BINARY_FILE|LO_IMPORT|LO_EXPORT|NEXTVAL|SETVAL|CURRVAL)\b/i;

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
    // Cap rows at the database rather than fetching everything and slicing
    // client-side — avoids pulling an unbounded result over HTTP.
    const capped = `SELECT * FROM (${sql}) AS _console_sub LIMIT ${MAX_ROWS + 1}`;
    const result = await execRaw(capped);
    const truncated = result.rows.length > MAX_ROWS;
    return {
      ok: true,
      result: {
        columns: result.columns,
        rows: truncated ? result.rows.slice(0, MAX_ROWS) : result.rows,
        rowCount: truncated ? MAX_ROWS : result.rows.length,
        truncated,
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
  const info = await execRaw(
    `SELECT table_name, column_name FROM information_schema.columns
     WHERE table_schema = 'public' ORDER BY table_name, ordinal_position`
  );
  const grouped = new Map<string, string[]>();
  for (const row of info.rows) {
    const table = String(row[0]);
    const column = String(row[1]);
    const cols = grouped.get(table);
    if (cols) cols.push(column);
    else grouped.set(table, [column]);
  }
  return [...grouped.entries()].map(([table, columns]) => ({ table, columns }));
}
