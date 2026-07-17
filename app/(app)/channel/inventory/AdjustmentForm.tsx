"use client";

import { useActionState } from "react";
import { Field, TextInput, Select, FormError, SubmitButton } from "@/app/components/form";
import type { FormState } from "@/lib/validation";
import type { Distributor } from "@/db/queries/distributors";
import type { Product } from "@/db/queries/products";
import { recordInventoryAdjustmentAction } from "./actions";

export function AdjustmentForm({
  distributors,
  products,
}: {
  distributors: Distributor[];
  products: Product[];
}) {
  const [state, formAction] = useActionState<FormState, FormData>(
    recordInventoryAdjustmentAction,
    {}
  );

  return (
    <form action={formAction} className="space-y-3 rounded border border-[#e5e5e5] bg-[#fafaf9] p-3">
      <FormError message={state.error} />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Field label="Distributor" htmlFor="adj-distributor">
          <Select id="adj-distributor" name="distributor_id">
            {distributors.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="Product" htmlFor="adj-product">
          <Select id="adj-product" name="product_id">
            {products.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="Quantity (± )" htmlFor="adj-qty">
          <TextInput id="adj-qty" name="quantity" type="number" step="1" placeholder="e.g. -5" required />
        </Field>
        <Field label="Note" htmlFor="adj-note">
          <TextInput id="adj-note" name="note" placeholder="Reason" />
        </Field>
      </div>
      <SubmitButton>Record adjustment</SubmitButton>
    </form>
  );
}
