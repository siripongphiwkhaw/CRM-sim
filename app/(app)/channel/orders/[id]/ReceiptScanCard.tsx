"use client";

import { useActionState, useState } from "react";
import { FormError, FormSuccess, SubmitButton } from "@/app/components/form";
import { ReceiptFileInput } from "@/app/components/ReceiptFileInput";
import { scanOrderReceiptAction, type ScanState } from "../actions";

export function ReceiptScanCard({
  orderId,
  ocrConfigured,
}: {
  orderId: number;
  ocrConfigured: boolean;
}) {
  const [state, formAction] = useActionState<ScanState, FormData>(
    scanOrderReceiptAction,
    {}
  );
  const [busy, setBusy] = useState(false);

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="order_id" value={orderId} />
      <p className="text-xs text-[#706e6b]">
        Photograph the receipt, tax invoice, or delivery bill for this order —
        every line is checked against the PO/SO.{" "}
        {ocrConfigured
          ? "Read by AI vision (Thai or English)."
          : "Read free in your browser (Thai + English), no API key needed."}
      </p>
      <FormError message={state.error} />
      <FormSuccess message={state.success} />
      <ReceiptFileInput localOcr={!ocrConfigured} onBusyChange={setBusy} />
      <SubmitButton disabled={busy}>
        {busy ? "Reading receipt…" : "Scan & verify"}
      </SubmitButton>
    </form>
  );
}
