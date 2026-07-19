"use client";

import { useTransition } from "react";
import { regenerateInsightsAction, dismissInsightAction } from "./actions";

export function RegenerateButton() {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => regenerateInsightsAction())}
      className="inline-flex items-center rounded-[9px] border border-brand-600 bg-brand-600 px-4 py-1.5 text-sm font-medium text-white transition duration-150 hover:bg-brand-700 active:scale-[0.98] disabled:opacity-50"
    >
      {pending ? "Regenerating…" : "Regenerate insights"}
    </button>
  );
}

export function DismissButton({ id }: { id: number }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => dismissInsightAction(id))}
      className="rounded-[9px] border border-[#c2d0d6] bg-white px-2.5 py-1 text-xs text-[#607785] transition hover:bg-[#eef3f5] active:scale-[0.98] disabled:opacity-50"
    >
      Dismiss
    </button>
  );
}
