"use client";

import { useActionState } from "react";
import type { SqlValue } from "@/db/client";
import { FormError, SubmitButton } from "@/app/components/form";
import { runQueryAction, type SqlState } from "./actions";

const SAMPLE = `SELECT tier, COUNT(*) AS members, ROUND(AVG(clv)) AS avg_clv
FROM customers
GROUP BY tier
ORDER BY members DESC`;

function cell(value: SqlValue): string {
  if (value === null) return "NULL";
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
          className="w-full rounded border border-[#c2d0d6] bg-[#0d7d70] px-3 py-2 font-mono text-sm text-[#eef4ff] focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
        <div className="flex items-center gap-3">
          <SubmitButton>Run query</SubmitButton>
          <span className="text-xs text-[#607785]">
            Read-only — SELECT statements only. Max 500 rows.
          </span>
        </div>
      </form>

      {state.error && <FormError message={state.error} />}

      {result && (
        <div>
          <p className="mb-2 text-sm text-[#607785]">
            {result.rowCount} row{result.rowCount === 1 ? "" : "s"}
            {result.truncated && " (showing first 500)"}
          </p>
          {result.columns.length === 0 ? (
            <p className="text-sm text-[#607785]">Query returned no columns.</p>
          ) : (
            <div className="overflow-x-auto rounded border border-[#dde5e8] bg-white">
              <table className="min-w-full divide-y divide-[#dde5e8] text-sm">
                <thead className="bg-[#f8fafb] text-left text-xs font-semibold uppercase tracking-wide text-[#3c4f5e]">
                  <tr>
                    {result.columns.map((c) => (
                      <th key={c} className="whitespace-nowrap px-4 py-2 font-mono">{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#eef3f5]">
                  {result.rows.map((row, i) => (
                    <tr key={i} className="hover:bg-[#eef3f5]">
                      {row.map((v, j) => (
                        <td key={j} className="whitespace-nowrap px-4 py-2 font-mono text-[#3c4f5e]">
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
