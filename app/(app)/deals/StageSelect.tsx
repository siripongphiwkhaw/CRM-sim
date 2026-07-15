"use client";

import { useTransition } from "react";
import { DEAL_STAGES, type DealStage } from "@/lib/constants";
import { moveDealStageAction } from "./actions";

export function StageSelect({
  dealId,
  stage,
}: {
  dealId: number;
  stage: DealStage;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <select
      value={stage}
      disabled={pending}
      aria-label="Move stage"
      onChange={(e) => {
        const next = e.target.value;
        startTransition(() => {
          moveDealStageAction(dealId, next);
        });
      }}
      className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
    >
      {DEAL_STAGES.map((s) => (
        <option key={s} value={s}>
          {s}
        </option>
      ))}
    </select>
  );
}
