"use client";

import { useTransition } from "react";
import { markDeliveryDeliveredAction } from "./actions";

export function MarkDeliveredButton({ id }: { id: number }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => markDeliveryDeliveredAction(id))}
      className="rounded border border-brand-600 bg-brand-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50"
    >
      {pending ? "Marking…" : "Mark delivered"}
    </button>
  );
}
