"use client";

import { useState, useActionState } from "react";
import { TextInput, Select, FormError, SubmitButton } from "@/app/components/form";
import {
  INTERACTION_TYPES,
  INTERACTION_TYPE_LABELS,
  CHANNELS,
  type InteractionType,
} from "@/lib/constants";
import type { FormState } from "@/lib/validation";
import { addInteractionAction } from "./actions";

/** Salesforce-style activity composer: type tabs above a compact log form. */
export function ActivityComposer({ customerId }: { customerId: number }) {
  const [type, setType] = useState<InteractionType>("purchase");
  const [state, formAction] = useActionState<FormState, FormData>(
    addInteractionAction,
    {}
  );

  return (
    <div className="rounded border border-[#e5e5e5]">
      <div className="flex border-b border-[#e5e5e5] bg-[#fafaf9]">
        {INTERACTION_TYPES.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setType(t)}
            className={`border-b-2 px-4 py-2 text-xs font-medium transition-colors ${
              type === t
                ? "border-brand-600 bg-white text-brand-700"
                : "border-transparent text-[#706e6b] hover:text-[#181818]"
            }`}
          >
            Log {INTERACTION_TYPE_LABELS[t]}
          </button>
        ))}
      </div>

      <form action={formAction} className="space-y-2.5 p-3">
        <input type="hidden" name="customer_id" value={customerId} />
        <input type="hidden" name="type" value={type} />
        <FormError message={state.error} />
        <div className={`grid gap-2 ${type === "purchase" ? "grid-cols-3" : "grid-cols-2"}`}>
          <Select name="channel" aria-label="Channel" defaultValue={CHANNELS[0]}>
            {CHANNELS.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </Select>
          {type === "purchase" && (
            <TextInput name="amount" type="number" min="0" step="1" placeholder="Amount (฿)" aria-label="Amount" />
          )}
          <TextInput name="points" type="number" step="1" placeholder="Points" aria-label="Points" />
        </div>
        <TextInput name="description" placeholder={`Describe this ${INTERACTION_TYPE_LABELS[type].toLowerCase()}…`} aria-label="Description" />
        <SubmitButton>Save</SubmitButton>
      </form>
    </div>
  );
}
