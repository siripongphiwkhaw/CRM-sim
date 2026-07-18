import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

/**
 * Claude-vision receipt extraction. Reads Thai, English and mixed receipts /
 * billing documents and returns a structured line-item breakdown. Only the
 * structured result leaves this module — images are never persisted.
 */

const OCR_MODEL = "claude-opus-4-8";

export type ReceiptImageMediaType =
  | "image/jpeg"
  | "image/png"
  | "image/webp"
  | "image/gif";

const extractedLineSchema = z.object({
  name: z.string(),
  quantity: z.number().nullable(),
  unit_price: z.number().nullable(),
  line_total: z.number().nullable(),
});

const extractedReceiptSchema = z.object({
  store_name: z.string().nullable(),
  receipt_date: z.string().nullable(),
  currency: z.string().nullable(),
  receipt_total: z.number().nullable(),
  reference_numbers: z.array(z.string()),
  line_items: z.array(extractedLineSchema),
});

export type ExtractedReceipt = z.infer<typeof extractedReceiptSchema>;
export type ExtractedLine = z.infer<typeof extractedLineSchema>;

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
        required: ["name", "quantity", "unit_price", "line_total"],
        properties: {
          name: { type: "string", description: "Item description exactly as printed" },
          quantity: { type: ["number", "null"] },
          unit_price: { type: ["number", "null"] },
          line_total: { type: ["number", "null"] },
        },
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
- line_items: one entry per purchased item with quantity, unit price, and line total when printed. Convert Thai numerals to Arabic. Exclude subtotal, discount, VAT, and total rows — items only.

Use null for anything not printed on the document.`;

export class OcrError extends Error {}

export function isOcrConfigured(): boolean {
  return Boolean(
    process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN
  );
}

export async function extractReceipt(
  imageBase64: string,
  mediaType: ReceiptImageMediaType
): Promise<ExtractedReceipt> {
  if (!isOcrConfigured()) {
    throw new OcrError(
      "AI OCR is not configured. Set ANTHROPIC_API_KEY in .env.local (and in your Vercel project settings for the deployed app)."
    );
  }

  let client: Anthropic;
  try {
    client = new Anthropic();
  } catch {
    throw new OcrError(
      "AI OCR is not configured. Set ANTHROPIC_API_KEY in .env.local (and in your Vercel project settings for the deployed app)."
    );
  }

  let response: Anthropic.Message;
  try {
    response = await client.messages.create({
      model: OCR_MODEL,
      max_tokens: 8000,
      thinking: { type: "adaptive" },
      output_config: {
        format: {
          type: "json_schema",
          schema: RECEIPT_JSON_SCHEMA as unknown as Record<string, unknown>,
        },
      },
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mediaType, data: imageBase64 },
            },
            { type: "text", text: EXTRACTION_PROMPT },
          ],
        },
      ],
    });
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      throw new OcrError(
        "AI OCR is not configured. Set ANTHROPIC_API_KEY in .env.local (and in your Vercel project settings for the deployed app)."
      );
    }
    if (error instanceof Anthropic.RateLimitError) {
      throw new OcrError("The OCR service is rate-limited right now — try again in a minute.");
    }
    if (error instanceof Anthropic.APIConnectionError) {
      throw new OcrError("Could not reach the OCR service. Check the server's network connection.");
    }
    if (error instanceof Anthropic.APIError) {
      throw new OcrError(`OCR request failed (${error.status ?? "unknown"}): ${error.message}`);
    }
    throw error;
  }

  if (response.stop_reason === "refusal") {
    throw new OcrError("The OCR service declined to process this image. Try a clearer photo of the receipt.");
  }
  if (response.stop_reason === "max_tokens") {
    throw new OcrError("The receipt is too long to process in one scan. Try a photo of just the item section.");
  }

  const textBlock = response.content.find(
    (b): b is Anthropic.TextBlock => b.type === "text"
  );
  if (!textBlock) {
    throw new OcrError("The OCR service returned no readable result. Try a clearer photo.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(textBlock.text);
  } catch {
    throw new OcrError("Could not parse the OCR result. Try scanning again.");
  }

  const result = extractedReceiptSchema.safeParse(parsed);
  if (!result.success) {
    throw new OcrError("The OCR result had an unexpected shape. Try scanning again.");
  }
  return result.data;
}
