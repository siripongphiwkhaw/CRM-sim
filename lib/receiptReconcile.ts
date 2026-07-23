import type { ExtractedReceipt } from "./receiptOcr";

/**
 * Pure arithmetic sanity checks over an already-extracted receipt. This is
 * what catches a bad OCR read (a missed digit, a misassigned modifier) rather
 * than silently trusting whatever came back — every check is independent, so
 * one failing doesn't hide the others.
 */

export interface ReconcileResult {
  ok: boolean;
  warnings: string[];
}

const TOLERANCE = 0.02; // ± rounding

function near(a: number, b: number, tolerance = TOLERANCE): boolean {
  return Math.abs(a - b) <= tolerance;
}

export function reconcileReceipt(receipt: ExtractedReceipt): ReconcileResult {
  const warnings: string[] = [];
  const totals = receipt.totals;

  // Per-line: unit_price × qty + Σ modifiers ≈ line_total.
  for (const item of receipt.line_items) {
    if (item.unit_price == null || item.quantity == null || item.line_total == null) continue;
    const modifierSum = item.modifiers.reduce((sum, m) => sum + (m.amount ?? 0), 0);
    const expected = item.unit_price * item.quantity + modifierSum;
    if (!near(expected, item.line_total)) {
      warnings.push(
        `"${item.name}": unit ${item.unit_price} × ${item.quantity} + modifiers ${modifierSum} = ${expected}, but line total is ${item.line_total}`
      );
    }
  }

  // Σ line_total vs subtotal.
  const linesWithTotal = receipt.line_items.filter((i) => i.line_total != null);
  if (totals?.subtotal != null && linesWithTotal.length === receipt.line_items.length && linesWithTotal.length > 0) {
    const sum = linesWithTotal.reduce((s, i) => s + (i.line_total ?? 0), 0);
    if (!near(sum, totals.subtotal)) {
      warnings.push(`Line items sum to ${sum}, but subtotal reads ${totals.subtotal}`);
    }
  }

  // subtotal − discount (+ fees ± rounding) vs total.
  if (totals?.subtotal != null && totals.total != null) {
    const expected =
      totals.subtotal -
      (totals.discount ?? 0) +
      (totals.vat_inclusive ? 0 : (totals.vat_amount ?? 0)) +
      (totals.service_charge ?? 0) +
      (totals.rounding ?? 0);
    if (!near(expected, totals.total)) {
      warnings.push(`Subtotal minus discount (plus fees/rounding) is ${expected}, but total reads ${totals.total}`);
    }
  }

  // VAT-inclusive math: total / (1 + rate) ≈ taxable, remainder ≈ vat_amount.
  if (totals?.vat_inclusive && totals.total != null && totals.vat_rate != null) {
    const impliedTaxable = Math.round((totals.total / (1 + totals.vat_rate / 100)) * 100) / 100;
    const impliedVat = Math.round((totals.total - impliedTaxable) * 100) / 100;
    if (totals.taxable != null && !near(impliedTaxable, totals.taxable)) {
      warnings.push(`Implied taxable amount is ${impliedTaxable}, but the receipt reads ${totals.taxable}`);
    }
    if (totals.vat_amount != null && !near(impliedVat, totals.vat_amount)) {
      warnings.push(`Implied VAT is ${impliedVat}, but the receipt reads ${totals.vat_amount}`);
    }
  }

  return { ok: warnings.length === 0, warnings };
}
