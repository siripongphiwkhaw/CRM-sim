import { z } from "zod";

/**
 * Azure OpenAI vision receipt extraction. Reads Thai, English and mixed
 * receipts / billing documents and returns a structured line-item breakdown.
 * Only the structured result leaves this module — images are never persisted.
 *
 * Runs against an AJT-owned Azure OpenAI resource rather than a third-party
 * API, so the image never leaves the Azure tenant/region and no
 * externally-issued API key is held by the app. See lib/receiptImage.ts for
 * the upload path and the zoning review for why this replaced the prior
 * Anthropic-API-backed path.
 */

const API_VERSION = "2024-10-21";

export type ReceiptImageMediaType =
  | "image/jpeg"
  | "image/png"
  | "image/webp"
  | "image/gif";

/** A per-item option/add-on printed under its parent line (e.g. "Oat Milk
 * +20.00"). Its amount is already included in the parent's line_total. */
const extractedModifierSchema = z.object({
  name: z.string(),
  amount: z.number().nullable(),
});

const extractedLineSchema = z.object({
  name: z.string(),
  quantity: z.number().nullable(),
  unit_price: z.number().nullable(),
  line_total: z.number().nullable(),
  modifiers: z.array(extractedModifierSchema).default([]),
});

/** Tax-invoice header identifiers, printed above the item table. */
const taxInvoiceSchema = z.object({
  invoice_no: z.string().nullable(),
  tax_id: z.string().nullable(),
  pos_id: z.string().nullable(),
  order_no: z.string().nullable(),
  branch: z.string().nullable(),
  seller: z.string().nullable(),
});

/** The settlement block below the items. */
const receiptTotalsSchema = z.object({
  subtotal: z.number().nullable(),
  /** Positive magnitude of any discount, however it was printed. */
  discount: z.number().nullable(),
  vat_amount: z.number().nullable(),
  /** Percentage, e.g. 7 for "VAT 7%". */
  vat_rate: z.number().nullable(),
  /** True when VAT is included in the total rather than added on top. */
  vat_inclusive: z.boolean().nullable(),
  taxable: z.number().nullable(),
  service_charge: z.number().nullable(),
  rounding: z.number().nullable(),
  total: z.number().nullable(),
  payment_method: z.string().nullable(),
  paid_amount: z.number().nullable(),
  change: z.number().nullable(),
  payment_reference: z.string().nullable(),
});

const extractedReceiptSchema = z.object({
  store_name: z.string().nullable(),
  receipt_date: z.string().nullable(),
  currency: z.string().nullable(),
  receipt_total: z.number().nullable(),
  reference_numbers: z.array(z.string()),
  line_items: z.array(extractedLineSchema),
  document_type: z.string().nullable().default(null),
  tax_invoice: taxInvoiceSchema.nullable().default(null),
  totals: receiptTotalsSchema.nullable().default(null),
});

export type ExtractedReceipt = z.infer<typeof extractedReceiptSchema>;
export type ExtractedLine = z.infer<typeof extractedLineSchema>;
export type ExtractedModifier = z.infer<typeof extractedModifierSchema>;
export type TaxInvoiceHeader = z.infer<typeof taxInvoiceSchema>;
export type ReceiptTotals = z.infer<typeof receiptTotalsSchema>;

/** JSON schema mirror of extractedReceiptSchema for the structured-output format. */
const RECEIPT_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "store_name",
    "receipt_date",
    "currency",
    "receipt_total",
    "reference_numbers",
    "line_items",
    "document_type",
    "tax_invoice",
    "totals",
  ],
  properties: {
    store_name: { type: ["string", "null"], description: "Store / vendor name printed on the receipt" },
    receipt_date: { type: ["string", "null"], description: "Receipt date as YYYY-MM-DD (Gregorian)" },
    currency: { type: ["string", "null"], description: "ISO currency code, e.g. THB" },
    receipt_total: { type: ["number", "null"], description: "Grand total amount" },
    reference_numbers: {
      type: "array",
      items: { type: "string" },
      description: "Order / PO / invoice / tax-invoice numbers printed on the document",
    },
    line_items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "quantity", "unit_price", "line_total", "modifiers"],
        properties: {
          name: { type: "string", description: "Item description exactly as printed, without its modifiers" },
          quantity: { type: ["number", "null"] },
          unit_price: { type: ["number", "null"], description: "Base unit price, e.g. from '(80.00/ea)'" },
          line_total: { type: ["number", "null"], description: "Full line amount including modifiers" },
          modifiers: {
            type: "array",
            description: "Options/add-ons printed under this item (e.g. 'Oat Milk +20.00'), already included in line_total",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["name", "amount"],
              properties: {
                name: { type: "string" },
                amount: { type: ["number", "null"] },
              },
            },
          },
        },
      },
    },
    document_type: { type: ["string", "null"], description: "e.g. 'Tax Invoice (ABB) / Receipt'" },
    tax_invoice: {
      type: ["object", "null"],
      additionalProperties: false,
      required: ["invoice_no", "tax_id", "pos_id", "order_no", "branch", "seller"],
      properties: {
        invoice_no: { type: ["string", "null"] },
        tax_id: { type: ["string", "null"] },
        pos_id: { type: ["string", "null"] },
        order_no: { type: ["string", "null"], description: "Order/table number, e.g. 'GF003'" },
        branch: { type: ["string", "null"], description: "Branch / location name" },
        seller: { type: ["string", "null"], description: "Registered company name if different from store_name" },
      },
    },
    totals: {
      type: ["object", "null"],
      additionalProperties: false,
      required: [
        "subtotal", "discount", "vat_amount", "vat_rate", "vat_inclusive", "taxable",
        "service_charge", "rounding", "total", "payment_method", "paid_amount",
        "change", "payment_reference",
      ],
      properties: {
        subtotal: { type: ["number", "null"] },
        discount: { type: ["number", "null"], description: "Positive magnitude of any discount" },
        vat_amount: { type: ["number", "null"] },
        vat_rate: { type: ["number", "null"], description: "Percentage, e.g. 7 for VAT 7%" },
        vat_inclusive: { type: ["boolean", "null"], description: "True if VAT is included in the total, not added on top" },
        taxable: { type: ["number", "null"] },
        service_charge: { type: ["number", "null"] },
        rounding: { type: ["number", "null"] },
        total: { type: ["number", "null"] },
        payment_method: { type: ["string", "null"], description: "e.g. 'GRAB FOOD', 'Cash', 'Visa'" },
        paid_amount: { type: ["number", "null"] },
        change: { type: ["number", "null"] },
        payment_reference: { type: ["string", "null"] },
      },
    },
  },
} as const;

const EXTRACTION_PROMPT = `Read this receipt, tax invoice, or billing document. It may be in Thai, English, or a mix of both.

Extract:
- store_name: the store or vendor name as printed (keep Thai script as-is)
- receipt_date: convert to YYYY-MM-DD. Thai documents often use Buddhist Era years (พ.ศ.) — subtract 543 to get the Gregorian year (e.g. 2569 → 2026)
- currency: ISO code (Thai baht ฿ → "THB")
- receipt_total: the grand total
- reference_numbers: every order / PO / SO / invoice / receipt number printed (e.g. ORD-10023, INV-xxxx)
- document_type: the document title as printed, e.g. "Tax Invoice (ABB) / Receipt"
- tax_invoice: invoice_no, tax_id, pos_id, order_no (order/table number), branch, seller (registered company name)
- totals: subtotal, discount, vat_amount, vat_rate, vat_inclusive (true if VAT is included in the total), taxable,
  service_charge, rounding, total, payment_method, paid_amount, change, payment_reference
- line_items: one entry per purchased item, in the order printed. quantity is usually the leading column on the
  left. unit_price is often printed inline as "(80.00/ea)" — that is the BASE price before modifiers, not the
  line_total. line_total is the full line amount including any modifiers. Convert Thai numerals to Arabic.
  - modifiers: indented rows under an item (bullets, "•", "+", or "-" prefixed — e.g. "Oat Milk +20.00",
    "+Vanilla Syrup +10.00") are OPTIONS of the item above, not separate items. Their amounts are already part of
    that item's line_total. Record them as {name, amount}. A bare marker with no price (e.g. "• TA" for takeaway)
    still counts as a modifier with amount null — do not turn it into an item.
  - Never emit Subtotal / Qty summary / discount / VAT / service charge / rounding / total / payment rows as
    line_items — those belong in totals.

Use null for anything not printed on the document, and an empty array for reference_numbers / modifiers when none
are printed.

Respond with a single JSON object matching the given schema. No prose, no markdown fences.`;

export class OcrError extends Error {}

const CONFIG_ERROR =
  "AI OCR is not configured. Set AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY and AZURE_OPENAI_DEPLOYMENT " +
  "in .env.local (and in your deployed app's environment settings).";

function azureConfig() {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT?.trim().replace(/\/+$/, "");
  const apiKey = process.env.AZURE_OPENAI_API_KEY?.trim();
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT?.trim();
  if (!endpoint || !apiKey || !deployment) return null;
  return { endpoint, apiKey, deployment };
}

export function isOcrConfigured(): boolean {
  return azureConfig() !== null;
}

/** Shape of the Azure OpenAI chat completions response we actually read. */
interface AzureChatCompletion {
  choices?: Array<{
    message?: { content?: string | null };
    finish_reason?: string | null;
  }>;
}

export async function extractReceipt(
  imageBase64: string,
  mediaType: ReceiptImageMediaType
): Promise<ExtractedReceipt> {
  const config = azureConfig();
  if (!config) {
    throw new OcrError(CONFIG_ERROR);
  }
  const { endpoint, apiKey, deployment } = config;

  const url = `${endpoint}/openai/deployments/${encodeURIComponent(deployment)}/chat/completions?api-version=${API_VERSION}`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": apiKey,
      },
      body: JSON.stringify({
        max_tokens: 8000,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: EXTRACTION_PROMPT },
              {
                type: "image_url",
                image_url: { url: `data:${mediaType};base64,${imageBase64}` },
              },
            ],
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "receipt_extraction",
            strict: true,
            schema: RECEIPT_JSON_SCHEMA,
          },
        },
      }),
    });
  } catch {
    throw new OcrError("Could not reach the OCR service. Check the server's network connection.");
  }

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      throw new OcrError(CONFIG_ERROR);
    }
    if (res.status === 429) {
      throw new OcrError("The OCR service is rate-limited right now — try again in a minute.");
    }
    let detail = "";
    try {
      const body = (await res.json()) as { error?: { message?: string } };
      detail = body?.error?.message ?? "";
    } catch {
      /* body wasn't JSON — fall through with no extra detail */
    }
    throw new OcrError(`OCR request failed (${res.status})${detail ? `: ${detail}` : ""}`);
  }

  const completion = (await res.json()) as AzureChatCompletion;
  const choice = completion.choices?.[0];

  if (choice?.finish_reason === "content_filter") {
    throw new OcrError("The OCR service declined to process this image. Try a clearer photo of the receipt.");
  }
  if (choice?.finish_reason === "length") {
    throw new OcrError("The receipt is too long to process in one scan. Try a photo of just the item section.");
  }

  const text = choice?.message?.content;
  if (!text) {
    throw new OcrError("The OCR service returned no readable result. Try a clearer photo.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new OcrError("Could not parse the OCR result. Try scanning again.");
  }

  const result = extractedReceiptSchema.safeParse(parsed);
  if (!result.success) {
    throw new OcrError("The OCR result had an unexpected shape. Try scanning again.");
  }
  return result.data;
}
