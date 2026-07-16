import { notFound } from "next/navigation";
import { getCustomer } from "@/db/queries/customers";
import { PageHeader } from "@/app/components/ui";
import { CustomerForm } from "../../CustomerForm";
import { updateCustomerAction } from "../../actions";

export const dynamic = "force-dynamic";

export default async function EditCustomerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const customer = await getCustomer(Number(id));
  if (!customer) notFound();

  return (
    <div>
      <PageHeader title={`Edit ${customer.first_name} ${customer.last_name}`} />
      <CustomerForm action={updateCustomerAction} customer={customer} />
    </div>
  );
}
