import type { ExtractedReceipt } from "@/lib/receiptOcr";
import { reconcileReceipt } from "@/lib/receiptReconcile";
import { formatCurrency } from "@/lib/format";
import { Card, SectionHeader, DetailRow } from "./ui";

/**
 * Full structured view of a scanned receipt/tax invoice — header, items with
 * modifiers, and the totals block. `raw_summary` on receipt_scans holds the
 * JSON-serialized ExtractedReceipt (see channel/audits/actions.ts); rows
 * scanned before this existed hold a plain joined-references string instead,
 * so the caller must fall back when parsing fails.
 */
export function ReceiptDetail({ receipt }: { receipt: ExtractedReceipt }) {
  const { tax_invoice: taxInvoice, totals } = receipt;
  const reconcile = reconcileReceipt(receipt);
  const hasHeader =
    receipt.document_type || (taxInvoice && Object.values(taxInvoice).some((v) => v != null));
  const hasTotals = totals && Object.values(totals).some((v) => v != null);

  return (
    <div className="space-y-4">
      {hasHeader && (
        <Card>
          <SectionHeader title="Tax invoice" />
          <dl>
            <DetailRow label="Document type" value={receipt.document_type} />
            <DetailRow label="Invoice no" value={taxInvoice?.invoice_no} />
            <DetailRow label="Tax ID" value={taxInvoice?.tax_id} />
            <DetailRow label="POS ID" value={taxInvoice?.pos_id} />
            <DetailRow label="Order no" value={taxInvoice?.order_no} />
            <DetailRow label="Branch" value={taxInvoice?.branch} />
            <DetailRow label="Seller" value={taxInvoice?.seller} />
          </dl>
        </Card>
      )}

      {receipt.line_items.length > 0 && (
        <Card>
          <SectionHeader title="Items" count={receipt.line_items.length} />
          <ul className="divide-y divide-[#eef3f5]">
            {receipt.line_items.map((item, idx) => (
              <li key={idx} className="py-2">
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="text-[#14202b]">
                    {item.quantity != null ? `${item.quantity} × ` : ""}
                    {item.name}
                    {item.unit_price != null && (
                      <span className="text-[#607785]"> ({formatCurrency(item.unit_price)}/ea)</span>
                    )}
                  </span>
                  <span className="shrink-0 font-medium text-[#14202b]">
                    {item.line_total != null ? formatCurrency(item.line_total) : "—"}
                  </span>
                </div>
                {item.modifiers.length > 0 && (
                  <ul className="mt-1 space-y-0.5 pl-4 text-xs text-[#607785]">
                    {item.modifiers.map((m, mi) => (
                      <li key={mi} className="flex items-baseline justify-between gap-3">
                        <span>· {m.name}</span>
                        {m.amount != null && <span>+{formatCurrency(m.amount)}</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {hasTotals && (
        <Card>
          <SectionHeader title="Totals" />
          <dl>
            <DetailRow label="Subtotal" value={totals?.subtotal != null ? formatCurrency(totals.subtotal) : null} />
            <DetailRow
              label="Discount"
              value={totals?.discount != null ? `−${formatCurrency(totals.discount)}` : null}
            />
            <DetailRow
              label={totals?.vat_rate != null ? `VAT (${totals.vat_rate}%${totals.vat_inclusive ? " incl." : ""})` : "VAT"}
              value={totals?.vat_amount != null ? formatCurrency(totals.vat_amount) : null}
            />
            <DetailRow label="Taxable" value={totals?.taxable != null ? formatCurrency(totals.taxable) : null} />
            <DetailRow
              label="Service charge"
              value={totals?.service_charge != null ? formatCurrency(totals.service_charge) : null}
            />
            <DetailRow label="Rounding" value={totals?.rounding != null ? formatCurrency(totals.rounding) : null} />
            <DetailRow
              label="Total"
              value={
                totals?.total != null ? (
                  <span className="font-semibold">{formatCurrency(totals.total)}</span>
                ) : null
              }
            />
            <DetailRow label="Payment method" value={totals?.payment_method} />
            <DetailRow
              label="Paid"
              value={totals?.paid_amount != null ? formatCurrency(totals.paid_amount) : null}
            />
            <DetailRow label="Change" value={totals?.change != null ? formatCurrency(totals.change) : null} />
            <DetailRow label="Payment reference" value={totals?.payment_reference} />
          </dl>
        </Card>
      )}

      {!reconcile.ok && (
        <div className="rounded-card border border-[#f0d7a8] bg-[#fff5ec] p-3">
          <p className="text-xs font-semibold text-[#8a4b1e]">
            The numbers on this scan don&apos;t quite add up — worth a second look:
          </p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-[#8a4b1e]">
            {reconcile.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** Parses raw_summary back into an ExtractedReceipt. Returns null for
 * pre-existing rows that hold the old plain-text reference string instead of
 * JSON — callers fall back to rendering `raw_summary` as-is in that case. */
export function tryParseReceiptSummary(rawSummary: string | null): ExtractedReceipt | null {
  if (!rawSummary) return null;
  try {
    const parsed = JSON.parse(rawSummary);
    if (parsed && typeof parsed === "object" && Array.isArray(parsed.line_items)) {
      return parsed as ExtractedReceipt;
    }
    return null;
  } catch {
    return null;
  }
}
