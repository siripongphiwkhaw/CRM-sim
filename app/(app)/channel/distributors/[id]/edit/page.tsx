import { notFound } from "next/navigation";
import { getDistributor } from "@/db/queries/distributors";
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
  const distributor = await getDistributor(Number(id));
  if (!distributor) notFound();

  return (
    <div>
      <PageHeader icon="distributor" overline="Distributor" title={`Edit ${distributor.name}`} />
      <DistributorForm action={updateDistributorAction} distributor={distributor} />
    </div>
  );
}
