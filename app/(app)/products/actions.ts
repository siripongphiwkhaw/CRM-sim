"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/session";
import { productSchema, firstError, type FormState } from "@/lib/validation";
import {
  createProduct,
  updateProduct,
  deleteProduct,
  isReferencedByOrders,
} from "@/db/queries/products";

function parseProduct(formData: FormData) {
  return productSchema.safeParse({
    sku: formData.get("sku"),
    name: formData.get("name"),
    brand: formData.get("brand"),
    category: formData.get("category") ?? "",
    unit_price: formData.get("unit_price") || 0,
  });
}

export async function createProductAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  await requireSession();
  const parsed = parseProduct(formData);
  if (!parsed.success) return { error: firstError(parsed.error) };

  await createProduct({ ...parsed.data, category: parsed.data.category || null });
  revalidatePath("/products");
  redirect("/products");
}

export async function updateProductAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  await requireSession();
  const id = Number(formData.get("id"));
  if (!id) return { error: "Missing product id." };

  const parsed = parseProduct(formData);
  if (!parsed.success) return { error: firstError(parsed.error) };

  await updateProduct(id, { ...parsed.data, category: parsed.data.category || null });
  revalidatePath("/products");
  redirect("/products");
}

export async function deleteProductAction(formData: FormData) {
  await requireSession();
  const id = Number(formData.get("id"));
  if (id) {
    if (await isReferencedByOrders(id)) {
      redirect("/products?error=has-orders");
    }
    await deleteProduct(id);
    revalidatePath("/products");
  }
  redirect("/products");
}
