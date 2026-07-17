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
import { BRANDS, TIERS, CHANNELS, DATA_LEVELS } from "@/lib/constants";
import type { FormState } from "@/lib/validation";
import type { Customer } from "@/db/queries/customers";

type Action = (prev: FormState, formData: FormData) => Promise<FormState>;

function Checkbox({
  name,
  label,
  defaultChecked,
}: {
  name: string;
  label: string;
  defaultChecked?: boolean;
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-[#444]">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="h-4 w-4 rounded border-[#c9c9c9] text-brand-600 focus:ring-brand-600"
      />
      {label}
    </label>
  );
}

export function CustomerForm({
  action,
  customer,
}: {
  action: Action;
  customer?: Customer;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(action, {});

  return (
    <form action={formAction} className="max-w-2xl space-y-5">
      {customer && <input type="hidden" name="id" value={customer.id} />}
      <FormError message={state.error} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="First name" htmlFor="first_name" required>
          <TextInput id="first_name" name="first_name" placeholder="e.g. Somsri" defaultValue={customer?.first_name ?? ""} required />
        </Field>
        <Field label="Last name" htmlFor="last_name" required>
          <TextInput id="last_name" name="last_name" placeholder="e.g. Jaidee" defaultValue={customer?.last_name ?? ""} required />
        </Field>
        <Field label="Email" htmlFor="email">
          <TextInput id="email" name="email" type="email" placeholder="name@example.com" defaultValue={customer?.email ?? ""} />
        </Field>
        <Field label="Phone" htmlFor="phone">
          <TextInput id="phone" name="phone" placeholder="081-234-5678" defaultValue={customer?.phone ?? ""} />
        </Field>
        <Field label="Brand" htmlFor="brand" required>
          <Select id="brand" name="brand" defaultValue={customer?.brand ?? BRANDS[0]}>
            {BRANDS.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </Select>
        </Field>
        <Field label="Tier" htmlFor="tier" required>
          <Select id="tier" name="tier" defaultValue={customer?.tier ?? "Bronze"}>
            {TIERS.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </Select>
        </Field>
        <Field label="Points" htmlFor="points">
          <TextInput id="points" name="points" type="number" min="0" step="1" defaultValue={customer?.points ?? 0} />
        </Field>
        <Field label="Register channel" htmlFor="register_channel">
          <Select id="register_channel" name="register_channel" defaultValue={customer?.register_channel ?? ""}>
            <option value="">— None —</option>
            {CHANNELS.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </Select>
        </Field>
        <Field label="Data collection level" htmlFor="data_level" required>
          <Select id="data_level" name="data_level" defaultValue={customer?.data_level ?? DATA_LEVELS[0]}>
            {DATA_LEVELS.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </Select>
        </Field>
      </div>

      <fieldset className="rounded border border-[#e5e5e5] p-4">
        <legend className="px-1 text-xs font-semibold text-[#444]">Consent (PDPA)</legend>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:gap-6">
          <Checkbox name="consent_pdpa" label="PDPA consent" defaultChecked={customer ? !!customer.consent_pdpa : true} />
          <Checkbox name="consent_marketing" label="Marketing" defaultChecked={customer ? !!customer.consent_marketing : false} />
          <Checkbox name="consent_migration" label="Data migration" defaultChecked={customer ? !!customer.consent_migration : false} />
        </div>
      </fieldset>

      <div className="flex items-center gap-3">
        <SubmitButton>{customer ? "Save changes" : "Create member"}</SubmitButton>
        <Link
          href={customer ? `/customers/${customer.id}` : "/customers"}
          className="text-sm text-[#706e6b] hover:text-[#181818]"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
