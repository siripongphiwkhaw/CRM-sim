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
      className="rounded-md border border-stone-300 bg-white px-2 py-1 text-xs text-stone-700 focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600 disabled:opacity-50"
    >
      {ROLES.map((r) => (
        <option key={r} value={r}>{r}</option>
      ))}
    </select>
  );
}
