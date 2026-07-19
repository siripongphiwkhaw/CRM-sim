import { notFound } from "next/navigation";
import { getDistributor } from "@/db/queries/distributors";
import { listCustomers } from "@/db/queries/customers";
import { PageHeader } from "@/app/components/ui";
import { DistributorForm } from "../../DistributorForm";
import { updateDistributorAction } from "../../actions";

export const dynamic = "force-dynamic";

export default async function EditDistributorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [distributor, members] = await Promise.all([
    getDistributor(Number(id)),
    listCustomers({ custType: "B2B" }),
  ]);
  if (!distributor) notFound();
  const options = members.map((m) => ({
    id: m.id,
    label: `${m.first_name} ${m.last_name} (${m.member_code})`,
  }));

  return (
    <div>
      <PageHeader icon="distributor" overline="Distributor" title={`Edit ${distributor.name}`} />
      <DistributorForm action={updateDistributorAction} distributor={distributor} b2bMembers={options} />
    </div>
  );
}
