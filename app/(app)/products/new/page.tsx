import { PageHeader } from "@/app/components/ui";
import { ProductForm } from "../ProductForm";
import { createProductAction } from "../actions";

export const dynamic = "force-dynamic";

export default function NewProductPage() {
  return (
    <div>
      <PageHeader icon="product" overline="Product" title="New Product" />
      <ProductForm action={createProductAction} />
    </div>
  );
}
