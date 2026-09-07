"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/session";
import { extractReceipt, OcrError, type ExtractedReceipt } from "@/lib/receiptOcr";
import { parseReceiptText } from "@/lib/receiptParse";
import { readReceiptImage } from "@/lib/receiptImage";
import { matchAgainstCatalog } from "@/lib/receiptMatch";
import { listProducts } from "@/db/queries/products";
import { createReceiptScan } from "@/db/queries/receiptScans";
import { TRADE_CHANNELS } from "@/lib/constants";
import { nullifyEmpty } from "@/lib/validation";

export interface AuditScanState {
  error?: string;
}

/**
 * OCR any store receipt and log where own products are being sold —
 * the store/modern-trade item-tracking surface.
 */
export async function scanRetailReceiptAction(
  _prev: AuditScanState,
  formData: FormData
): Promise<AuditScanState> {
  const session = await requireSession();

  const channelRaw = String(formData.get("channel") ?? "");
  const channel = (TRADE_CHANNELS as readonly string[]).includes(channelRaw)
    ? channelRaw
    : null;
  const storeOverride = nullifyEmpty(String(formData.get("store_name") ?? ""));

  // Free path: browser Tesseract text → server-side parse. AI path (Azure
  // OpenAI configured): the photo is uploaded and read by Azure OpenAI vision.
  const ocrText = String(formData.get("ocr_text") ?? "").trim();
  let extracted: ExtractedReceipt;
  if (ocrText) {
    extracted = parseReceiptText(ocrText);
    if (extracted.line_items.length === 0) {
      return {
        error:
          "No line items could be read from this photo. Try a sharper, straight-on photo with the item section clearly visible.",
      };
    }
  } else {
    const image = await readReceiptImage(formData.get("receipt_image"));
    if ("error" in image) return { error: image.error };
    try {
      extracted = await extractReceipt(image.data, image.mediaType);
    } catch (error) {
      if (error instanceof OcrError) return { error: error.message };
      throw error;
    }
  }

  const products = await listProducts();
  const result = matchAgainstCatalog(
    extracted,
    products.map((p) => ({
      productId: p.id,
      name: p.name,
      sku: p.sku,
      unitPrice: p.unit_price,
    }))
  );

  const ownCount = result.lines.filter((l) => l.matchStatus === "matched").length;
  const scanId = await createReceiptScan({
    scan_type: "retail_audit",
    store_name: storeOverride ?? extracted.store_name,
    channel,
    receipt_date: extracted.receipt_date,
    receipt_total: extracted.receipt_total,
    currency: extracted.currency,
    // Full structured extract (header, totals, per-line modifiers) — no
    // schema change needed, this column was already free TEXT. A reader
    // JSON.parses it; older rows still hold the plain joined-references
    // string this used to be, and fall back to rendering that as-is.
    raw_summary: JSON.stringify(extracted),
    match_status: result.status,
    note:
      ownCount > 0
        ? `${ownCount} of ${result.lines.length} receipt lines are own products.`
        : "No own products found on this receipt.",
    created_by: session.userId!,
    lines: result.lines,
  });

  revalidatePath("/channel/audits");
  revalidatePath("/channel");
  redirect(`/channel/audits/${scanId}`);
}
