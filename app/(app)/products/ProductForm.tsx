"use client";

import { useActionState } from "react";
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

export function ProductForm({
  action,
  product,
}: {
  action: Action;
  product?: Product;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(action, {});

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
        label="Image URL"
        htmlFor="image_url"
        hint="Link to a product photo. Leave blank to use the drawn placeholder."
      >
        <TextInput
          id="image_url"
          name="image_url"
          type="url"
          placeholder="https://…"
          defaultValue={product?.image_url ?? ""}
        />
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
