import { listDistributors } from "@/db/queries/distributors";
import { listProducts } from "@/db/queries/products";
import { PageHeader } from "@/app/components/ui";
import { OrderLineItemsForm } from "../OrderLineItemsForm";

export const dynamic = "force-dynamic";

export default async function NewOrderPage({
  searchParams,
}: {
  searchParams: Promise<{ distributor?: string }>;
}) {
  const { distributor } = await searchParams;
  const [distributors, products] = await Promise.all([
    listDistributors({ status: "active" }),
    listProducts(),
  ]);

  return (
    <div>
      <PageHeader icon="order" overline="Order" title="New Order" />
      <OrderLineItemsForm
        distributors={distributors}
        products={products}
        defaultDistributorId={distributor ? Number(distributor) : undefined}
      />
    </div>
  );
}
