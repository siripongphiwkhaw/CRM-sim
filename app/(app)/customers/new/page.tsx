import { PageHeader } from "@/app/components/ui";
import { CustomerForm } from "../CustomerForm";
import { createCustomerAction } from "../actions";

export const dynamic = "force-dynamic";

export default function NewCustomerPage() {
  return (
    <div>
      <PageHeader icon="customer" overline="Customer" title="New Member" />
      <CustomerForm action={createCustomerAction} />
    </div>
  );
}
