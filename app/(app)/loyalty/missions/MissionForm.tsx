"use client";

import { useActionState } from "react";
import { Field, TextInput, Select, FormError, FormSuccess, SubmitButton } from "@/app/components/form";
import { MISSION_TYPES, MISSION_STATUSES } from "@/lib/constants";
import type { FormState } from "@/lib/validation";
import { createMissionAction } from "./actions";

export function MissionForm() {
  const [state, formAction] = useActionState<FormState, FormData>(createMissionAction, {});

  return (
    <form action={formAction} className="space-y-2 rounded-[14px] border border-[#dde5e8] bg-[#f8fafb] p-3">
      <FormError message={state.error} />
      <FormSuccess message={state.success} />
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Field label="Mission name" htmlFor="mission-name">
          <TextInput id="mission-name" name="name" placeholder="e.g. Refer a friend" required />
        </Field>
        <Field label="Type" htmlFor="mission-type">
          <Select id="mission-type" name="mission_type" defaultValue={MISSION_TYPES[0]}>
            {MISSION_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </Select>
        </Field>
        <Field label="Reward points" htmlFor="mission-points">
          <TextInput id="mission-points" name="reward_points" type="number" min="1" placeholder="e.g. 50" required />
        </Field>
        <Field label="Status" htmlFor="mission-status">
          <Select id="mission-status" name="status" defaultValue="DRAFT">
            {MISSION_STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </Select>
        </Field>
        <Field label="Description" htmlFor="mission-desc">
          <TextInput id="mission-desc" name="description" placeholder="Optional" />
        </Field>
        <Field label="Requires staff approval?" htmlFor="mission-proof">
          <label className="mt-1.5 flex items-center gap-2 text-sm text-[#3c4f5e]">
            <input id="mission-proof" name="requires_proof" type="checkbox" className="h-4 w-4" />
            Members submit proof, staff review before points are awarded
          </label>
        </Field>
        <Field label="Available from" htmlFor="mission-starts">
          <TextInput id="mission-starts" name="starts_at" type="date" placeholder="Optional" />
        </Field>
        <Field label="Available until" htmlFor="mission-ends">
          <TextInput id="mission-ends" name="ends_at" type="date" placeholder="Optional" />
        </Field>
      </div>
      <SubmitButton>Add mission</SubmitButton>
    </form>
  );
}
