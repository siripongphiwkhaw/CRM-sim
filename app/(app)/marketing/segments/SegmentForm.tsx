"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { Field, TextInput, Select, FormError, FormSuccess, SubmitButton } from "@/app/components/form";
import { TIERS, BRANDS, CUST_TYPES, CHURN_LEVELS } from "@/lib/constants";
import type { FormState } from "@/lib/validation";
import { createSegmentAction, previewSegmentCountAction } from "./actions";

export function SegmentForm() {
  const [state, formAction] = useActionState<FormState, FormData>(createSegmentAction, {});
  const [preview, setPreview] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      action={(formData) => {
        setPreview(null);
        return formAction(formData);
      }}
      className="space-y-2 rounded-[14px] border border-[#dde5e8] bg-[#f8fafb] p-3"
    >
      <FormError message={state.error} />
      <FormSuccess message={state.success} />
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <Field label="Segment name" htmlFor="seg-name">
          <TextInput id="seg-name" name="name" placeholder="e.g. Gold at-risk" required />
        </Field>
        <Field label="Tier" htmlFor="seg-tier">
          <Select id="seg-tier" name="tier" defaultValue="">
            <option value="">Any</option>
            {TIERS.map((t) => <option key={t} value={t}>{t}</option>)}
          </Select>
        </Field>
        <Field label="Brand" htmlFor="seg-brand">
          <Select id="seg-brand" name="brand" defaultValue="">
            <option value="">Any</option>
            {BRANDS.map((b) => <option key={b} value={b}>{b}</option>)}
          </Select>
        </Field>
        <Field label="Member type" htmlFor="seg-custtype">
          <Select id="seg-custtype" name="cust_type" defaultValue="">
            <option value="">Any</option>
            {CUST_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </Select>
        </Field>
        <Field label="Min points" htmlFor="seg-minpoints">
          <TextInput id="seg-minpoints" name="min_points" type="number" min="0" placeholder="e.g. 500" />
        </Field>
        <Field label="Churn risk" htmlFor="seg-churn">
          <Select id="seg-churn" name="churn_level" defaultValue="">
            <option value="">Any</option>
            {CHURN_LEVELS.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
        </Field>
        <Field label="Marketing consent" htmlFor="seg-consent">
          <Select id="seg-consent" name="marketing_consent" defaultValue="">
            <option value="">Any</option>
            <option value="true">Granted only</option>
            <option value="false">Not granted</option>
          </Select>
        </Field>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            const data = new FormData(formRef.current!);
            startTransition(async () => setPreview(await previewSegmentCountAction(data)));
          }}
          className="rounded-[9px] border border-[#c2d0d6] bg-white px-3 py-1.5 text-sm font-medium text-[#3c4f5e] transition hover:bg-[#eef3f5] active:scale-[0.98] disabled:opacity-50"
        >
          {pending ? "Counting…" : "Preview count"}
        </button>
        {preview !== null && (
          <span className="text-sm text-[#607785]">
            <strong className="text-[#14202b]">{preview.toLocaleString("en-US")}</strong> members match
          </span>
        )}
      </div>

      <SubmitButton>Save segment</SubmitButton>
    </form>
  );
}
