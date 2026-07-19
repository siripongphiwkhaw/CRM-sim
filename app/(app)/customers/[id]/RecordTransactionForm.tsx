"use client";

import { useActionState } from "react";
import { TextInput, Select, FormError, FormSuccess, SubmitButton } from "@/app/components/form";
import { TX_CHANNELS, TX_CHANNEL_LABELS } from "@/lib/constants";
import type { FormState } from "@/lib/validation";
import { recordTransactionAction } from "../actions";

export function RecordTransactionForm({ customerId }: { customerId: number }) {
  const [state, formAction] = useActionState<FormState, FormData>(
    recordTransactionAction,
    {}
  );

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="customer_id" value={customerId} />
      <FormError message={state.error} />
      <FormSuccess message={state.success} />
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <Select name="channel" aria-label="Channel" defaultValue={TX_CHANNELS[0]}>
          {TX_CHANNELS.map((c) => (
            <option key={c} value={c}>{TX_CHANNEL_LABELS[c]}</option>
          ))}
        </Select>
        <TextInput name="amount_thb" type="number" min="0" step="1" placeholder="Amount (฿)" aria-label="Amount" required />
        <SubmitButton>Record purchase</SubmitButton>
      </div>
      <p className="text-xs text-[#607785]">
        Points are credited automatically at the member&apos;s rate and tier multiplier.
      </p>
    </form>
  );
}
