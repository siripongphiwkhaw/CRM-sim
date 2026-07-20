"use client";

import { useActionState } from "react";
import type { FormState } from "@/lib/validation";
import { registerLineMemberAction } from "../actions";
import { LiffButton } from "../components/LiffButton";

const control =
  "mt-1 w-full rounded-[12px] border border-[#c2d0d6] bg-white px-3 py-2.5 text-base text-[#14202b] focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600";

/** First-time registration. Name is prefilled from the LINE profile; phone
 * and email are required. The LINE identity is taken from the session. */
export function RegisterForm({
  firstName,
  lastName,
}: {
  firstName: string;
  lastName: string;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(registerLineMemberAction, {});

  return (
    <form action={formAction} className="space-y-3 text-left">
      {state.error && (
        <p className="rounded-[12px] bg-[#feded8] px-3 py-2 text-sm text-[#8e030f]">{state.error}</p>
      )}

      <div className="flex gap-2">
        <label className="block w-1/2 text-xs text-[#607785]">
          First name
          <input name="first_name" defaultValue={firstName} required className={control} />
        </label>
        <label className="block w-1/2 text-xs text-[#607785]">
          Last name
          <input name="last_name" defaultValue={lastName} required className={control} />
        </label>
      </div>

      <label className="block text-xs text-[#607785]">
        Phone
        <input
          name="phone"
          type="tel"
          inputMode="tel"
          placeholder="08x-xxx-xxxx"
          required
          className={control}
        />
      </label>

      <label className="block text-xs text-[#607785]">
        Email
        <input
          name="email"
          type="email"
          inputMode="email"
          placeholder="you@example.com"
          required
          className={control}
        />
      </label>

      <LiffButton>Create my membership</LiffButton>
    </form>
  );
}
