import { notFound } from "next/navigation";
import { getProduct } from "@/db/queries/products";
import { PageHeader } from "@/app/components/ui";
import { ProductForm } from "../../ProductForm";
import { updateProductAction } from "../../actions";

export const dynamic = "force-dynamic";

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const product = await getProduct(Number(id));
  if (!product) notFound();

  return (
    <div>
      <PageHeader icon="product" overline="Product" title={`Edit ${product.name}`} />
      <ProductForm action={updateProductAction} product={product} />
    </div>
  );
}
