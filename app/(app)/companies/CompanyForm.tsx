"use client";

import { useActionState } from "react";
import Link from "next/link";
import {
  Field,
  TextInput,
  TextArea,
  FormError,
  SubmitButton,
} from "@/app/components/form";
import type { FormState } from "@/lib/validation";
import type { Company } from "@/db/queries/companies";

type CompanyAction = (prev: FormState, formData: FormData) => Promise<FormState>;

export function CompanyForm({
  action,
  company,
}: {
  action: CompanyAction;
  company?: Company;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(action, {});

  return (
    <form action={formAction} className="max-w-2xl space-y-5">
      {company && <input type="hidden" name="id" value={company.id} />}
      <FormError message={state.error} />

      <Field label="Company name" htmlFor="name" required>
        <TextInput
          id="name"
          name="name"
          defaultValue={company?.name ?? ""}
          required
        />
      </Field>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field label="Industry" htmlFor="industry">
          <TextInput
            id="industry"
            name="industry"
            defaultValue={company?.industry ?? ""}
          />
        </Field>
        <Field label="Website" htmlFor="website">
          <TextInput
            id="website"
            name="website"
            placeholder="https://…"
            defaultValue={company?.website ?? ""}
          />
        </Field>
        <Field label="Phone" htmlFor="phone">
          <TextInput
            id="phone"
            name="phone"
            defaultValue={company?.phone ?? ""}
          />
        </Field>
      </div>

      <Field label="Address" htmlFor="address">
        <TextArea
          id="address"
          name="address"
          rows={3}
          defaultValue={company?.address ?? ""}
        />
      </Field>

      <div className="flex items-center gap-3">
        <SubmitButton>{company ? "Save changes" : "Create company"}</SubmitButton>
        <Link
          href={company ? `/companies/${company.id}` : "/companies"}
          className="text-sm text-slate-500 hover:text-slate-700"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
