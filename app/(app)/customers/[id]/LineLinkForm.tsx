"use client";

import { useActionState } from "react";
import { TextInput, FormError, FormSuccess, SubmitButton } from "@/app/components/form";
import type { FormState } from "@/lib/validation";
import { setCustomerLineAction } from "../actions";

/**
 * Staff-side linking of a member's Only-One LINE account. The value comes from
 * a linking request (a case) after identity is verified out of band — there is
 * deliberately no self-serve match-by-phone.
 */
export function LineLinkForm({
  customerId,
  lineUserId,
}: {
  customerId: number;
  lineUserId: string | null;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(setCustomerLineAction, {});

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="customer_id" value={customerId} />
      <FormError message={state.error} />
      <FormSuccess message={state.success} />
      <TextInput
        name="line_user_id"
        defaultValue={lineUserId ?? ""}
        placeholder="LINE user id (Uxxxxxxxx…)"
        aria-label="LINE user id"
        className="font-mono text-xs"
      />
      <div className="flex items-center gap-2">
        <SubmitButton>{lineUserId ? "Update link" : "Link account"}</SubmitButton>
        <span className="text-xs text-[#607785]">
          {lineUserId ? "Clear the field and save to unlink." : "Not linked yet."}
        </span>
      </div>
    </form>
  );
}
