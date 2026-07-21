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
import type { FormState } from "@/lib/validation";
import type { Distributor } from "@/db/queries/distributors";
import type { Product } from "@/db/queries/products";
import { createOrderAction } from "./actions";

interface Row {
  productId: number;
  quantity: number;
}

export function OrderLineItemsForm({
  distributors,
  products,
  defaultDistributorId,
}: {
  distributors: Distributor[];
  products: Product[];
  defaultDistributorId?: number;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(
    createOrderAction,
    {}
  );
  const [rows, setRows] = useState<Row[]>([
    { productId: products[0]?.id ?? 0, quantity: 1 },
  ]);

  function updateRow(index: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  const total = rows.reduce((sum, r) => {
    const p = products.find((x) => x.id === r.productId);
    return sum + (p ? p.unit_price * r.quantity : 0);
  }, 0);

  return (
    <form action={formAction} className="max-w-3xl space-y-5">
      <input
        type="hidden"
        name="items_json"
        value={JSON.stringify(
          rows.map((r) => ({ product_id: r.productId, quantity: r.quantity }))
        )}
      />
      <FormError message={state.error} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Distributor" htmlFor="distributor_id" required>
          <Select id="distributor_id" name="distributor_id" defaultValue={defaultDistributorId ?? distributors[0]?.id ?? ""}>
            {distributors.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="Requested delivery date" htmlFor="requested_delivery_date">
          <TextInput id="requested_delivery_date" name="requested_delivery_date" type="date" />
        </Field>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold text-[#3c4f5e]">Line items</p>
        <div className="overflow-x-auto rounded border border-[#dde5e8] bg-white">
          <table className="min-w-full divide-y divide-[#dde5e8] text-sm">
            <thead className="bg-[#f8fafb] text-left text-xs font-semibold uppercase tracking-wide text-[#3c4f5e]">
              <tr>
                <th className="px-3 py-2">Product</th>
                <th className="px-3 py-2 text-right">Unit price</th>
                <th className="px-3 py-2 text-right">Quantity</th>
                <th className="px-3 py-2 text-right">Line total</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#eef3f5]">
              {rows.map((row, i) => {
                const product = products.find((p) => p.id === row.productId);
                return (
                  <tr key={i}>
                    <td className="px-3 py-2">
                      <select
                        value={row.productId}
                        onChange={(e) => updateRow(i, { productId: Number(e.target.value) })}
                        className="w-full rounded border border-[#c2d0d6] px-2 py-1 text-sm focus:border-brand-600 focus:outline-none"
                      >
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2 text-right text-[#607785]">
                      {product ? product.unit_price.toLocaleString("en-US") : "—"}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <input
                        type="number"
                        min="1"
                        value={row.quantity}
                        onChange={(e) => updateRow(i, { quantity: Math.max(1, Number(e.target.value) || 1) })}
                        className="w-20 rounded border border-[#c2d0d6] px-2 py-1 text-right text-sm focus:border-brand-600 focus:outline-none"
                      />
                    </td>
                    <td className="px-3 py-2 text-right font-medium text-[#14202b]">
                      {product ? (product.unit_price * row.quantity).toLocaleString("en-US") : "—"}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        disabled={rows.length === 1}
                        onClick={() => setRows((prev) => prev.filter((_, idx) => idx !== i))}
                        className="text-xs text-[#8e030f] hover:underline disabled:opacity-30"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-2 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setRows((prev) => [...prev, { productId: products[0]?.id ?? 0, quantity: 1 }])}
            className="text-sm text-brand-600 hover:underline"
          >
            + Add line
          </button>
          <p className="text-sm font-semibold text-[#14202b]">
            Total: {total.toLocaleString("en-US")}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <SubmitButton>Create order (draft)</SubmitButton>
        <Link href="/channel/orders" className="text-sm text-[#607785] hover:text-[#14202b]">
          Cancel
        </Link>
      </div>
    </form>
  );
}
