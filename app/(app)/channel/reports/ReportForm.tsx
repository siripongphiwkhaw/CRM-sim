"use client";

import { useActionState } from "react";
import { Field, TextInput, Select, FormError, SubmitButton } from "@/app/components/form";
import type { FormState } from "@/lib/validation";
import type { Distributor } from "@/db/queries/distributors";
import type { Product } from "@/db/queries/products";
import { createDistributorReportAction } from "./actions";

export function ReportForm({
  distributors,
  products,
}: {
  distributors: Distributor[];
  products: Product[];
}) {
  const [state, formAction] = useActionState<FormState, FormData>(
    createDistributorReportAction,
    {}
  );

  return (
    <form action={formAction} className="space-y-3 rounded border border-[#dde5e8] bg-[#f8fafb] p-3">
      <FormError message={state.error} />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <Field label="Distributor" htmlFor="rep-distributor">
          <Select id="rep-distributor" name="distributor_id">
            {distributors.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="Product" htmlFor="rep-product">
          <Select id="rep-product" name="product_id">
            {products.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="Period" htmlFor="rep-period">
          <TextInput id="rep-period" name="period" placeholder="2026-07" required />
        </Field>
        <Field label="Sell-out qty" htmlFor="rep-sellout">
          <TextInput id="rep-sellout" name="sell_out_qty" type="number" min="0" step="1" defaultValue={0} />
        </Field>
        <Field label="Forecast qty" htmlFor="rep-forecast">
          <TextInput id="rep-forecast" name="forecast_qty" type="number" min="0" step="1" defaultValue={0} />
        </Field>
      </div>
      <SubmitButton>Record report</SubmitButton>
    </form>
  );
}
