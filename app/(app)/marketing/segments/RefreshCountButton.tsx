"use client";

import { useTransition } from "react";
import { refreshSegmentAction } from "./actions";

export function RefreshCountButton({ id, count }: { id: number; count: number }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => refreshSegmentAction(id))}
      title="Recompute live count"
      className="rounded-[16px] bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700 transition active:scale-[0.98] disabled:opacity-50"
    >
      {pending ? "…" : `${count.toLocaleString("en-US")} members`}
    </button>
  );
}
