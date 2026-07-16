import { PageHeader } from "@/app/components/ui";
import { CustomerForm } from "../CustomerForm";
import { createCustomerAction } from "../actions";

export const dynamic = "force-dynamic";

export default function NewCustomerPage() {
  return (
    <div>
      <PageHeader title="New member" />
      <CustomerForm action={createCustomerAction} />
    </div>
  );
}
