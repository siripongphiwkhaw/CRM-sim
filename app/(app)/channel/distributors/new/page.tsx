import { listCustomers } from "@/db/queries/customers";
import { getCustomerScope } from "@/lib/customerScope";
import { PageHeader } from "@/app/components/ui";
import { DistributorForm } from "../DistributorForm";
import { createDistributorAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewDistributorPage() {
  // The department scope is applied on top of the B2B filter — a B2C-scoped
  // user linking a dealer sees no candidates, which is correct.
  const members = await listCustomers(await getCustomerScope(), { custType: "B2B" });
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
