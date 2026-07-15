import fs from "node:fs";
import path from "node:path";
import initSqlJs, { type Database, type SqlValue } from "sql.js";
import { SCHEMA_SQL } from "./schema";
import { seedInto } from "./seed";

// This CRM runs entirely on an in-memory SQLite database (SQLite compiled to
// WebAssembly via sql.js — no native modules, so it deploys to serverless hosts
// like Vercel with zero configuration). The database is created and seeded with
// demo data on first use and memoized per server instance. Reads and writes work
// normally, but because the store is in memory it resets whenever the instance
// is recycled (i.e. this is a demo, not durable storage).

export type QueryArgs = SqlValue[] | Record<string, SqlValue>;

declare global {
  // eslint-disable-next-line no-var
  var __crmDbPromise: Promise<Database> | undefined;
}

function loadWasmBinary(): ArrayBuffer {
  // Read the wasm as a plain file at runtime (never as a bundler module request,
  // which Turbopack can't externalize). sql.js is in serverExternalPackages, so
  // its package — including this .wasm — ships in the serverless function.
  const dist = path.join("node_modules", "sql.js", "dist", "sql-wasm.wasm");
  const candidates = [
    path.join(process.cwd(), dist),
    path.join(process.cwd(), ".next", "server", dist),
  ];
  for (const file of candidates) {
    if (fs.existsSync(file)) {
      const buf = fs.readFileSync(file);
      return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    }
  }
  throw new Error(`Could not locate sql.js WebAssembly binary (looked in: ${candidates.join(", ")})`);
}

async function createDatabase(): Promise<Database> {
  const SQL = await initSqlJs({ wasmBinary: loadWasmBinary() });
  const db = new SQL.Database();
  db.exec(SCHEMA_SQL);
  seedInto(db);
  return db;
}

function getDb(): Promise<Database> {
  return (globalThis.__crmDbPromise ??= createDatabase());
}

// sql.js binds named parameters by their full placeholder (e.g. "@name"). The
// query modules pass bare-keyed objects for their `@name` placeholders, so add
// the sigil here; positional (?) args pass straight through as an array.
function bindParams(args: QueryArgs): SqlValue[] | Record<string, SqlValue> {
  if (Array.isArray(args)) return args;
  const bound: Record<string, SqlValue> = {};
  for (const [key, value] of Object.entries(args)) bound["@" + key] = value;
  return bound;
}

export async function all<T>(sql: string, args: QueryArgs = []): Promise<T[]> {
  const db = await getDb();
  const stmt = db.prepare(sql);
  try {
    stmt.bind(bindParams(args));
    const rows: T[] = [];
    while (stmt.step()) rows.push(stmt.getAsObject() as T);
    return rows;
  } finally {
    stmt.free();
  }
}

export async function get<T>(
  sql: string,
  args: QueryArgs = []
): Promise<T | undefined> {
  return (await all<T>(sql, args))[0];
}

/** Runs a write and returns the last inserted rowid (0 when not applicable). */
export async function run(sql: string, args: QueryArgs = []): Promise<number> {
  const db = await getDb();
  db.run(sql, bindParams(args));
  const res = db.exec("SELECT last_insert_rowid() AS id");
  return Number(res[0]?.values[0]?.[0] ?? 0);
}

/** Runs several writes atomically (stands in for the schema's ON DELETE rules). */
export async function batch(
  statements: { sql: string; args?: QueryArgs }[]
): Promise<void> {
  const db = await getDb();
  db.run("BEGIN");
  try {
    for (const s of statements) db.run(s.sql, bindParams(s.args ?? []));
    db.run("COMMIT");
  } catch (err) {
    db.run("ROLLBACK");
    throw err;
  }
}
