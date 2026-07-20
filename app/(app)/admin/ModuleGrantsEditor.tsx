"use client";

import { useTransition } from "react";
import { MODULES, MODULE_LABELS, type ModuleKey } from "@/lib/constants";
import { toggleModuleAction, toggleApproverAction } from "./actions";

/**
 * Which modules this department grants its members, plus whether it may approve
 * orders. Admins are unaffected by either — they always reach everything.
 */
export function ModuleGrantsEditor({
  departmentId,
  granted,
  isApprover,
}: {
  departmentId: number;
  granted: ModuleKey[];
  isApprover: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const grantedSet = new Set(granted);

  return (
    <div className="mt-3 border-t border-[#eef3f5] pt-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#3c4f5e]">
        Module access
      </p>
      <div className="flex flex-wrap gap-1.5">
        {MODULES.map((m) => {
          const on = grantedSet.has(m);
          return (
            <button
              key={m}
              type="button"
              disabled={pending}
              aria-pressed={on}
              onClick={() =>
                startTransition(() => toggleModuleAction(departmentId, m, !on))
              }
              className={`rounded-[16px] px-2.5 py-1 text-xs font-medium transition duration-150 active:scale-[0.98] disabled:opacity-50 ${
                on
                  ? "bg-brand-600 text-white"
                  : "border border-[#c2d0d6] bg-white text-[#607785] hover:bg-[#eef3f5]"
              }`}
            >
              {on ? "✓ " : ""}
              {MODULE_LABELS[m]}
            </button>
          );
        })}
      </div>

      <label className="mt-3 flex items-center gap-2 text-xs text-[#3c4f5e]">
        <input
          type="checkbox"
          checked={isApprover}
          disabled={pending}
          onChange={(e) => {
            const next = e.target.checked;
            startTransition(() => toggleApproverAction(departmentId, next));
          }}
          className="h-3.5 w-3.5 rounded border-[#c2d0d6] text-brand-600 focus:ring-brand-600 disabled:opacity-50"
        />
        Approver unit — members may approve or reject submitted orders
      </label>

      {granted.length === 0 && (
        <p className="mt-2 text-xs text-[#607785]">
          No modules granted — members see Home and Guide only.
        </p>
      )}
    </div>
  );
}
