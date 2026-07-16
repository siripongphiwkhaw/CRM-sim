"use client";

import { useTransition } from "react";
import { ROLES } from "@/lib/constants";
import { setRoleAction } from "./actions";

export function RoleSelect({
  userId,
  role,
}: {
  userId: number;
  role: string;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <select
      value={role}
      disabled={pending}
      onChange={(e) => {
        const next = e.target.value;
        startTransition(() => setRoleAction(userId, next));
      }}
      className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
    >
      {ROLES.map((r) => (
        <option key={r} value={r}>{r}</option>
      ))}
    </select>
  );
}
