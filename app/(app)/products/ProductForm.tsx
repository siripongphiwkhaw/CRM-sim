"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import {
  Field,
  TextInput,
  Select,
  FormError,
  SubmitButton,
} from "@/app/components/form";
import { BRANDS, PRODUCT_CATEGORIES } from "@/lib/constants";
import type { FormState } from "@/lib/validation";
import type { Product } from "@/db/queries/products";

type Action = (prev: FormState, formData: FormData) => Promise<FormState>;

// Product thumbnails render small (~140px), so downscaling client-side to
// this edge keeps the resulting data URL (stored directly in image_url)
// well under the server action's body size limit.
const MAX_IMAGE_EDGE = 480;

export function ProductForm({
  action,
  product,
}: {
  action: Action;
  product?: Product;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(action, {});
  const [imageUrl, setImageUrl] = useState(product?.image_url ?? "");
  const [imageError, setImageError] = useState<string | null>(null);

  async function handleImageFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ""; // allow re-picking the same file
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setImageError("Please choose an image file.");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setImageError("Image is too large (max 8MB).");
      return;
    }
    try {
      const bitmap = await createImageBitmap(file);
      const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("no-2d-context");
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bitmap.close();
      setImageUrl(canvas.toDataURL("image/jpeg", 0.85));
      setImageError(null);
    } catch {
      setImageError("Could not read that image. Try a different file.");
    }
  }

  return (
    <form action={formAction} className="max-w-2xl space-y-5">
      {product && <input type="hidden" name="id" value={product.id} />}
      <FormError message={state.error} />

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field label="SKU" htmlFor="sku" required>
          <TextInput id="sku" name="sku" placeholder="e.g. SKU-1001" defaultValue={product?.sku ?? ""} required />
        </Field>
        <Field label="Unit price" htmlFor="unit_price">
          <TextInput id="unit_price" name="unit_price" type="number" min="0" step="0.01" placeholder="e.g. 199.00" defaultValue={product?.unit_price ?? 0} />
        </Field>
        <Field label="Product name" htmlFor="name" required>
          <TextInput id="name" name="name" placeholder="e.g. Premium Gift Set" defaultValue={product?.name ?? ""} required />
        </Field>
        <Field label="Brand" htmlFor="brand" required>
          <Select id="brand" name="brand" defaultValue={product?.brand ?? BRANDS[0]}>
            {BRANDS.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </Select>
        </Field>
        <Field label="Category" htmlFor="category">
          <Select id="category" name="category" defaultValue={product?.category ?? ""}>
            <option value="">— None —</option>
            {PRODUCT_CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </Select>
        </Field>
        <Field label="Reorder point" htmlFor="reorder_point" hint="Alert when dealer stock falls to this level">
          <TextInput id="reorder_point" name="reorder_point" type="number" min="0" step="1" placeholder="e.g. 20" defaultValue={product?.reorder_point ?? 20} />
        </Field>
      </div>

      <Field
        label="Product image"
        htmlFor="product_image_file"
        hint="Upload a photo from your computer, or paste an image URL below. Leave blank to use the drawn placeholder."
      >
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            {imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imageUrl}
                alt=""
                className="h-16 w-16 rounded-[8px] border border-[#dde5e8] object-cover"
              />
            )}
            <input
              id="product_image_file"
              type="file"
              accept="image/*"
              onChange={handleImageFile}
              className="block flex-1 text-sm text-[#3c4f5e] file:mr-3 file:cursor-pointer file:rounded file:border file:border-[#c2d0d6] file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-brand-600 file:transition file:duration-150 hover:file:bg-[#eef3f5]"
            />
          </div>
          {imageError && <p className="text-xs text-[#8e030f]">{imageError}</p>}
          <TextInput
            id="image_url"
            name="image_url"
            type="text"
            placeholder="https://… (or upload a photo above)"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
          />
        </div>
      </Field>

      <div className="flex items-center gap-3">
        <SubmitButton>{product ? "Save changes" : "Create product"}</SubmitButton>
        <Link href="/products" className="text-sm text-[#607785] hover:text-[#14202b]">
          Cancel
        </Link>
      </div>
    </form>
  );
}
