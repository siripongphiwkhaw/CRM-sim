"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession, requireAdmin, requireApprover } from "@/lib/session";
import {
  orderCreateSchema,
  orderRejectSchema,
  firstError,
  type FormState,
} from "@/lib/validation";
import {
  createOrder,
  applyOrderTransition,
  getOrder,
  getOrderItems,
} from "@/db/queries/orders";
import { forceFulfillOrder } from "@/db/queries/deliveryPlans";
import { extractReceipt, OcrError, type ExtractedReceipt } from "@/lib/receiptOcr";
import { parseReceiptText } from "@/lib/receiptParse";
import { readReceiptImage } from "@/lib/receiptImage";
import { matchAgainstOrder } from "@/lib/receiptMatch";
import { createReceiptScan } from "@/db/queries/receiptScans";

export async function createOrderAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const session = await requireSession();

  let items: unknown;
  try {
    items = JSON.parse(String(formData.get("items_json") ?? "[]"));
  } catch {
    return { error: "Invalid line items." };
  }

  const parsed = orderCreateSchema.safeParse({
    distributor_id: formData.get("distributor_id"),
    requested_delivery_date: formData.get("requested_delivery_date") ?? "",
    items,
  });
  if (!parsed.success) return { error: firstError(parsed.error) };

  const orderNumber = await createOrder({
    distributorId: parsed.data.distributor_id,
    requestedDeliveryDate: parsed.data.requested_delivery_date || null,
    items: parsed.data.items.map((i) => ({ productId: i.product_id, quantity: i.quantity })),
    createdBy: session.userId!,
  });

  revalidatePath("/channel/orders");
  redirect(`/channel/orders?created=${orderNumber}`);
}

export async function submitOrderAction(orderId: number) {
  const session = await requireSession();
  await applyOrderTransition(orderId, "submitted", session.userId!);
  revalidatePath("/channel/orders");
  revalidatePath(`/channel/orders/${orderId}`);
}

export async function approveOrderAction(orderId: number, note?: string) {
  const session = await requireApprover();
  await applyOrderTransition(orderId, "approved", session.userId!, note || null);
  revalidatePath("/channel/orders");
  revalidatePath(`/channel/orders/${orderId}`);
}

export async function rejectOrderAction(orderId: number, note: string) {
  const session = await requireApprover();
  const parsed = orderRejectSchema.safeParse({ note });
  if (!parsed.success) return;
  await applyOrderTransition(orderId, "rejected", session.userId!, parsed.data.note);
  revalidatePath("/channel/orders");
  revalidatePath(`/channel/orders/${orderId}`);
}

export async function cancelOrderAction(orderId: number, note?: string) {
  const order = await getOrder(orderId);
  if (!order) return;

  // draft/submitted: any signed-in user may withdraw. approved: admin only —
  // once approved, a non-admin can't unilaterally cancel a committed order.
  const session =
    order.status === "approved" ? await requireAdmin() : await requireSession();

  await applyOrderTransition(orderId, "cancelled", session.userId!, note || null);
  revalidatePath("/channel/orders");
  revalidatePath(`/channel/orders/${orderId}`);
}

export interface ScanState {
  error?: string;
  success?: string;
}

/**
 * OCR a receipt/billing photo and verify it against this PO/SO's line items.
 * Stores the structured comparison (never the image) as a receipt_scans row.
 */
export async function scanOrderReceiptAction(
  _prev: ScanState,
  formData: FormData
): Promise<ScanState> {
  const session = await requireSession();

  const orderId = Number(formData.get("order_id"));
  const order = await getOrder(orderId);
  if (!order) return { error: "Order not found." };

  // Free path: the browser already OCR'd the photo with Tesseract and posts
  // the raw text — parse it server-side. AI path (key configured): the photo
  // itself is uploaded and read by Claude vision.
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

  const items = await getOrderItems(orderId);
  const result = matchAgainstOrder(
    extracted,
    items.map((it) => ({
      productId: it.product_id,
      name: it.product_name,
      sku: it.sku,
      unitPrice: it.unit_price,
      quantity: it.quantity,
    }))
  );

  const referencesOrder = extracted.reference_numbers.some((ref) =>
    ref.toUpperCase().includes(order.order_number.toUpperCase())
  );
  const notes: string[] = [];
  notes.push(
    referencesOrder
      ? `Document references ${order.order_number}.`
      : `Document does not show ${order.order_number}.`
  );
  if (result.missingCandidates.length > 0) {
    notes.push(
      `Not on document: ${result.missingCandidates.map((c) => c.name).join(", ")}.`
    );
  }

  await createReceiptScan({
    scan_type: "order_verification",
    order_id: orderId,
    store_name: extracted.store_name,
    receipt_date: extracted.receipt_date,
    receipt_total: extracted.receipt_total,
    currency: extracted.currency,
    // Full structured extract — see the matching comment in
    // channel/audits/actions.ts for why this is safe with no schema change.
    raw_summary: JSON.stringify(extracted),
    match_status: result.status,
    note: notes.join(" "),
    created_by: session.userId!,
    lines: result.lines,
  });

  revalidatePath(`/channel/orders/${orderId}`);
  return {
    success:
      result.status === "matched"
        ? "Receipt matches this order."
        : "Scan saved — review the differences below.",
  };
}

export async function forceFulfillOrderAction(orderId: number) {
  const session = await requireAdmin();
  await forceFulfillOrder(orderId, session.userId!);
  revalidatePath("/channel/orders");
  revalidatePath(`/channel/orders/${orderId}`);
}
