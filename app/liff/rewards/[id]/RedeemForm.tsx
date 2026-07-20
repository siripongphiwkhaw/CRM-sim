"use client";

import { useActionState } from "react";
import type { FormState } from "@/lib/validation";
import { liffRedeemAction } from "../../actions";
import { LiffButton } from "../../components/LiffButton";

/**
 * Note what this form does NOT contain: any customer identifier. The member is
 * resolved from the session server-side, so a tampered field cannot redeem
 * against someone else's balance.
 */
export function RedeemForm({
  rewardId,
  affordable,
}: {
  rewardId: number;
  affordable: boolean;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(liffRedeemAction, {});

  if (state.success) {
    return (
      <div className="rounded-[14px] border border-[#cdefc4] bg-[#f2fbef] px-4 py-3 text-sm text-[#194e31]">
        {state.success}
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="reward_id" value={rewardId} />
      {state.error && (
        <p className="rounded-[12px] bg-[#feded8] px-3 py-2 text-sm text-[#8e030f]">
          {state.error}
        </p>
      )}
      <LiffButton disabled={!affordable}>
        {affordable ? "Redeem now" : "Not enough points"}
      </LiffButton>
    </form>
  );
}
