"use client";

import { useTransition } from "react";
import { syncAllAction } from "./actions";

export function SyncAllButton() {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => syncAllAction())}
      className="inline-flex items-center rounded border border-brand-600 bg-brand-600 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-brand-700 hover:border-brand-700 disabled:opacity-50"
    >
      {pending ? "Syncing all…" : "Sync all"}
    </button>
  );
}
