"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Field, TextInput, Select, FormError, SubmitButton } from "@/app/components/form";
import { ReceiptFileInput } from "@/app/components/ReceiptFileInput";
import { TRADE_CHANNELS } from "@/lib/constants";
import { scanRetailReceiptAction, type AuditScanState } from "../actions";

export function AuditScanForm({ ocrConfigured }: { ocrConfigured: boolean }) {
  const [state, formAction] = useActionState<AuditScanState, FormData>(
    scanRetailReceiptAction,
    {}
  );
  const [busy, setBusy] = useState(false);

  return (
    <form action={formAction} className="max-w-xl space-y-4">
      <FormError message={state.error} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Trade channel" htmlFor="audit-channel">
          <Select id="audit-channel" name="channel" defaultValue={TRADE_CHANNELS[0]}>
            {TRADE_CHANNELS.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </Select>
        </Field>
        <Field
          label="Store name"
          htmlFor="audit-store"
          hint="Optional — leave blank to use the name read from the receipt"
        >
          <TextInput id="audit-store" name="store_name" placeholder="e.g. CityMart Sukhumvit" />
        </Field>
      </div>

      <Field label="Receipt photo" htmlFor="receipt_image" required>
        <ReceiptFileInput localOcr={!ocrConfigured} onBusyChange={setBusy} />
      </Field>

      <div className="flex items-center gap-3">
        <SubmitButton disabled={busy}>
          {busy ? "Reading receipt…" : "Scan receipt"}
        </SubmitButton>
        <Link href="/channel/audits" className="text-sm text-[#706e6b] hover:text-[#181818]">
          Cancel
        </Link>
      </div>
    </form>
  );
}
