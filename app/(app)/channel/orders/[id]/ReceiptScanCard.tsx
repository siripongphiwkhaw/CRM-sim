"use client";

import { useActionState } from "react";
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

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="order_id" value={orderId} />
      <p className="text-xs text-[#706e6b]">
        Photograph the receipt, tax invoice, or delivery bill for this order.
        The AI reads it (Thai or English) and checks every line against the PO/SO.
      </p>
      {!ocrConfigured && (
        <p className="rounded border border-[#fbcb8c] bg-[#fbf3e0] px-3 py-2 text-xs text-[#5f3e02]">
          AI OCR is not configured on this server — scans will fail until
          ANTHROPIC_API_KEY is set in .env.local (or Vercel project settings).
        </p>
      )}
      <FormError message={state.error} />
      <FormSuccess message={state.success} />
      <ReceiptFileInput />
      <SubmitButton>Scan &amp; verify</SubmitButton>
    </form>
  );
}
