"use client";

import { useActionState } from "react";
import { Field, TextInput, Select, FormError, FormSuccess, SubmitButton } from "@/app/components/form";
import { ROLES } from "@/lib/constants";
import { createUserAction, type NewUserState } from "./actions";

export function NewUserForm() {
  const [state, formAction] = useActionState<NewUserState, FormData>(
    createUserAction,
    {}
  );

  return (
    <form action={formAction} className="space-y-3 rounded border border-[#e5e5e5] bg-[#fafaf9] p-3">
      <FormError message={state.error} />
      <FormSuccess message={state.success} />
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Field label="Name" htmlFor="new-user-name">
          <TextInput id="new-user-name" name="name" placeholder="e.g. Somsri Jaidee" required />
        </Field>
        <Field label="Email" htmlFor="new-user-email">
          <TextInput id="new-user-email" name="email" type="email" placeholder="user@crm.local" required />
        </Field>
        <Field label="Password" htmlFor="new-user-password">
          <TextInput id="new-user-password" name="password" type="password" minLength={6} required />
        </Field>
        <Field label="Role" htmlFor="new-user-role">
          <Select id="new-user-role" name="role" defaultValue="user">
            {ROLES.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </Select>
        </Field>
      </div>
      <SubmitButton>Create user</SubmitButton>
    </form>
  );
}
