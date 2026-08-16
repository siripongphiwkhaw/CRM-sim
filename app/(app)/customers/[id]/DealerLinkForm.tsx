"use client";

import { useActionState } from "react";
import { Select, FormError, FormSuccess, SubmitButton } from "@/app/components/form";
import type { FormState } from "@/lib/validation";
import type { Distributor } from "@/db/queries/distributors";
import { setCustomerDealerLinkAction } from "../actions";

/** Links this customer to a distributor/dealer record — Tier 2 (ANCHORED)
 * evidence for the classifier. See lib/classification.ts. */
export function DealerLinkForm({
  customerId,
  linked,
  pickable,
}: {
  customerId: number;
  linked: Distributor | null;
  pickable: Distributor[];
}) {
  const [state, formAction] = useActionState<FormState, FormData>(setCustomerDealerLinkAction, {});

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="customer_id" value={customerId} />
      <FormError message={state.error} />
      <FormSuccess message={state.success} />
      <div className="flex items-center gap-2">
        <Select name="distributor_id" aria-label="Linked dealer" defaultValue={linked?.id ?? ""} className="flex-1">
          <option value="">— Not linked —</option>
          {linked && (
            <option value={linked.id}>
              {linked.name} ({linked.distributor_code})
            </option>
          )}
          {pickable.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name} ({d.distributor_code})
            </option>
          ))}
        </Select>
        <SubmitButton>{linked ? "Update" : "Link"}</SubmitButton>
      </div>
      <p className="text-xs text-[#607785]">Choose “— Not linked —” and save to clear the link.</p>
    </form>
  );
}
