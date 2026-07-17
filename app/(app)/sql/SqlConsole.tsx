"use client";

import { useActionState } from "react";
import type { SqlValue } from "sql.js";
import { FormError, SubmitButton } from "@/app/components/form";
import { runQueryAction, type SqlState } from "./actions";

const SAMPLE = `SELECT tier, COUNT(*) AS members, ROUND(AVG(clv)) AS avg_clv
FROM customers
GROUP BY tier
ORDER BY members DESC`;

function cell(value: SqlValue): string {
  if (value === null) return "NULL";
  if (value instanceof Uint8Array) return "[blob]";
  return String(value);
}

export function SqlConsole() {
  const [state, formAction] = useActionState<SqlState, FormData>(
    runQueryAction,
    {}
  );

  const result = state.result;

  return (
    <div className="space-y-3">
      <form action={formAction} className="space-y-3">
        <textarea
          name="query"
          rows={6}
          defaultValue={state.query ?? SAMPLE}
          spellCheck={false}
          className="w-full rounded border border-[#c9c9c9] bg-[#032d60] px-3 py-2 font-mono text-sm text-[#eef4ff] focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
        <div className="flex items-center gap-3">
          <SubmitButton>Run query</SubmitButton>
          <span className="text-xs text-[#706e6b]">
            Read-only — SELECT statements only. Max 500 rows.
          </span>
        </div>
      </form>

      {state.error && <FormError message={state.error} />}

      {result && (
        <div>
          <p className="mb-2 text-sm text-[#706e6b]">
            {result.rowCount} row{result.rowCount === 1 ? "" : "s"}
            {result.truncated && " (showing first 500)"}
          </p>
          {result.columns.length === 0 ? (
            <p className="text-sm text-[#706e6b]">Query returned no columns.</p>
          ) : (
            <div className="overflow-x-auto rounded border border-[#e5e5e5] bg-white">
              <table className="min-w-full divide-y divide-[#e5e5e5] text-sm">
                <thead className="bg-[#fafaf9] text-left text-xs font-semibold uppercase tracking-wide text-[#444]">
                  <tr>
                    {result.columns.map((c) => (
                      <th key={c} className="whitespace-nowrap px-4 py-2 font-mono">{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f3f3f3]">
                  {result.rows.map((row, i) => (
                    <tr key={i} className="hover:bg-[#f3f3f3]">
                      {row.map((v, j) => (
                        <td key={j} className="whitespace-nowrap px-4 py-2 font-mono text-[#444]">
                          {cell(v)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
