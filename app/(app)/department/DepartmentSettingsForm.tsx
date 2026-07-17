"use client";

import { useActionState } from "react";
import { Field, TextInput, TextArea, FormError, FormSuccess, SubmitButton } from "@/app/components/form";
import type { Department } from "@/db/queries/departments";
import { updateMyDepartmentAction, type DepartmentSettingsState } from "./actions";

export function DepartmentSettingsForm({ department }: { department: Department }) {
  const [state, formAction] = useActionState<DepartmentSettingsState, FormData>(
    updateMyDepartmentAction,
    {}
  );

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="department_id" value={department.id} />
      <FormError message={state.error} />
      <FormSuccess message={state.success} />
      <Field label="Name" htmlFor={`dept-name-${department.id}`}>
        <TextInput id={`dept-name-${department.id}`} name="name" defaultValue={department.name} required />
      </Field>
      <Field label="Description" htmlFor={`dept-desc-${department.id}`}>
        <TextArea id={`dept-desc-${department.id}`} name="description" rows={3} defaultValue={department.description ?? ""} />
      </Field>
      <SubmitButton>Save</SubmitButton>
    </form>
  );
}
