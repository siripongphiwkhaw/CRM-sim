import { PageHeader } from "@/app/components/ui";
import { DistributorForm } from "../DistributorForm";
import { createDistributorAction } from "../actions";

export const dynamic = "force-dynamic";

export default function NewDistributorPage() {
  return (
    <div>
      <PageHeader icon="distributor" overline="Distributor" title="New Distributor" />
      <DistributorForm action={createDistributorAction} />
    </div>
  );
}
