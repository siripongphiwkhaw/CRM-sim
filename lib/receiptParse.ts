import type { ExtractedReceipt } from "./receiptOcr";

/**
 * Heuristic parser for raw OCR text from in-browser Tesseract (free path —
 * no API key). Turns receipt text (Thai/English) into the same ExtractedReceipt
 * shape the Claude-vision path produces, so matching and persistence are shared.
 */

/** Lines that are receipt plumbing, not purchased items. */
const NOISE_PATTERN =
  /\b(sub\s*total|subtotal|total|grand\s*total|vat|tax|cash|change|credit|debit|card|qr|balance|discount|tender|amount\s*due|item\s*count|thank|receipt|invoice|cashier|tel|phone|www\.)\b|รวม|ยอด|สุทธิ|ภาษี|เงินสด|เงินทอน|ทอน|ส่วนลด|บัตร|ขอบคุณ|โทร|พนักงาน|ใบเสร็จ|ใบกำกับ/i;

const TOTAL_PATTERN =
  /\b(grand\s*total|total|amount\s*due|net\s*total)\b|ยอดรวม|รวมทั้งสิ้น|รวมสุทธิ|สุทธิ|ยอดสุทธิ/i;

const REFERENCE_PATTERN = /\b(?:ORD|PO|SO|INV|TAX|RCP|DOC|BILL|REF)[-/#:.]?\d[\d-]*\b/gi;
// Non-global twin for .test() — a /g regex is stateful across .test() calls.
const REFERENCE_TEST = /\b(?:ORD|PO|SO|INV|TAX|RCP|DOC|BILL|REF)[-/#:.]?\d[\d-]*\b/i;

/** Trailing money/number tokens at the end of a line, e.g. "2 45.00 90.00". */
const TRAILING_NUMBERS = /((?:\s+@?\d[\d,]*(?:\.\d{1,2})?){1,3})\s*$/;

const QTY_X_PATTERN = /(\d{1,3})\s*[xX×]\s*@?(\d[\d,]*(?:\.\d{1,2})?)/;

function toNumber(token: string): number {
  return Number(token.replace(/[@,]/g, ""));
}

/** Buddhist Era years (>2400) → Gregorian. */
function normalizeYear(year: number): number {
  return year > 2400 ? year - 543 : year;
}

function parseDate(text: string): string | null {
  // dd/mm/yyyy or dd-mm-yyyy (Thai receipts) — day-first
  const dmy = text.match(/\b(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})\b/);
  if (dmy) {
    const year = normalizeYear(Number(dmy[3]));
    const month = Number(dmy[2]);
    const day = Number(dmy[1]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }
  const ymd = text.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/);
  if (ymd) {
    const year = normalizeYear(Number(ymd[1]));
    return `${year}-${ymd[2].padStart(2, "0")}-${ymd[3].padStart(2, "0")}`;
  }
  return null;
}

export function parseReceiptText(rawText: string): ExtractedReceipt {
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  // Store name: first line with letters that isn't a date/number/reference row.
  const storeLine = lines.find(
    (l) =>
      /\p{L}{3,}/u.test(l) &&
      !REFERENCE_TEST.test(l) &&
      !/\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4}/.test(l)
  );

  const referenceNumbers = Array.from(
    new Set(
      lines.flatMap((l) => l.match(REFERENCE_PATTERN) ?? []).map((r) => r.toUpperCase())
    )
  );

  const currency = /฿|บาท|\bTHB\b/i.test(rawText)
    ? "THB"
    : /\bUSD\b|\$/.test(rawText)
      ? "USD"
      : null;

  // Total: last line matching a total keyword that carries a number.
  let receiptTotal: number | null = null;
  for (const line of lines) {
    if (!TOTAL_PATTERN.test(line)) continue;
    const nums = line.match(/\d[\d,]*(?:\.\d{1,2})?/g);
    if (nums && nums.length > 0) receiptTotal = toNumber(nums[nums.length - 1]);
  }

  const lineItems: ExtractedReceipt["line_items"] = [];
  for (const line of lines) {
    if (NOISE_PATTERN.test(line)) continue;

    // "2 x 45.00" style
    const qtyX = line.match(QTY_X_PATTERN);
    const trailing = line.match(TRAILING_NUMBERS);
    if (!trailing) continue;

    const numbers = trailing[1].trim().split(/\s+/).map(toNumber);
    const name = line
      .slice(0, line.length - trailing[0].length)
      .replace(QTY_X_PATTERN, "")
      .replace(/[|:;#*]+$/g, "")
      .trim();
    if (!/\p{L}{2,}/u.test(name)) continue; // needs a real description

    let quantity: number | null = null;
    let unitPrice: number | null = null;
    let lineTotal: number | null = null;

    if (qtyX) {
      quantity = Number(qtyX[1]);
      unitPrice = toNumber(qtyX[2]);
      lineTotal = numbers[numbers.length - 1];
    } else if (numbers.length >= 3) {
      [quantity, unitPrice, lineTotal] = numbers.slice(-3);
      if (!Number.isInteger(quantity) || quantity <= 0 || quantity > 999) {
        // First number wasn't a qty after all — treat as unit/total only.
        quantity = null;
        [unitPrice, lineTotal] = numbers.slice(-2);
      }
    } else if (numbers.length === 2) {
      const [first, second] = numbers;
      if (Number.isInteger(first) && first > 0 && first < 100) {
        quantity = first;
        lineTotal = second;
        unitPrice = quantity > 0 ? Math.round((second / quantity) * 100) / 100 : null;
      } else {
        unitPrice = first;
        lineTotal = second;
      }
    } else {
      lineTotal = numbers[0];
    }

    lineItems.push({ name, quantity, unit_price: unitPrice, line_total: lineTotal });
  }

  return {
    store_name: storeLine ?? null,
    receipt_date: parseDate(rawText),
    currency,
    receipt_total: receiptTotal,
    reference_numbers: referenceNumbers,
    line_items: lineItems,
  };
}
