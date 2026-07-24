"use client";

import { useActionState, useTransition } from "react";
import { SubmitButton, FormError, FormSuccess } from "@/app/components/form";
import type { FormState } from "@/lib/validation";
import { runIdentityScanAction, decideIdentityLinkAction } from "./actions";

export function ScanButton() {
  const [state, formAction] = useActionState<FormState, FormData>(runIdentityScanAction, {});
  return (
    <form action={formAction} className="space-y-2">
      <FormSuccess message={state.success} />
      <FormError message={state.error} />
      <SubmitButton>Scan for identity matches</SubmitButton>
    </form>
  );
}

export function DecideButtons({ linkId }: { linkId: number }) {
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(() => void decideIdentityLinkAction(linkId, "CONFIRMED"))}
        className="rounded-[9px] bg-[#cdefc4] px-3 py-1 text-xs font-medium text-[#194e31] active:scale-[0.98] disabled:opacity-50"
      >
        Confirm
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(() => void decideIdentityLinkAction(linkId, "REJECTED"))}
        className="rounded-[9px] bg-[#feded8] px-3 py-1 text-xs font-medium text-[#8e030f] active:scale-[0.98] disabled:opacity-50"
      >
        Reject
      </button>
    </div>
  );
}
