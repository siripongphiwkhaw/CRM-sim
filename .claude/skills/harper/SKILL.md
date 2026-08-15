---
name: harper
description: >
  Offline grammar, spelling, and style checking for Markdown and prose files,
  powered by Harper (Automattic/harper) via the harper.js WASM library — no
  network calls, no API cost. Use when the user asks to check grammar, proofread,
  spell-check, or review the writing quality of README/docs/CHANGELOG files or
  other prose in this repo. Not for checking source code syntax.
---

Run the local Harper linter against one or more files instead of reading prose
by eye. It catches spelling, grammar, punctuation, capitalization, and style
issues deterministically and cheaply.

## Usage

```
npx tsx scripts/harper-check.mts <file...>
```

Example: `npx tsx scripts/harper-check.mts README.md docs/*.md`

Output is grouped per file as `line:col [LintKind] message -> suggestion`.
Exit code is `1` if any issues were found, `0` if clean.

The script only makes sense on prose — Markdown, plain-text docs, commit
messages, UI copy. Don't point it at `.ts`/`.tsx`/`.json` source files; it will
flag code syntax as spelling errors.

## Interpreting results

Harper has no awareness of this project's vocabulary, so expect noisy false
positives on:
- Proper nouns and product names (`Jenonutz`, LINE, LIFF)
- Domain acronyms (`PDPA`, `B2C`, `B2B`, `RFM`, `OCR`)
- Framework/library identifiers (`Next.js`, `tsx`, `v4`)

Skip those. Prioritize `Grammar`, `Punctuation`, `Capitalization`, `Typo`, and
`Formatting` findings, and genuine `Spelling` misses on ordinary English words.
When fixing, apply the suggested replacement only if it preserves the original
meaning — Harper's suggestions for jargon/acronyms are usually wrong and should
be ignored outright.

## Boundaries

Read-only analysis tool. It does not edit files itself — after running it,
apply fixes yourself with Edit and re-run to confirm the issue is gone. Don't
add it to CI or a pre-commit hook unless the user asks.
