"use client";

import { useActionState } from "react";
import {
  TextInput,
  Select,
  FormError,
  SubmitButton,
} from "@/app/components/form";
import {
  INTERACTION_TYPES,
  INTERACTION_TYPE_LABELS,
  CHANNELS,
} from "@/lib/constants";
import type { FormState } from "@/lib/validation";
import { addInteractionAction } from "./actions";

export function AddInteractionForm({ customerId }: { customerId: number }) {
  const [state, formAction] = useActionState<FormState, FormData>(
    addInteractionAction,
    {}
  );

  return (
    <form action={formAction} className="space-y-3 rounded-md border border-slate-200 bg-slate-50 p-3">
      <input type="hidden" name="customer_id" value={customerId} />
      <FormError message={state.error} />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Select name="type" aria-label="Type" defaultValue="purchase">
          {INTERACTION_TYPES.map((t) => (
            <option key={t} value={t}>{INTERACTION_TYPE_LABELS[t]}</option>
          ))}
        </Select>
        <Select name="channel" aria-label="Channel" defaultValue={CHANNELS[0]}>
          {CHANNELS.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </Select>
        <TextInput name="amount" type="number" min="0" step="1" placeholder="Amount" aria-label="Amount" />
        <TextInput name="points" type="number" step="1" placeholder="Points" aria-label="Points" />
      </div>
      <TextInput name="description" placeholder="Description (optional)" aria-label="Description" />
      <SubmitButton>Log interaction</SubmitButton>
    </form>
  );
}
