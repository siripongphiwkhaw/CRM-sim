"use client";

import { useActionState } from "react";
import { FormError, SubmitButton } from "@/app/components/form";
import {
  CONSENT_PURPOSES,
  CONSENT_PURPOSE_LABELS,
  type ConsentPurpose,
  type ConsentStatus,
} from "@/lib/constants";
import type { FormState } from "@/lib/validation";
import { recordConsentAction } from "../actions";

const STATUS_STYLES: Record<ConsentStatus | "NONE", string> = {
  GRANTED: "bg-[#cdefc4] text-[#194e31]",
  DENIED: "bg-[#feded8] text-[#8e030f]",
  WITHDRAWN: "bg-[#fbf3e0] text-[#5f3e02]",
  NONE: "bg-[#e5eaec] text-[#514f4d]",
};

export function ConsentCard({
  customerId,
  current,
  history,
}: {
  customerId: number;
  current: Partial<Record<ConsentPurpose, ConsentStatus>>;
  history: { id: number; purpose: string; status: string; captured_at: string }[];
}) {
  const [state, formAction] = useActionState<FormState, FormData>(
    recordConsentAction,
    {}
  );

  return (
    <div className="space-y-3">
      <FormError message={state.error} />
      {CONSENT_PURPOSES.map((purpose) => {
        const status = current[purpose] ?? "NONE";
        const isGranted = status === "GRANTED";
        return (
          <div key={purpose} className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className={`inline-flex rounded-[16px] px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}>
                {CONSENT_PURPOSE_LABELS[purpose]}: {status === "NONE" ? "Not set" : status}
              </span>
            </div>
            <form action={formAction}>
              <input type="hidden" name="customer_id" value={customerId} />
              <input type="hidden" name="purpose" value={purpose} />
              <input type="hidden" name="status" value={isGranted ? "WITHDRAWN" : "GRANTED"} />
              <button
                type="submit"
                className="rounded-[9px] border border-[#c2d0d6] bg-white px-2.5 py-1 text-xs text-[#3c4f5e] transition hover:bg-[#eef3f5] active:scale-[0.98]"
              >
                {isGranted ? "Withdraw" : "Grant"}
              </button>
            </form>
          </div>
        );
      })}

      {history.length > 0 && (
        <details className="text-xs text-[#607785]">
          <summary className="cursor-pointer select-none">Consent history ({history.length})</summary>
          <ul className="mt-2 space-y-1">
            {history.map((h) => (
              <li key={h.id} className="flex justify-between gap-2">
                <span>{h.purpose} · {h.status}</span>
                <span>{new Date(h.captured_at).toLocaleDateString()}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
