import { listCustomers } from "@/db/queries/customers";
import { PageHeader } from "@/app/components/ui";
import { DistributorForm } from "../DistributorForm";
import { createDistributorAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewDistributorPage() {
  const members = await listCustomers({ custType: "B2B" });
  const options = members.map((m) => ({
    id: m.id,
    label: `${m.first_name} ${m.last_name} (${m.member_code})`,
  }));
  return (
    <div>
      <PageHeader icon="distributor" overline="Distributor" title="New Distributor" />
      <DistributorForm action={createDistributorAction} b2bMembers={options} />
    </div>
  );
}
