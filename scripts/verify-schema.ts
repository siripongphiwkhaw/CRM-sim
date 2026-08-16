/**
 * Static safety check for db/schema.ts — no database required.
 *
 *   npx tsx scripts/verify-schema.ts
 *
 * Why this exists: SCHEMA_SQL runs as ONE transaction on every cold start. A
 * single failing statement aborts the whole thing, and ensureDatabase() then
 * caches a *rejected* promise, so every query fails for the life of that
 * server instance — the app returns 500 on every route.
 *
 * That has already happened in production here, from a `CREATE INDEX ... ON
 * cases(department_id)` sitting in the CREATE TABLE section while the column
 * itself was only added later in the migration block. On an existing database
 * `CREATE TABLE IF NOT EXISTS` is a no-op, so the column did not exist when
 * the index ran. It compiled, linted, and built cleanly — nothing but actually
 * executing it could catch the fault.
 *
 * So this walks the statements in execution order, tracks which columns exist
 * at each point, and fails on anything that references a column before it is
 * created.
 */

import { SCHEMA_SQL } from "../db/schema";
import { splitStatements } from "../db/client";

interface Violation {
  index: number;
  statement: string;
  problem: string;
}

/**
 * Pulls column names out of a CREATE TABLE body. Deliberately loose: it only
 * needs the leading identifier of each top-level line, and anything it misses
 * shows up as a false positive rather than a missed fault.
 */
function parseCreateTableColumns(body: string): string[] {
  const names: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of body) {
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      names.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  names.push(current);

  return names
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    // Skip table-level constraints — they are not columns.
    .filter((chunk) => !/^(PRIMARY\s+KEY|FOREIGN\s+KEY|UNIQUE|CHECK|CONSTRAINT)\b/i.test(chunk))
    .map((chunk) => chunk.split(/\s+/)[0].replace(/"/g, ""))
    .filter((name) => /^[a-z_][a-z0-9_]*$/i.test(name));
}

export function lintSchema(sql: string): { violations: Violation[]; tableCount: number; statementCount: number } {
const violations: Violation[] = [];

/** table -> set of column names known to exist at this point in the script. */
const columns = new Map<string, Set<string>>();

function ensureTable(table: string): Set<string> {
  const existing = columns.get(table);
  if (existing) return existing;
  const created = new Set<string>();
  columns.set(table, created);
  return created;
}

const statements = splitStatements(sql);

statements.forEach((statement, index) => {
  const flat = statement.replace(/\s+/g, " ").trim();

  // --- Postgres constructs this splitter cannot survive ---------------------
  if (/\$\$/.test(statement)) {
    violations.push({
      index,
      statement: flat.slice(0, 90),
      problem: "Contains a $$ block — splitStatements() splits on ';' and will tear it apart.",
    });
  }

  // --- CREATE TABLE: register its columns -----------------------------------
  const createTable = statement.match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-z_][a-z0-9_]*)\s*\(([\s\S]*)\)\s*$/i);
  if (createTable) {
    const [, table, body] = createTable;
    const set = ensureTable(table);
    for (const col of parseCreateTableColumns(body)) set.add(col.toLowerCase());
    if (!/IF\s+NOT\s+EXISTS/i.test(statement)) {
      violations.push({
        index,
        statement: flat.slice(0, 90),
        problem: "CREATE TABLE without IF NOT EXISTS — re-running the schema will throw.",
      });
    }
    return;
  }

  // --- ALTER TABLE ... ADD COLUMN: register the new column -------------------
  const addColumn = statement.match(
    /ALTER\s+TABLE\s+([a-z_][a-z0-9_]*)\s+ADD\s+COLUMN\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-z_][a-z0-9_]*)/i
  );
  if (addColumn) {
    const [, table, column] = addColumn;
    ensureTable(table).add(column.toLowerCase());
    if (!/ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS/i.test(statement)) {
      violations.push({
        index,
        statement: flat.slice(0, 90),
        problem: "ADD COLUMN without IF NOT EXISTS — re-running the schema will throw.",
      });
    }
    return;
  }

  // --- CREATE INDEX: the statement that bricked production ------------------
  const createIndex = statement.match(
    /CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?[a-z_][a-z0-9_]*\s+ON\s+([a-z_][a-z0-9_]*)\s*\(([^)]*)\)/i
  );
  if (createIndex) {
    const [, table, columnList] = createIndex;
    const known = columns.get(table);
    if (!known) {
      violations.push({
        index,
        statement: flat.slice(0, 90),
        problem: `Indexes table "${table}" before any CREATE TABLE for it.`,
      });
      return;
    }
    for (const raw of columnList.split(",")) {
      const col = raw.trim().split(/\s+/)[0].replace(/"/g, "").toLowerCase();
      if (!col || !/^[a-z_][a-z0-9_]*$/.test(col)) continue; // expression index
      if (!known.has(col)) {
        violations.push({
          index,
          statement: flat.slice(0, 90),
          problem:
            `Indexes ${table}.${col} before that column exists. On an already-provisioned ` +
            `database CREATE TABLE IF NOT EXISTS is a no-op, so this aborts the whole ` +
            `schema transaction. Move it AFTER the matching ALTER TABLE ADD COLUMN.`,
        });
      }
    }
    if (!/IF\s+NOT\s+EXISTS/i.test(statement)) {
      violations.push({
        index,
        statement: flat.slice(0, 90),
        problem: "CREATE INDEX without IF NOT EXISTS — re-running the schema will throw.",
      });
    }
    return;
  }

  // --- ALTER TABLE ... ADD CONSTRAINT: same ordering trap --------------------
  const addConstraint = statement.match(/ALTER\s+TABLE\s+([a-z_][a-z0-9_]*)\s+ADD\s+CONSTRAINT/i);
  if (addConstraint) {
    const [, table] = addConstraint;
    const known = columns.get(table) ?? new Set<string>();
    const fk = statement.match(/FOREIGN\s+KEY\s*\(\s*([a-z_][a-z0-9_]*)\s*\)/i);
    if (fk && !known.has(fk[1].toLowerCase())) {
      violations.push({
        index,
        statement: flat.slice(0, 90),
        problem: `Constrains ${table}.${fk[1]} before that column exists.`,
      });
    }
    // A bare ADD CONSTRAINT throws if the name is already taken, so it must be
    // preceded by a DROP CONSTRAINT IF EXISTS for the same name.
    const name = statement.match(/ADD\s+CONSTRAINT\s+([a-z_][a-z0-9_]*)/i)?.[1];
    if (name) {
      const droppedEarlier = statements
        .slice(0, index + 1)
        .some((s) => new RegExp(`DROP\\s+CONSTRAINT\\s+IF\\s+EXISTS\\s+${name}\\b`, "i").test(s));
      if (!droppedEarlier) {
        violations.push({
          index,
          statement: flat.slice(0, 90),
          problem: `ADD CONSTRAINT ${name} has no preceding DROP CONSTRAINT IF EXISTS — not idempotent.`,
        });
      }
    }
    return;
  }
});

  return { violations, tableCount: columns.size, statementCount: statements.length };
}

/* -------------------------------------------------------------------------- *
 * Self-test — a linter that cannot fail is worth nothing. These reproduce the
 * exact shapes that have broken (or would break) this schema.
 * -------------------------------------------------------------------------- */

const selfTests: { name: string; sql: string; expectProblem: RegExp | null }[] = [
  {
    // The real production incident, reduced.
    name: "index on a column added later in the migration block",
    sql: `
      CREATE TABLE IF NOT EXISTS cases (id INTEGER, subject TEXT);
      CREATE INDEX IF NOT EXISTS cases_department ON cases(department_id);
      ALTER TABLE cases ADD COLUMN IF NOT EXISTS department_id INTEGER;
    `,
    expectProblem: /before that column exists/i,
  },
  {
    name: "same index, correctly ordered",
    sql: `
      CREATE TABLE IF NOT EXISTS cases (id INTEGER, subject TEXT);
      ALTER TABLE cases ADD COLUMN IF NOT EXISTS department_id INTEGER;
      CREATE INDEX IF NOT EXISTS cases_department ON cases(department_id);
    `,
    expectProblem: null,
  },
  {
    name: "CREATE TABLE missing IF NOT EXISTS",
    sql: `CREATE TABLE widgets (id INTEGER);`,
    expectProblem: /without IF NOT EXISTS/i,
  },
  {
    name: "ADD CONSTRAINT with no preceding DROP",
    sql: `
      CREATE TABLE IF NOT EXISTS widgets (id INTEGER, owner_id INTEGER);
      ALTER TABLE widgets ADD CONSTRAINT widgets_owner_fk FOREIGN KEY (owner_id) REFERENCES users(id);
    `,
    expectProblem: /no preceding DROP CONSTRAINT/i,
  },
  {
    name: "$$ block the splitter would tear apart",
    sql: `DO $$ BEGIN RAISE NOTICE 'hi'; END $$;`,
    expectProblem: /\$\$ block/i,
  },
];

let selfTestFailures = 0;
for (const t of selfTests) {
  const found = lintSchema(t.sql).violations;
  const matched = t.expectProblem ? found.some((v) => t.expectProblem!.test(v.problem)) : found.length === 0;
  if (!matched) {
    selfTestFailures++;
    console.log(`self-test FAILED: ${t.name}`);
    console.log(`  got: ${found.map((v) => v.problem).join(" | ") || "(no violations)"}`);
  }
}
console.log(
  selfTestFailures === 0
    ? `Self-test: ${selfTests.length}/${selfTests.length} passed — the linter detects the known failure shapes.\n`
    : `Self-test: ${selfTestFailures} FAILED\n`
);

/* -------------------------------------------------------------------------- *
 * The real check
 * -------------------------------------------------------------------------- */

const result = lintSchema(SCHEMA_SQL);
console.log(`Parsed ${result.statementCount} statements across ${result.tableCount} tables.\n`);

if (result.violations.length > 0 || selfTestFailures > 0) {
  if (result.violations.length > 0) {
    console.log(`FAILED — ${result.violations.length} violation(s) in db/schema.ts:\n`);
    for (const v of result.violations) {
      console.log(`  [stmt ${v.index}] ${v.problem}`);
      console.log(`      ${v.statement}…\n`);
    }
  }
  process.exitCode = 1;
} else {
  console.log("db/schema.ts: all statements idempotent and correctly ordered.");
}
