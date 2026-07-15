"use client";

import { useActionState } from "react";
import Link from "next/link";
import {
  Field,
  TextInput,
  TextArea,
  Select,
  FormError,
  SubmitButton,
} from "@/app/components/form";
import type { FormState } from "@/lib/validation";
import type { Contact } from "@/db/queries/contacts";
import type { Company } from "@/db/queries/companies";

type ContactAction = (prev: FormState, formData: FormData) => Promise<FormState>;

export function ContactForm({
  action,
  companies,
  contact,
}: {
  action: ContactAction;
  companies: Company[];
  contact?: Contact;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(action, {});

  return (
    <form action={formAction} className="max-w-2xl space-y-5">
      {contact && <input type="hidden" name="id" value={contact.id} />}
      <FormError message={state.error} />

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field label="First name" htmlFor="first_name" required>
          <TextInput
            id="first_name"
            name="first_name"
            defaultValue={contact?.first_name ?? ""}
            required
          />
        </Field>
        <Field label="Last name" htmlFor="last_name" required>
          <TextInput
            id="last_name"
            name="last_name"
            defaultValue={contact?.last_name ?? ""}
            required
          />
        </Field>
        <Field label="Email" htmlFor="email">
          <TextInput
            id="email"
            name="email"
            type="email"
            defaultValue={contact?.email ?? ""}
          />
        </Field>
        <Field label="Phone" htmlFor="phone">
          <TextInput
            id="phone"
            name="phone"
            defaultValue={contact?.phone ?? ""}
          />
        </Field>
        <Field label="Title" htmlFor="title">
          <TextInput
            id="title"
            name="title"
            defaultValue={contact?.title ?? ""}
          />
        </Field>
        <Field label="Company" htmlFor="company_id">
          <Select
            id="company_id"
            name="company_id"
            defaultValue={contact?.company_id ?? ""}
          >
            <option value="">— None —</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field label="Notes" htmlFor="notes">
        <TextArea
          id="notes"
          name="notes"
          rows={4}
          defaultValue={contact?.notes ?? ""}
        />
      </Field>

      <div className="flex items-center gap-3">
        <SubmitButton>{contact ? "Save changes" : "Create contact"}</SubmitButton>
        <Link
          href={contact ? `/contacts/${contact.id}` : "/contacts"}
          className="text-sm text-slate-500 hover:text-slate-700"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
