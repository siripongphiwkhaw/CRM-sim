"use client";

import { useTransition } from "react";
import { toggleTaskAction } from "./actions";

export function TaskToggle({
  id,
  completed,
}: {
  id: number;
  completed: boolean;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <input
      type="checkbox"
      checked={completed}
      disabled={pending}
      aria-label={completed ? "Mark as not done" : "Mark as done"}
      onChange={() => startTransition(() => toggleTaskAction(id))}
      className="h-4 w-4 cursor-pointer rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 disabled:opacity-50"
    />
  );
}
