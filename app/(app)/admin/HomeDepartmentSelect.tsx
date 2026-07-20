"use client";

import { useTransition } from "react";
import { setHomeDepartmentAction } from "./actions";

/** Sets which department's module grants apply to a user. */
export function HomeDepartmentSelect({
  userId,
  departmentId,
  departments,
  disabled = false,
}: {
  userId: number;
  departmentId: number | null;
  departments: { id: number; name: string }[];
  disabled?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <select
      value={departmentId ?? ""}
      disabled={pending || disabled}
      onChange={(e) => {
        const raw = e.target.value;
        const next = raw === "" ? null : Number(raw);
        startTransition(() => setHomeDepartmentAction(userId, next));
      }}
      className="rounded border border-[#c2d0d6] bg-white px-2 py-1 text-xs text-[#3c4f5e] focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600 disabled:opacity-50"
    >
      <option value="">— None —</option>
      {departments.map((d) => (
        <option key={d.id} value={d.id}>
          {d.name}
        </option>
      ))}
    </select>
  );
}
