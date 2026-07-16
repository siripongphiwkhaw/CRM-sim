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
      className="rounded-md border border-stone-300 px-3 py-1 text-xs font-medium text-stone-700 hover:bg-stone-100 disabled:opacity-50"
    >
      {pending ? "Syncing…" : "Sync now"}
    </button>
  );
}
