"use client";

import { useState, useTransition } from "react";
import { CASE_STATUSES, CASE_STATUS_LABELS, type CaseStatus } from "@/lib/constants";
import { updateCaseStatusAction } from "../actions";

const NEXT: Record<CaseStatus, CaseStatus[]> = {
  OPEN: ["IN_PROGRESS", "RESOLVED", "CLOSED"],
  IN_PROGRESS: ["RESOLVED", "CLOSED"],
  RESOLVED: ["CLOSED", "IN_PROGRESS"],
  CLOSED: ["IN_PROGRESS"],
};

const btn =
  "rounded-[9px] border px-3 py-1.5 text-sm font-medium transition duration-150 active:scale-[0.98] disabled:opacity-50";

export function CaseActions({ caseId, status }: { caseId: number; status: CaseStatus }) {
  const [pending, startTransition] = useTransition();
  const [resolution, setResolution] = useState("");
  const targets = NEXT[status] ?? [];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {targets.map((t) => {
          const needsResolution = t === "RESOLVED" || t === "CLOSED";
          const primary = t === "RESOLVED";
          return (
            <button
              key={t}
              disabled={pending}
              onClick={() =>
                startTransition(() => updateCaseStatusAction(caseId, t, needsResolution ? resolution : undefined))
              }
              className={`${btn} ${primary ? "border-brand-600 bg-brand-600 text-white hover:bg-brand-700" : "border-[#c2d0d6] bg-white text-[#3c4f5e] hover:bg-[#eef3f5]"}`}
            >
              Mark {CASE_STATUS_LABELS[t]}
            </button>
          );
        })}
      </div>
      {(targets.includes("RESOLVED") || targets.includes("CLOSED")) && (
        <input
          type="text"
          value={resolution}
          onChange={(e) => setResolution(e.target.value)}
          placeholder="Resolution note (recorded when resolving/closing)"
          className="w-full rounded-[9px] border border-[#c2d0d6] px-3 py-1.5 text-sm focus:border-brand-600 focus:outline-none"
        />
      )}
      <p className="text-xs text-[#607785]">Current status: {CASE_STATUS_LABELS[status]}</p>
      {/* CASE_STATUSES referenced to keep the full lifecycle in view */}
      <p className="sr-only">{CASE_STATUSES.join(",")}</p>
    </div>
  );
}
