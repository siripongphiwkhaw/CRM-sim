"use client";

import { useActionState } from "react";
import { Select, FormError, FormSuccess, SubmitButton } from "@/app/components/form";
import type { FormState } from "@/lib/validation";
import type { Reward } from "@/db/queries/loyalty";
import { redeemRewardAction } from "../actions";

export function RedeemForm({
  customerId,
  rewards,
}: {
  customerId: number;
  rewards: Reward[];
}) {
  const [state, formAction] = useActionState<FormState, FormData>(
    redeemRewardAction,
    {}
  );

  if (rewards.length === 0) {
    return <p className="text-sm text-[#607785]">No active rewards to redeem.</p>;
  }

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="customer_id" value={customerId} />
      <FormError message={state.error} />
      <FormSuccess message={state.success} />
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <Select name="reward_id" aria-label="Reward" defaultValue={rewards[0]?.id} className="sm:col-span-2">
          {rewards.map((r) => (
            <option key={r.id} value={r.id}>{r.name} — {r.points_cost} pts</option>
          ))}
        </Select>
        <SubmitButton>Redeem</SubmitButton>
      </div>
    </form>
  );
}
