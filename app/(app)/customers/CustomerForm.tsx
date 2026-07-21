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
import { BRANDS, CUST_TYPES, CHANNELS, DATA_LEVELS } from "@/lib/constants";
import type { FormState } from "@/lib/validation";
import type { Customer } from "@/db/queries/customers";

type Action = (prev: FormState, formData: FormData) => Promise<FormState>;

export function CustomerForm({
  action,
  customer,
}: {
  action: Action;
  customer?: Customer;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(action, {});
  const isNew = !customer;

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
        <Field label="Birth date" htmlFor="birth_date" hint="Used for the yearly birthday points bonus">
          <TextInput id="birth_date" name="birth_date" type="date" defaultValue={customer?.birth_date ?? ""} />
        </Field>
        <Field label="Member type" htmlFor="cust_type" required>
          <Select id="cust_type" name="cust_type" defaultValue={customer?.cust_type ?? "B2C"}>
            {CUST_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </Select>
        </Field>
        <Field label="Brand" htmlFor="brand" required>
          <Select id="brand" name="brand" defaultValue={customer?.brand ?? BRANDS[0]}>
            {BRANDS.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </Select>
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

      {isNew ? (
        <fieldset className="rounded-[14px] border border-[#dde5e8] p-4">
          <legend className="px-1 text-xs font-semibold text-[#3c4f5e]">Consent (PDPA) at registration</legend>
          <p className="mb-2 text-xs text-[#607785]">
            Analytics consent is always recorded; the choice below sets marketing consent.
          </p>
          <div className="mt-1 space-y-2">
            <label className="flex items-start gap-2 text-sm text-[#3c4f5e]">
              <input type="radio" name="consent_mode" value="all" defaultChecked className="mt-0.5 h-4 w-4 text-brand-600" />
              <span><strong>Accept all</strong> — grant marketing and analytics consent.</span>
            </label>
            <label className="flex items-start gap-2 text-sm text-[#3c4f5e]">
              <input type="radio" name="consent_mode" value="no_marketing" className="mt-0.5 h-4 w-4 text-brand-600" />
              <span><strong>Register without marketing</strong> — analytics only; marketing denied.</span>
            </label>
          </div>
        </fieldset>
      ) : (
        <p className="text-xs text-[#607785]">
          Consent is managed on the member&apos;s record page (per-purpose history).
        </p>
      )}

      <div className="flex items-center gap-3">
        <SubmitButton>{customer ? "Save changes" : "Create member"}</SubmitButton>
        <Link
          href={customer ? `/customers/${customer.id}` : "/customers"}
          className="text-sm text-[#607785] hover:text-[#14202b]"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
