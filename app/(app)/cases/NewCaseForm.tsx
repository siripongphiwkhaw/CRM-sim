"use client";

import { useActionState } from "react";
import { Field, TextInput, TextArea, Select, FormError, SubmitButton } from "@/app/components/form";
import { CASE_CATEGORIES, CASE_PRIORITIES } from "@/lib/constants";
import type { FormState } from "@/lib/validation";
import { createCaseAction } from "./actions";

export function NewCaseForm({
  members,
}: {
  members: { id: number; label: string }[];
}) {
  const [state, formAction] = useActionState<FormState, FormData>(
    createCaseAction,
    {}
  );

  return (
    <form action={formAction} className="space-y-3 rounded-[14px] border border-[#dde5e8] bg-[#f8fafb] p-3">
      <FormError message={state.error} />
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Field label="Subject" htmlFor="case-subject" required>
          <TextInput id="case-subject" name="subject" placeholder="e.g. Points not credited" required />
        </Field>
        <Field label="Member" htmlFor="case-member">
          <Select id="case-member" name="customer_id" defaultValue="">
            <option value="">— None —</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </Select>
        </Field>
        <Field label="Category" htmlFor="case-category">
          <Select id="case-category" name="category" defaultValue="OTHER">
            {CASE_CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </Select>
        </Field>
        <Field label="Priority" htmlFor="case-priority">
          <Select id="case-priority" name="priority" defaultValue="MEDIUM">
            {CASE_PRIORITIES.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="Description" htmlFor="case-desc">
        <TextArea id="case-desc" name="description" rows={2} placeholder="What happened?" />
      </Field>
      <SubmitButton>Open case</SubmitButton>
    </form>
  );
}
