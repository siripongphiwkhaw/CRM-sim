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
import { TRADE_CHANNELS } from "@/lib/constants";
import type { FormState } from "@/lib/validation";
import type { Distributor } from "@/db/queries/distributors";

type Action = (prev: FormState, formData: FormData) => Promise<FormState>;

export function DistributorForm({
  action,
  distributor,
}: {
  action: Action;
  distributor?: Distributor;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(action, {});

  return (
    <form action={formAction} className="max-w-2xl space-y-5">
      {distributor && <input type="hidden" name="id" value={distributor.id} />}
      <FormError message={state.error} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Name" htmlFor="name" required>
          <TextInput id="name" name="name" placeholder="e.g. Northern Trade Co." defaultValue={distributor?.name ?? ""} required />
        </Field>
        <Field label="Status" htmlFor="status" required>
          <Select id="status" name="status" defaultValue={distributor?.status ?? "active"}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </Select>
        </Field>
        <Field label="Region" htmlFor="region">
          <TextInput id="region" name="region" placeholder="e.g. North" defaultValue={distributor?.region ?? ""} />
        </Field>
        <Field label="Trade channel" htmlFor="channel">
          <Select id="channel" name="channel" defaultValue={distributor?.channel ?? ""}>
            <option value="">— None —</option>
            {TRADE_CHANNELS.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </Select>
        </Field>
        <Field label="Contact name" htmlFor="contact_name">
          <TextInput id="contact_name" name="contact_name" placeholder="e.g. Somchai P." defaultValue={distributor?.contact_name ?? ""} />
        </Field>
        <Field label="Phone" htmlFor="phone">
          <TextInput id="phone" name="phone" placeholder="081-234-5678" defaultValue={distributor?.phone ?? ""} />
        </Field>
        <Field label="Email" htmlFor="email">
          <TextInput id="email" name="email" type="email" placeholder="contact@example.com" defaultValue={distributor?.email ?? ""} />
        </Field>
        <Field label="Credit limit" htmlFor="credit_limit">
          <TextInput id="credit_limit" name="credit_limit" type="number" min="0" step="1" defaultValue={distributor?.credit_limit ?? 0} />
        </Field>
      </div>

      <Field label="Address" htmlFor="address">
        <TextArea id="address" name="address" rows={2} defaultValue={distributor?.address ?? ""} />
      </Field>

      <div className="flex items-center gap-3">
        <SubmitButton>{distributor ? "Save changes" : "Create distributor"}</SubmitButton>
        <Link
          href={distributor ? `/channel/distributors/${distributor.id}` : "/channel/distributors"}
          className="text-sm text-[#706e6b] hover:text-[#181818]"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
