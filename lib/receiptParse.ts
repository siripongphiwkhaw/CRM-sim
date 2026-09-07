import type { ExtractedReceipt, ExtractedModifier, TaxInvoiceHeader, ReceiptTotals } from "./receiptOcr";

/**
 * Heuristic parser for raw OCR text from in-browser Tesseract (free path —
 * no API key). Turns receipt text (Thai/English) into the same ExtractedReceipt
 * shape the Azure OpenAI vision path produces, so matching and persistence are shared.
 */

/** Lines that are receipt plumbing, not purchased items. Shared by the
 * single-line item loop and the multi-line item-block terminator below, so
 * both agree on what counts as "not an item". */
const NOISE_PATTERN =
  /\b(sub\s*-?\s*total|subtotal|total|grand\s*total|vat|tax(?:able)?|cash|change|credit|debit|card|qr|balance|discount|promotion\s*disc\w*|tender|amount\s*due|item\s*count|thank|receipt|invoice|cashier|tel|phone|www\.|qty|processing\s*fee|(?:bill\s*)?rounding|grab\s*food|payment|reference|role\s*[.:]?\s*cashier|table\s*pax|remark)\b|รวม|ยอด|สุทธิ|ภาษี|เงินสด|เงินทอน|ทอน|ส่วนลด|บัตร|ขอบคุณ|โทร|พนักงาน|ใบเสร็จ|ใบกำกับ/i;

const TOTAL_PATTERN =
  /\b(grand\s*total|total|amount\s*due|net\s*total)\b|ยอดรวม|รวมทั้งสิ้น|รวมสุทธิ|สุทธิ|ยอดสุทธิ/i;

const REFERENCE_PATTERN = /\b(?:ORD|PO|SO|INV|TAX|RCP|DOC|BILL|REF)[-/#:.]?\d[\d-]*\b/gi;
// Non-global twin for .test() — a /g regex is stateful across .test() calls.
const REFERENCE_TEST = /\b(?:ORD|PO|SO|INV|TAX|RCP|DOC|BILL|REF)[-/#:.]?\d[\d-]*\b/i;

/** Trailing money/number tokens at the end of a line, e.g. "2 45.00 90.00". */
const TRAILING_NUMBERS = /((?:\s+@?\d[\d,]*(?:\.\d{1,2})?){1,3})\s*$/;

const QTY_X_PATTERN = /(\d{1,3})\s*[xX×]\s*@?(\d[\d,]*(?:\.\d{1,2})?)/;

function toNumber(token: string): number {
  return Number(token.replace(/[@,\s]/g, ""));
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

/* ---------- Multi-line "qty  name (unit/ea)  total" item blocks ---------- */
//
// A Thai POS layout (ZUS Coffee and similar) prints each item as:
//   1  Iced CEO Latte (Takeaway) (80.00/ea)         110.00
//     • TA
//     • Oat Milk + 20.00
//     • +Vanilla Syrup + 10.00
// The name+unit-price column is wide enough to wrap ("(80.00/" / "ea)" on
// separate OCR lines), and each modifier is its own bulleted line below. This
// is handled as a standalone pre-pass — a self-contained block of lines is
// consumed per item, including its wrap continuation and its modifier lines —
// so the plain per-line loop further down never sees "• Oat Milk + 20.00" and
// can't misread it as a bogus item (a real bug in the single-line-only
// approach: a bullet modifier line has a name and a trailing number, which is
// indistinguishable from a legitimate item to that loop).

const ITEM_BLOCK_START = /^(\d{1,3})\s+(?=\p{L})/u;
// The unit price sits inside "(80.00/ea)", but the line total can end up in
// three different places once wrapped OCR lines are rejoined: BEFORE the
// bracket ("...Takeaway)      80.00 (80.00/ea)" — the bracket landed on its
// own wrap line with nothing else on it), SANDWICHED between "/" and "ea)"
// ("(80.00/        110.00 ea)" — the price column lines up with the row the
// "(80.00/" half is on, and "ea)" wraps to the next line alone), or trailing
// right after ")" (uncommon, kept for safety). Group 2 covers the sandwiched
// case, group 3 the trailing case; neither matching means it was before the
// bracket, handled by the remainder scan below.
const UNIT_EA_BLOCK =
  /\(\s*(\d[\d,]*(?:\.\d{1,2})?)\s*\/\s*(\d[\d,]*(?:\.\d{1,2})?)?\s*ea\s*\)\s*(\d[\d,]*(?:\.\d{1,2})?)?/i;
const MODIFIER_LINE = /^[•·+\-]\s*(.+)$/;
const MODIFIER_TRAILING_AMOUNT = /([+\-]\s*\d[\d,]*(?:\.\d{1,2})?)\s*$/;

interface ItemBlockResult {
  item: ExtractedReceipt["line_items"][number];
  /** Number of lines consumed starting at the block's start index. */
  consumed: number;
}

function parseModifierLine(line: string): ExtractedModifier {
  const bulletStripped = line.match(MODIFIER_LINE)?.[1] ?? line;
  // Some receipts print a second marker on the modifier itself (e.g.
  // "• +Vanilla Syrup + 10.00") — strip that inner one too.
  const body = bulletStripped.replace(/^[+\-]\s*/, "");
  const amountMatch = body.match(MODIFIER_TRAILING_AMOUNT);
  if (!amountMatch) return { name: body.trim(), amount: null };
  const amount = toNumber(amountMatch[1].replace(/[+\-]/, ""));
  const name = body.slice(0, body.length - amountMatch[0].length).trim();
  return { name: name || body.trim(), amount };
}

function tryParseItemBlock(lines: string[], startIdx: number): ItemBlockResult | null {
  const startLine = lines[startIdx];
  const qtyMatch = startLine.match(ITEM_BLOCK_START);
  if (!qtyMatch) return null;

  let i = startIdx + 1;
  const modifierLines: string[] = [];
  let continuation = "";
  while (i < lines.length) {
    const line = lines[i];
    if (ITEM_BLOCK_START.test(line)) break; // next item's block starts here
    if (NOISE_PATTERN.test(line) || TOTAL_PATTERN.test(line)) break;
    if (MODIFIER_LINE.test(line)) {
      modifierLines.push(line);
      i++;
      continue;
    }
    // A short wrap continuation (e.g. "ea)") — only before any modifier,
    // since modifiers always follow the complete item line.
    if (modifierLines.length === 0 && line.length <= 20) {
      continuation += ` ${line}`;
      i++;
      continue;
    }
    break;
  }

  const fullFirstLine = `${startLine}${continuation}`.replace(/\s+/g, " ").trim();
  const unitMatch = fullFirstLine.match(UNIT_EA_BLOCK);
  if (!unitMatch) return null; // not this layout — let the per-line loop try instead

  const unitPrice = toNumber(unitMatch[1]);
  const sandwiched = unitMatch[2] ? toNumber(unitMatch[2]) : null;
  const trailingAfterBracket = unitMatch[3] ? toNumber(unitMatch[3]) : null;
  const withoutBracket = (
    fullFirstLine.slice(0, unitMatch.index) + fullFirstLine.slice((unitMatch.index ?? 0) + unitMatch[0].length)
  ).trim();
  const withoutQty = withoutBracket.replace(ITEM_BLOCK_START, "");

  let lineTotal: number | null;
  let name: string;
  if (sandwiched != null) {
    lineTotal = sandwiched;
    name = withoutQty.replace(/[|:;#*]+$/g, "").trim();
  } else if (trailingAfterBracket != null) {
    lineTotal = trailingAfterBracket;
    name = withoutQty.replace(/[|:;#*]+$/g, "").trim();
  } else {
    // Price was before the bracket entirely (the bracket wrapped alone) — the
    // trailing number of whatever's left is the line total.
    const trailingNums = withoutQty.match(/\d[\d,]*(?:\.\d{1,2})?/g);
    lineTotal = trailingNums && trailingNums.length > 0 ? toNumber(trailingNums[trailingNums.length - 1]) : null;
    name = withoutQty
      .replace(/\d[\d,]*(?:\.\d{1,2})?\s*$/, "")
      .replace(/[|:;#*]+$/g, "")
      .trim();
  }
  if (!/\p{L}{2,}/u.test(name)) return null; // needs a real description

  return {
    item: {
      name,
      quantity: Number(qtyMatch[1]),
      unit_price: unitPrice,
      line_total: lineTotal,
      modifiers: modifierLines.map(parseModifierLine),
    },
    consumed: i - startIdx,
  };
}

/* ---------- Tax-invoice header + totals block ---------- */

const HEADER_FIELD_PATTERNS: Record<keyof TaxInvoiceHeader, RegExp | null> = {
  invoice_no: /invoice\s*no\.?\s*[:.]?\s*(\S+)/i,
  tax_id: /tax\s*id\s*[:.]?\s*([\d-]+)/i,
  pos_id: /pos\s*id\s*[:.]?\s*(\S+)/i,
  // Separator between the "ORDER" label and its value must be whitespace/
  // punctuation only — \D would also match letters and could eat into an
  // alphanumeric order code (e.g. swallow "GF" out of "GF003").
  order_no: /\border\b[\s:.]{0,3}([A-Z0-9]{2,10})\b/i,
  branch: null, // not reliably distinguishable from the store-name line
  seller: null, // same
};

function extractHeader(lines: string[]): { documentType: string | null; taxInvoice: TaxInvoiceHeader } {
  const taxInvoice: TaxInvoiceHeader = {
    invoice_no: null,
    tax_id: null,
    pos_id: null,
    order_no: null,
    branch: null,
    seller: null,
  };
  let documentType: string | null = null;

  for (let i = 0; i < lines.length; i++) {
    const window = `${lines[i]} ${lines[i + 1] ?? ""}`;
    for (const [field, pattern] of Object.entries(HEADER_FIELD_PATTERNS) as [
      keyof TaxInvoiceHeader,
      RegExp | null,
    ][]) {
      if (!pattern || taxInvoice[field]) continue;
      const match = lines[i].match(pattern) ?? window.match(pattern);
      if (match) taxInvoice[field] = match[1].toUpperCase();
    }
    if (!documentType && /\b(tax\s*invoice|receipt)\b/i.test(lines[i]) && !NOISE_PATTERN.test(lines[i])) {
      documentType = lines[i];
    }
  }
  return { documentType, taxInvoice };
}

/**
 * keyword → last number on the line (or a 2-line window, for wrapped labels).
 * `sameLineOnly` skips the window fallback — needed for fields that can also
 * appear as a table *header* with values in a different column on the next
 * row (e.g. a "Taxable | Amount" summary table), where grabbing "the last
 * number in the next line" would silently pick up the wrong column.
 */
function findAmount(lines: string[], pattern: RegExp, sameLineOnly = false): number | null {
  for (let i = 0; i < lines.length; i++) {
    if (!pattern.test(lines[i])) continue;
    const window = sameLineOnly ? lines[i] : `${lines[i]} ${lines[i + 1] ?? ""}`;
    const nums = lines[i].match(/\d[\d,]*(?:\.\d{1,2})?/g) ?? window.match(/\d[\d,]*(?:\.\d{1,2})?/g);
    if (nums && nums.length > 0) return toNumber(nums[nums.length - 1]);
  }
  return null;
}

const PAYMENT_METHOD_PATTERN = /\b(grab\s*food|grabfood|cash|visa|mastercard|promptpay|truemoney|line\s*pay|qr)\b/i;
const PAYMENT_REF_PATTERN = /payment\s*ref(?:erence)?/i;
const REF_VALUE_PATTERN = /\b[A-Z0-9]{6,}(?:-[A-Z0-9]{3,})*\b/;

function extractTotals(lines: string[], receiptTotal: number | null): ReceiptTotals {
  const vatLine = lines.find((l) => /\bvat\b/i.test(l));
  const vatRateMatch = vatLine?.match(/(\d{1,2}(?:\.\d+)?)\s*%/);

  let paymentMethod: string | null = null;
  let paidAmount: number | null = null;
  for (const line of lines) {
    const m = line.match(PAYMENT_METHOD_PATTERN);
    if (!m) continue;
    const nums = line.match(/\d[\d,]*(?:\.\d{1,2})?/g);
    paymentMethod = m[1].toUpperCase();
    paidAmount = nums && nums.length > 0 ? toNumber(nums[nums.length - 1]) : null;
    break;
  }

  // "Payment" and "Reference" (or the value itself) can each land on their
  // own OCR line — the label alone doesn't have to contain both words.
  let paymentReference: string | null = null;
  for (let i = 0; i < lines.length; i++) {
    const window = `${lines[i]} ${lines[i + 1] ?? ""} ${lines[i + 2] ?? ""}`;
    if (!PAYMENT_REF_PATTERN.test(window)) continue;
    const ref = window.match(REF_VALUE_PATTERN);
    if (ref) paymentReference = ref[0];
    break;
  }

  return {
    subtotal: findAmount(lines, /\bsub\s*-?\s*total\b/i),
    discount: findAmount(lines, /\b(promotion\s*disc\w*|discount)\b/i),
    vat_amount: findAmount(lines, /\bvat\b/i),
    vat_rate: vatRateMatch ? Number(vatRateMatch[1]) : null,
    vat_inclusive: vatLine ? /inclu/i.test(vatLine) : null,
    taxable: findAmount(lines, /\btaxable\b/i, true),
    service_charge: findAmount(lines, /\bservice\s*charge\b/i),
    rounding: findAmount(lines, /\b(?:bill\s*)?rounding\b/i),
    total: receiptTotal,
    payment_method: paymentMethod,
    paid_amount: paidAmount,
    change: findAmount(lines, /\bchange\b/i),
    payment_reference: paymentReference,
  };
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

  // Grand total: last line matching a total keyword that carries a number.
  // \btotal\b never matches inside "Subtotal" (no word boundary between
  // "sub" and "total"), so this and the subtotal extraction below agree.
  let receiptTotal: number | null = null;
  for (const line of lines) {
    if (!TOTAL_PATTERN.test(line)) continue;
    const nums = line.match(/\d[\d,]*(?:\.\d{1,2})?/g);
    if (nums && nums.length > 0) receiptTotal = toNumber(nums[nums.length - 1]);
  }

  const { documentType, taxInvoice } = extractHeader(lines);
  const totals = extractTotals(lines, receiptTotal);

  // Item detection is bounded to start after the items-table header row
  // ("Qty ... Item ... Price"), when one is printed — otherwise store/header
  // lines that happen to end in a number (a postal code, a POS ID) can be
  // misread as a line item. Header/totals extraction above is unbounded, since
  // those live outside the table on either side of it.
  const tableHeaderIdx = lines.findIndex((l) => /\bqty\b/i.test(l) && /\bitem\b/i.test(l));
  const itemScanStart = tableHeaderIdx >= 0 ? tableHeaderIdx + 1 : 0;

  // Pass 1: multi-line "qty name (unit/ea) total" blocks (+ their modifiers).
  const lineItems: ExtractedReceipt["line_items"] = [];
  const consumedIdx = new Set<number>();
  for (let i = itemScanStart; i < lines.length; i++) {
    if (consumedIdx.has(i)) continue;
    const block = tryParseItemBlock(lines, i);
    if (!block) continue;
    lineItems.push(block.item);
    for (let j = i; j < i + block.consumed; j++) consumedIdx.add(j);
  }

  // Pass 2: the original single-line heuristics, over whatever pass 1 didn't
  // claim — unrelated receipt formats (no wrapped "(unit/ea)" items) are
  // untouched by pass 1 and land here exactly as before.
  for (let i = itemScanStart; i < lines.length; i++) {
    if (consumedIdx.has(i)) continue;
    const line = lines[i];
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

    lineItems.push({ name, quantity, unit_price: unitPrice, line_total: lineTotal, modifiers: [] });
  }

  return {
    store_name: storeLine ?? null,
    receipt_date: parseDate(rawText),
    currency,
    receipt_total: receiptTotal,
    reference_numbers: referenceNumbers,
    line_items: lineItems,
    document_type: documentType,
    tax_invoice: taxInvoice,
    totals,
  };
}
