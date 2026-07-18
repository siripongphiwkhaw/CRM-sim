import type { ReceiptImageMediaType } from "./receiptOcr";

const ALLOWED_TYPES: ReceiptImageMediaType[] = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

const MAX_BYTES = 5 * 1024 * 1024;

export interface ReceiptImagePayload {
  data: string;
  mediaType: ReceiptImageMediaType;
}

/** Validates the uploaded receipt photo and converts it to base64 for the vision call. */
export async function readReceiptImage(
  value: FormDataEntryValue | null
): Promise<ReceiptImagePayload | { error: string }> {
  if (!(value instanceof File) || value.size === 0) {
    return { error: "Choose a receipt photo first." };
  }
  if (!ALLOWED_TYPES.includes(value.type as ReceiptImageMediaType)) {
    return { error: "Unsupported image type — use a JPEG, PNG or WebP photo." };
  }
  if (value.size > MAX_BYTES) {
    return { error: "Image is larger than 5 MB. Take the photo again or crop it." };
  }
  const buffer = Buffer.from(await value.arrayBuffer());
  return {
    data: buffer.toString("base64"),
    mediaType: value.type as ReceiptImageMediaType,
  };
}
