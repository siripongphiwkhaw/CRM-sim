"use client";

import { useActionState } from "react";
import type { FormState } from "@/lib/validation";
import { submitMissionAction } from "../actions";
import { LiffButton } from "../components/LiffButton";

/** No customer id in this form — identity comes from the member session
 * server-side, same rule as the redeem and consent forms. */
export function MissionSubmitForm({
  missionId,
  requiresProof,
  wasRejected,
}: {
  missionId: number;
  requiresProof: boolean;
  wasRejected: boolean;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(submitMissionAction, {});

  if (state.success) {
    return (
      <p className="rounded-[12px] bg-[#f2fbef] px-3 py-2 text-xs text-[#194e31]">{state.success}</p>
    );
  }

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="mission_id" value={missionId} />
      {wasRejected && (
        <p className="text-xs text-[#8e030f]">Your last submission was rejected — you can try again.</p>
      )}
      {state.error && (
        <p className="rounded-[12px] bg-[#feded8] px-3 py-2 text-xs text-[#8e030f]">{state.error}</p>
      )}
      {requiresProof && (
        <textarea
          name="proof_note"
          placeholder="Describe how you completed this (optional)"
          maxLength={500}
          rows={2}
          className="w-full rounded-[12px] border border-[#c2d0d6] bg-white px-3 py-2 text-sm text-[#14202b] focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
        />
      )}
      <LiffButton variant="secondary">{requiresProof ? "Submit for review" : "Complete mission"}</LiffButton>
    </form>
  );
}
