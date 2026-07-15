"use client";

import { useActionState } from "react";
import Link from "next/link";
import {
  Field,
  TextInput,
  Select,
  FormError,
  SubmitButton,
} from "@/app/components/form";
import { DEAL_STAGES } from "@/lib/constants";
import type { FormState } from "@/lib/validation";
import type { Deal } from "@/db/queries/deals";
import type { ContactWithCompany } from "@/db/queries/contacts";
import type { Company } from "@/db/queries/companies";

type DealAction = (prev: FormState, formData: FormData) => Promise<FormState>;

export function DealForm({
  action,
  contacts,
  companies,
  deal,
  defaults,
}: {
  action: DealAction;
  contacts: ContactWithCompany[];
  companies: Company[];
  deal?: Deal;
  defaults?: { contact_id?: number; company_id?: number };
}) {
  const [state, formAction] = useActionState<FormState, FormData>(action, {});

  const contactId = deal?.contact_id ?? defaults?.contact_id ?? "";
  const companyId = deal?.company_id ?? defaults?.company_id ?? "";

  return (
    <form action={formAction} className="max-w-2xl space-y-5">
      {deal && <input type="hidden" name="id" value={deal.id} />}
      <FormError message={state.error} />

      <Field label="Deal title" htmlFor="title" required>
        <TextInput
          id="title"
          name="title"
          defaultValue={deal?.title ?? ""}
          required
        />
      </Field>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field label="Value (USD)" htmlFor="value">
          <TextInput
            id="value"
            name="value"
            type="number"
            min="0"
            step="1"
            defaultValue={deal?.value ?? 0}
          />
        </Field>
        <Field label="Stage" htmlFor="stage" required>
          <Select id="stage" name="stage" defaultValue={deal?.stage ?? "New"}>
            {DEAL_STAGES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Contact" htmlFor="contact_id">
          <Select id="contact_id" name="contact_id" defaultValue={contactId}>
            <option value="">— None —</option>
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.first_name} {c.last_name}
                {c.company_name ? ` · ${c.company_name}` : ""}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Company" htmlFor="company_id">
          <Select id="company_id" name="company_id" defaultValue={companyId}>
            <option value="">— None —</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field label="Expected close date" htmlFor="expected_close_date">
        <TextInput
          id="expected_close_date"
          name="expected_close_date"
          type="date"
          defaultValue={deal?.expected_close_date ?? ""}
        />
      </Field>

      <div className="flex items-center gap-3">
        <SubmitButton>{deal ? "Save changes" : "Create deal"}</SubmitButton>
        <Link
          href={deal ? `/deals/${deal.id}` : "/deals"}
          className="text-sm text-slate-500 hover:text-slate-700"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
