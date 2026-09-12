/**
 * Static guard for the department-scoped customer visibility control.
 *
 *   npx tsx scripts/verify-customer-scope.ts
 *
 * Every SELECT/JOIN against the `customers` table in db/queries/*.ts must go
 * through lib/customerScope.ts's `customersFor(scope)` — substituting the table
 * name, never appending a WHERE predicate (a predicate on a LEFT JOIN silently
 * turns it into an inner join and drops rows). A direct `FROM customers` or
 * `JOIN customers` read is a data leak: it returns rows the viewer's department
 * is not allowed to see.
 *
 * This has to be text-level. The SQL lives in template literals, so ESLint
 * cannot see it. Runs in CI and locally before shipping any query change.
 */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const QUERIES_DIR = join(__dirname, "..", "db", "queries");

// Reads that are legitimately unscoped, matched as exact trimmed substrings.
// Keep this list short and each entry obviously safe.
const ALLOWED: { needle: string; why: string }[] = [
  {
    needle: "SELECT COALESCE(MAX(id), 0) + 1 AS next FROM customers",
    why: "id generation — no customer data selected",
  },
];

interface Violation {
  file: string;
  line: number;
  text: string;
}

const violations: Violation[] = [];

for (const name of readdirSync(QUERIES_DIR)) {
  if (!name.endsWith(".ts")) continue;
  const file = join(QUERIES_DIR, name);
  const lines = readFileSync(file, "utf8").split("\n");

  lines.forEach((raw, i) => {
    const line = raw.trim();

    // A read against the customers table.
    const isRead = /\b(FROM|JOIN)\s+customers\b/i.test(line);
    if (!isRead) return;

    // Going through the seam — the only acceptable form.
    if (/\b(FROM|JOIN)\s+\$\{customersFor\(/.test(line)) return;

    // A DELETE ... FROM customers is a write, not a read.
    if (/DELETE\s+FROM\s+customers\b/i.test(line)) return;

    // Explicit allow-list.
    if (ALLOWED.some((a) => line.includes(a.needle))) return;

    violations.push({ file: name, line: i + 1, text: line });
  });
}

if (violations.length > 0) {
  console.log(
    `FAILED — ${violations.length} unscoped read(s) of the customers table:\n`
  );
  for (const v of violations) {
    console.log(`  db/queries/${v.file}:${v.line}`);
    console.log(`      ${v.text}`);
    console.log(
      `      → use \`FROM \${customersFor(scope)} c\`, or add scope: ReadScope / SYSTEM_SCOPE\n`
    );
  }
  process.exitCode = 1;
} else {
  console.log(
    "db/queries: every customers-table read goes through customersFor(scope)."
  );
}
