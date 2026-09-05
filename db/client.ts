import { neon } from "@neondatabase/serverless";
import { SCHEMA_SQL } from "./schema";
import { seedInto } from "./seed";

// This CRM runs on Neon Postgres via the serverless HTTP driver — no
// persistent connection to pool, each query is its own request. Schema
// creation is idempotent (CREATE TABLE IF NOT EXISTS) and re-runs on every
// cold start, which is cheap once tables already exist; seeding only runs
// the first time (an empty `users` table), so redeploys never duplicate data.

export type SqlValue = string | number | boolean | null;
export type QueryArgs = SqlValue[] | Record<string, SqlValue>;

declare global {
  // eslint-disable-next-line no-var
  var __crmSql: ReturnType<typeof neon> | undefined;
  // eslint-disable-next-line no-var
  var __crmDbReady: Promise<void> | undefined;
}

function sqlClient() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set — add it to .env.local");
  }
  return (globalThis.__crmSql ??= neon(process.env.DATABASE_URL));
}

// Parses `?` and `@name` placeholders out of the app's SQLite-flavoured SQL
// text (skipping single-quoted string literals) and rewrites them to
// Postgres's `$1,$2,...` positional form, building a matching values array in
// the same pass. This is the one place that translation happens — query
// files keep calling all/get/run/batch exactly as before.
const TOKEN_RE = /'(?:[^']|'')*'|\?|@[A-Za-z_]\w*/g;

function toPositional(
  sqlText: string,
  args: QueryArgs
): { text: string; values: SqlValue[] } {
  const values: SqlValue[] = [];
  const named = Array.isArray(args) ? null : args;
  let posIndex = 0;
  const nameToPos = new Map<string, number>();

  const text = sqlText.replace(TOKEN_RE, (token) => {
    if (token.startsWith("'")) return token; // string literal, untouched
    if (token === "?") {
      const value = Array.isArray(args) ? args[posIndex] : undefined;
      posIndex++;
      values.push(value ?? null);
      return `$${values.length}`;
    }
    // @name — reuse the same $n if this name already appeared.
    const key = token.slice(1);
    const existing = nameToPos.get(key);
    if (existing) return `$${existing}`;
    values.push((named?.[key] ?? null) as SqlValue);
    nameToPos.set(key, values.length);
    return `$${values.length}`;
  });

  return { text, values };
}

/**
 * Splits a semicolon-separated DDL script into individual statements. Line
 * comments are stripped first — some of this app's own schema comments
 * contain a literal ";" mid-sentence, which would otherwise produce a
 * malformed split. Only ever run on SCHEMA_SQL (authored by this codebase,
 * no user input), so a plain split after that is safe.
 */
export function splitStatements(script: string): string[] {
  const withoutComments = script.replace(/--[^\n]*/g, "");
  return withoutComments
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
}

// Unguarded cores — no `await ready()`. Called both by the public,
// ready()-guarded exports below AND by ensureDatabase() itself (via
// seedInto()) while the readiness promise is still in flight. Seeding through
// the guarded `run`/`batch` would deadlock: ensureDatabase() would end up
// awaiting its own not-yet-resolved __crmDbReady promise.
async function runUnguarded(sqlText: string, args: QueryArgs = []): Promise<number> {
  const { text, values } = toPositional(sqlText, args);
  const rows = (await sqlClient().query(text, values)) as { id?: number }[];
  return Number(rows[0]?.id ?? 0);
}

async function batchUnguarded(
  statements: { sql: string; args?: QueryArgs }[]
): Promise<void> {
  const client = sqlClient();
  const queries = statements.map((s) => {
    const { text, values } = toPositional(s.sql, s.args ?? []);
    return client.query(text, values);
  });
  await client.transaction(queries);
}

async function ensureDatabase(): Promise<void> {
  const client = sqlClient();
  const ddl = splitStatements(SCHEMA_SQL).map((stmt) => client.query(stmt));
  await client.transaction(ddl);

  const [row] = (await client.query("SELECT COUNT(*)::int AS n FROM users")) as {
    n: number;
  }[];
  if (row.n === 0) await seedInto({ run: runUnguarded, batch: batchUnguarded });
}

function ready(): Promise<void> {
  return (globalThis.__crmDbReady ??= ensureDatabase());
}

export async function all<T>(sqlText: string, args: QueryArgs = []): Promise<T[]> {
  await ready();
  const { text, values } = toPositional(sqlText, args);
  const rows = await sqlClient().query(text, values);
  return rows as T[];
}

export async function get<T>(
  sqlText: string,
  args: QueryArgs = []
): Promise<T | undefined> {
  return (await all<T>(sqlText, args))[0];
}

/** Runs a write and returns the inserted id (0 unless the SQL text ends in
 * `RETURNING id`). */
export async function run(sqlText: string, args: QueryArgs = []): Promise<number> {
  await ready();
  return runUnguarded(sqlText, args);
}

/** Runs several writes atomically as one Postgres transaction over HTTP. */
export async function batch(
  statements: { sql: string; args?: QueryArgs }[]
): Promise<void> {
  await ready();
  return batchUnguarded(statements);
}

/**
 * Like `batch`, but hands back each statement's rows.
 *
 * The HTTP transaction API takes every query up front, so a batch cannot read
 * a value and then decide what to write next. The way to make a guarded write
 * atomic is therefore a single conditional `INSERT … SELECT … WHERE`, which
 * inserts nothing when the guard fails — and the caller can only tell the two
 * outcomes apart by seeing what `RETURNING` handed back. `batch` stays `void`
 * so its existing call sites are unaffected.
 */
export async function batchReturning<T = unknown>(
  statements: { sql: string; args?: QueryArgs }[]
): Promise<T[][]> {
  await ready();
  const client = sqlClient();
  const queries = statements.map((s) => {
    const { text, values } = toPositional(s.sql, s.args ?? []);
    return client.query(text, values);
  });
  return (await client.transaction(queries)) as T[][];
}

export interface RawQueryResult {
  columns: string[];
  rows: SqlValue[][];
}

/**
 * Runs a single, already-validated read-only statement — used only by the
 * admin SQL console. Wrapped in a Postgres READ ONLY transaction so the
 * database itself rejects any mutation that slips past the app-level
 * guardrails, not just the regex check.
 */
export async function execRaw(sqlText: string): Promise<RawQueryResult> {
  await ready();
  const client = sqlClient();
  // arrayMode/fullResults must be set on the transaction call itself — the
  // driver ignores those options if passed to the individual query instead.
  const [result] = await client.transaction([client.query(sqlText)], {
    arrayMode: true,
    fullResults: true,
    readOnly: true,
  });
  return {
    columns: result.fields.map((f) => f.name),
    rows: result.rows,
  };
}
