"use client";

import { useActionState } from "react";
import { Field, TextInput, Select, FormError, FormSuccess, SubmitButton } from "@/app/components/form";
import { CAMPAIGN_CHANNELS } from "@/lib/constants";
import type { FormState } from "@/lib/validation";
import type { Segment } from "@/db/queries/segments";
import { createCampaignAction } from "./actions";

export function CampaignForm({ segments }: { segments: Segment[] }) {
  const [state, formAction] = useActionState<FormState, FormData>(createCampaignAction, {});

  if (segments.length === 0) {
    return (
      <p className="text-sm text-[#607785]">
        Create a segment first — campaigns launch to a segment&apos;s audience.
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-2 rounded-[14px] border border-[#dde5e8] bg-[#f8fafb] p-3">
      <FormError message={state.error} />
      <FormSuccess message={state.success} />
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <Field label="Campaign name" htmlFor="camp-name">
          <TextInput id="camp-name" name="name" placeholder="e.g. Gold win-back" required />
        </Field>
        <Field label="Channel" htmlFor="camp-channel">
          <Select id="camp-channel" name="channel" defaultValue={CAMPAIGN_CHANNELS[0]}>
            {CAMPAIGN_CHANNELS.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
        </Field>
        <Field label="Segment" htmlFor="camp-segment">
          <Select id="camp-segment" name="segment_id" defaultValue={segments[0]?.id}>
            {segments.map((s) => (
              <option key={s.id} value={s.id}>{s.name} ({s.live_count})</option>
            ))}
          </Select>
        </Field>
      </div>
      <SubmitButton>Create draft</SubmitButton>
    </form>
  );
}
