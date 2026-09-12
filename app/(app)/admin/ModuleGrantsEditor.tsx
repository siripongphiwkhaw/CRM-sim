"use client";

import { useTransition } from "react";
import {
  MODULES,
  MODULE_LABELS,
  CUSTOMER_SCOPES,
  CUSTOMER_SCOPE_LABELS,
  type ModuleKey,
  type CustomerScope,
} from "@/lib/constants";
import {
  toggleModuleAction,
  toggleApproverAction,
  setDepartmentScopeAction,
} from "./actions";

/**
 * Which modules this department grants its members, whether it may approve
 * orders, and which customers its members can see. Admins are unaffected by any
 * of these — they always reach everything and see every member.
 */
export function ModuleGrantsEditor({
  departmentId,
  granted,
  isApprover,
  customerScope,
}: {
  departmentId: number;
  granted: ModuleKey[];
  isApprover: boolean;
  customerScope: CustomerScope | null;
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

      <label className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[#3c4f5e]">
        <span className="font-semibold uppercase tracking-wide text-[#3c4f5e]">
          Customer visibility
        </span>
        <select
          value={customerScope ?? ""}
          disabled={pending}
          onChange={(e) => {
            const next = e.target.value;
            startTransition(() => setDepartmentScopeAction(departmentId, next));
          }}
          className="rounded border border-[#c2d0d6] bg-white px-2 py-1 text-xs disabled:opacity-50"
        >
          <option value="">All members (not restricted)</option>
          {CUSTOMER_SCOPES.filter((s) => s !== "ALL").map((s) => (
            <option key={s} value={s}>
              {CUSTOMER_SCOPE_LABELS[s as CustomerScope]}
            </option>
          ))}
        </select>
        <span className="text-[#607785]">applies on the member&apos;s next page load</span>
      </label>

      {granted.length === 0 && (
        <p className="mt-2 text-xs text-[#607785]">
          No modules granted — members see Home and Guide only.
        </p>
      )}
    </div>
  );
}
