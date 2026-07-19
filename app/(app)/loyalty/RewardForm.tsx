"use client";

import { useActionState } from "react";
import { Field, TextInput, Select, FormError, FormSuccess, SubmitButton } from "@/app/components/form";
import { REWARD_TYPES } from "@/lib/constants";
import type { FormState } from "@/lib/validation";
import { createRewardAction } from "./actions";

export function RewardForm() {
  const [state, formAction] = useActionState<FormState, FormData>(
    createRewardAction,
    {}
  );

  return (
    <form action={formAction} className="space-y-2 rounded-[14px] border border-[#dde5e8] bg-[#f8fafb] p-3">
      <FormError message={state.error} />
      <FormSuccess message={state.success} />
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Field label="Reward name" htmlFor="reward-name">
          <TextInput id="reward-name" name="name" placeholder="e.g. ฿100 voucher" required />
        </Field>
        <Field label="Type" htmlFor="reward-type">
          <Select id="reward-type" name="reward_type" defaultValue={REWARD_TYPES[0]}>
            {REWARD_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </Select>
        </Field>
        <Field label="Points cost" htmlFor="reward-cost">
          <TextInput id="reward-cost" name="points_cost" type="number" min="1" placeholder="e.g. 200" required />
        </Field>
        <Field label="Description" htmlFor="reward-desc">
          <TextInput id="reward-desc" name="description" placeholder="Optional" />
        </Field>
      </div>
      <SubmitButton>Add reward</SubmitButton>
    </form>
  );
}
