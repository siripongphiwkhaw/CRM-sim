"use client";

import { useActionState } from "react";
import { TextInput, FormError, FormSuccess, SubmitButton } from "@/app/components/form";
import type { FormState } from "@/lib/validation";
import { setCustomerTaxIdAction, setInstitutionalOverrideAction } from "../actions";

/** Thai tax ID / national ID capture — Tier 1 (VERIFIED) evidence for the
 * classifier. See lib/thaiId.ts + lib/pii.ts. */
export function TaxIdForm({
  customerId,
  last4,
  entityType,
  verifiedAt,
  piiConfigured,
  identityConsentGranted,
}: {
  customerId: number;
  last4: string | null;
  entityType: "JURISTIC" | "NATURAL" | null;
  verifiedAt: string | null;
  piiConfigured: boolean;
  identityConsentGranted: boolean;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(setCustomerTaxIdAction, {});

  if (!piiConfigured) {
    return (
      <p className="text-xs text-[#607785]">
        Identity capture isn&apos;t configured on this server — <code className="font-mono">PII_ENCRYPTION_KEY</code> is
        unset. See <code className="font-mono">.env.example</code>.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {last4 ? (
        <p className="text-sm text-[#3c4f5e]">
          On file: <span className="font-mono">•••••••••{last4}</span> ·{" "}
          {entityType === "JURISTIC" ? "Registered company" : "Private individual"}
          {verifiedAt && <span className="text-xs text-[#607785]"> · verified {new Date(verifiedAt).toLocaleDateString()}</span>}
        </p>
      ) : (
        <p className="text-xs text-[#607785]">No identity number on file.</p>
      )}
      <form action={formAction} className="space-y-2">
        <input type="hidden" name="customer_id" value={customerId} />
        <FormError message={state.error} />
        <FormSuccess message={state.success} />
        <div className="flex items-center gap-2">
          <TextInput
            name="tax_id"
            placeholder="0-1055-68110-45-9"
            aria-label="Tax ID / national ID"
            className="font-mono text-xs"
          />
          <SubmitButton>{last4 ? "Replace" : "Save"}</SubmitButton>
        </div>
        <p className="text-xs text-[#607785]">
          {identityConsentGranted
            ? "A registered-company number needs no consent; a personal ID is covered by the identity verification consent already on file."
            : 'A personal ID (leading digit 1–8) needs "Identity verification" consent granted first — a company number (leading digit 0) does not.'}
        </p>
      </form>
    </div>
  );
}

/** Staff-only INSTITUTIONAL flag — never inferred from behaviour. */
export function InstitutionalOverrideForm({
  customerId,
  value,
}: {
  customerId: number;
  value: boolean;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(setInstitutionalOverrideAction, {});

  return (
    <form action={formAction} className="space-y-1">
      <input type="hidden" name="customer_id" value={customerId} />
      <input type="hidden" name="value" value={value ? "0" : "1"} />
      <FormError message={state.error} />
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm text-[#3c4f5e]">Institutional (school / hospital / canteen)</p>
          <p className="text-xs text-[#607785]">Never inferred — set this only when staff have confirmed it directly.</p>
        </div>
        <button
          type="submit"
          className={`rounded-[9px] px-3 py-1 text-xs font-medium active:scale-[0.98] ${
            value ? "bg-[#feded8] text-[#8e030f]" : "bg-[#eef3f5] text-[#3c4f5e] hover:bg-[#dde5e8]"
          }`}
        >
          {value ? "Clear" : "Mark institutional"}
        </button>
      </div>
    </form>
  );
}
