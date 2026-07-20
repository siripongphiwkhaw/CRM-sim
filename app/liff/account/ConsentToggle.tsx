"use client";

import { useActionState } from "react";
import type { FormState } from "@/lib/validation";
import type { ConsentPurpose } from "@/lib/constants";
import { liffConsentAction } from "../actions";

/**
 * One consent purpose. Like the redeem form, this carries no customer id —
 * the member comes from the session.
 */
export function ConsentToggle({
  purpose,
  label,
  description,
  granted,
}: {
  purpose: ConsentPurpose;
  label: string;
  description: string;
  granted: boolean;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(liffConsentAction, {});

  return (
    <form action={formAction} className="flex items-start justify-between gap-3 py-3">
      <input type="hidden" name="purpose" value={purpose} />
      <input type="hidden" name="status" value={granted ? "WITHDRAWN" : "GRANTED"} />
      <div className="min-w-0">
        <p className="text-sm font-medium text-[#14202b]">{label}</p>
        <p className="mt-0.5 text-xs text-[#607785]">{description}</p>
        {state.error && <p className="mt-1 text-xs text-[#8e030f]">{state.error}</p>}
      </div>
      <button
        type="submit"
        role="switch"
        aria-checked={granted}
        aria-label={`${granted ? "Turn off" : "Turn on"} ${label}`}
        className={`relative mt-0.5 h-7 w-12 shrink-0 rounded-full transition-colors ${
          granted ? "bg-brand-600" : "bg-[#c2d0d6]"
        }`}
      >
        <span
          className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${
            granted ? "left-6" : "left-1"
          }`}
        />
      </button>
    </form>
  );
}
