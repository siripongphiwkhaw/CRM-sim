"use client";

import { useActionState } from "react";
import type { FormState } from "@/lib/validation";
import { requestLinkAction } from "../actions";
import { LiffButton } from "../components/LiffButton";

export function LinkRequestForm() {
  const [state, formAction] = useActionState<FormState, FormData>(requestLinkAction, {});

  if (state.success) {
    return (
      <div className="rounded-[14px] border border-[#cdefc4] bg-[#f2fbef] px-4 py-3 text-sm text-[#194e31]">
        {state.success}
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-2">
      {state.error && (
        <p className="rounded-[12px] bg-[#feded8] px-3 py-2 text-sm text-[#8e030f]">
          {state.error}
        </p>
      )}
      <LiffButton>Request linking</LiffButton>
    </form>
  );
}
