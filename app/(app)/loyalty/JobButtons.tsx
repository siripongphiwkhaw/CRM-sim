"use client";

import { useActionState } from "react";
import { TextInput, SubmitButton, FormSuccess, FormError } from "@/app/components/form";
import type { FormState } from "@/lib/validation";
import { runBirthdayRewardsAction, runPointExpiryAction } from "./actions";

/** On-demand admin jobs — no scheduler exists yet, so these are click-to-run. */
export function JobButtons() {
  const [birthdayState, birthdayAction] = useActionState<FormState, FormData>(runBirthdayRewardsAction, {});
  const [expiryState, expiryAction] = useActionState<FormState, FormData>(runPointExpiryAction, {});

  return (
    <div className="space-y-3">
      <form action={birthdayAction}>
        <FormSuccess message={birthdayState.success} />
        <FormError message={birthdayState.error} />
        <SubmitButton>Run birthday rewards</SubmitButton>
        <p className="mt-1 text-xs text-[#607785]">
          Awards a once-a-year bonus to members whose birthday is today.
        </p>
      </form>

      <form action={expiryAction} className="space-y-1">
        <FormSuccess message={expiryState.success} />
        <FormError message={expiryState.error} />
        <div className="flex items-center gap-2">
          <TextInput
            name="months"
            type="number"
            min="1"
            defaultValue={12}
            className="w-20"
            aria-label="Months"
          />
          <SubmitButton>Expire points older than N months</SubmitButton>
        </div>
        <p className="text-xs text-[#607785]">
          Simplified aggregate model — see the note in runPointExpiry().
        </p>
      </form>
    </div>
  );
}
