"use client";

import { useTransition } from "react";
import { syncSourceAction } from "./actions";

export function SyncButton({ id }: { id: number }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => syncSourceAction(id))}
      className="rounded border border-[#c9c9c9] bg-white px-3 py-1 text-xs font-medium text-[#444] hover:bg-[#f3f3f3] disabled:opacity-50"
    >
      {pending ? "Syncing…" : "Sync now"}
    </button>
  );
}
