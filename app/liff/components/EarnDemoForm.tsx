"use client";

import { useActionState } from "react";
import { BRANDS } from "@/lib/constants";
import type { FormState } from "@/lib/validation";
import { liffEarnAction } from "../actions";
import { LiffButton } from "./LiffButton";

// 16px minimum on every control — iOS Safari zooms the viewport on focus for
// anything smaller and doesn't zoom back.
const control =
  "w-full rounded-[12px] border border-[#c2d0d6] bg-white px-3 py-2.5 text-base text-[#14202b] focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600";

export function EarnDemoForm() {
  const [state, formAction] = useActionState<FormState, FormData>(liffEarnAction, {});

  return (
    <form action={formAction} className="space-y-2">
      {state.success && (
        <p className="rounded-[12px] bg-[#f2fbef] px-3 py-2 text-sm font-medium text-[#194e31]">
          {state.success}
        </p>
      )}
      {state.error && (
        <p className="rounded-[12px] bg-[#feded8] px-3 py-2 text-sm text-[#8e030f]">{state.error}</p>
      )}

      <label className="block text-xs text-[#607785]">
        Brand
        <select name="brand" defaultValue={BRANDS[0]} className={`mt-1 ${control}`}>
          {BRANDS.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
      </label>

      <div className="flex gap-2">
        <label className="block w-1/2 text-xs text-[#607785]">
          Quantity
          <input
            name="quantity"
            type="number"
            inputMode="numeric"
            min="1"
            step="1"
            defaultValue="1"
            required
            className={`mt-1 ${control}`}
          />
        </label>
        <label className="block w-1/2 text-xs text-[#607785]">
          Unit price ฿
          <input
            name="unit_price"
            type="number"
            inputMode="decimal"
            min="1"
            step="1"
            placeholder="0"
            required
            className={`mt-1 ${control}`}
          />
        </label>
      </div>

      <LiffButton>Add points</LiffButton>
    </form>
  );
}
