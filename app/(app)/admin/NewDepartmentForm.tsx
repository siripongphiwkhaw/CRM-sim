"use client";

import { useActionState } from "react";
import { Field, TextInput, FormError, SubmitButton } from "@/app/components/form";
import type { FormState } from "@/lib/validation";
import { createDepartmentAction } from "./actions";

export function NewDepartmentForm() {
  const [state, formAction] = useActionState<FormState, FormData>(
    createDepartmentAction,
    {}
  );

  return (
    <form action={formAction} className="space-y-2 rounded border border-[#e5e5e5] bg-[#fafaf9] p-3">
      <FormError message={state.error} />
      <div className="grid grid-cols-2 gap-2">
        <Field label="Name" htmlFor="new-dept-name">
          <TextInput id="new-dept-name" name="name" required />
        </Field>
        <Field label="Description" htmlFor="new-dept-desc">
          <TextInput id="new-dept-desc" name="description" />
        </Field>
      </div>
      <SubmitButton>Create department</SubmitButton>
    </form>
  );
}
