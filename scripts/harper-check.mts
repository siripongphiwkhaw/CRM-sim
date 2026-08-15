/**
 * Grammar/prose check for Markdown and plain-text files, powered by Harper
 * (https://github.com/Automattic/harper), run fully offline via harper.js.
 *
 *   npx tsx scripts/harper-check.ts README.md docs/*.md
 *
 * Exits 1 if any issues are found (so it can be used as a gate), 0 otherwise.
 */

import { readFileSync } from "node:fs";
import { LocalLinter, Dialect, type Lint } from "harper.js";
import { binaryInlined } from "harper.js/binaryInlined";

function lineColAt(text: string, offset: number): { line: number; col: number } {
  let line = 1;
  let col = 1;
  for (let i = 0; i < offset && i < text.length; i++) {
    if (text[i] === "\n") {
      line++;
      col = 1;
    } else {
      col++;
    }
  }
  return { line, col };
}

function languageFor(path: string): "markdown" | "plaintext" {
  return path.endsWith(".md") || path.endsWith(".mdx") ? "markdown" : "plaintext";
}

async function main() {
  const files = process.argv.slice(2);
  if (files.length === 0) {
    console.error("Usage: npx tsx scripts/harper-check.ts <file...>");
    process.exit(2);
  }

  const linter = new LocalLinter({ binary: binaryInlined, dialect: Dialect.American });
  await linter.setup();

  let totalIssues = 0;

  for (const path of files) {
    const text = readFileSync(path, "utf-8");
    const lints: Lint[] = await linter.lint(text, { language: languageFor(path) });

    if (lints.length === 0) continue;

    totalIssues += lints.length;
    console.log(`\n${path} (${lints.length} issue${lints.length === 1 ? "" : "s"})`);

    for (const lint of lints) {
      const span = lint.span();
      const { line, col } = lineColAt(text, span.start);
      const suggestions = lint
        .suggestions()
        .map((s) => s.get_replacement_text())
        .filter(Boolean);
      const fix = suggestions.length > 0 ? ` -> ${suggestions.join(" | ")}` : "";
      console.log(`  ${line}:${col} [${lint.lint_kind()}] ${lint.message()}${fix}`);
    }
  }

  await linter.dispose();

  if (totalIssues === 0) {
    console.log("No issues found.");
    process.exit(0);
  }

  console.log(`\n${totalIssues} total issue${totalIssues === 1 ? "" : "s"}.`);
  process.exit(1);
}

main();
