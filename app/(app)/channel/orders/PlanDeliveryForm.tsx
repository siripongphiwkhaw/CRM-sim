"use client";

import { useActionState } from "react";
import { TextInput, FormError, SubmitButton } from "@/app/components/form";
import type { FormState } from "@/lib/validation";
import { createDeliveryPlanFromOrderAction } from "../inventory/actions";

export function PlanDeliveryForm({ orderId }: { orderId: number }) {
  const [state, formAction] = useActionState<FormState, FormData>(
    createDeliveryPlanFromOrderAction,
    {}
  );

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="order_id" value={orderId} />
      <div>
        <label className="mb-1 block text-xs font-semibold text-[#444]">Delivery date</label>
        <TextInput name="plan_date" type="date" required />
      </div>
      <SubmitButton>Schedule delivery</SubmitButton>
      <FormError message={state.error} />
    </form>
  );
}
