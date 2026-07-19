"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/session";
import { distributorReportSchema, firstError, type FormState } from "@/lib/validation";
import { createDistributorReport } from "@/db/queries/reports";

export async function createDistributorReportAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const session = await requireSession();
  const parsed = distributorReportSchema.safeParse({
    distributor_id: formData.get("distributor_id"),
    product_id: formData.get("product_id"),
    period: formData.get("period"),
    sell_out_qty: formData.get("sell_out_qty") || 0,
    forecast_qty: formData.get("forecast_qty") || 0,
  });
  if (!parsed.success) return { error: firstError(parsed.error) };

  const result = await createDistributorReport({
    distributor_id: parsed.data.distributor_id,
    product_id: parsed.data.product_id,
    period: parsed.data.period,
    sell_out_qty: parsed.data.sell_out_qty,
    forecast_qty: parsed.data.forecast_qty,
    created_by: session.userId,
  });
  if (!result.ok) {
    return { error: `Sell-out of ${parsed.data.sell_out_qty} exceeds on-hand stock (${result.on_hand}).` };
  }
  revalidatePath("/channel/reports");
  revalidatePath("/channel/inventory");
  revalidatePath("/insights");
  return { success: "Sell-out report recorded." };
}
