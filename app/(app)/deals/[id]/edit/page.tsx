import { notFound } from "next/navigation";
import { getDeal } from "@/db/queries/deals";
import { listContacts } from "@/db/queries/contacts";
import { listCompanies } from "@/db/queries/companies";
import { PageHeader } from "@/app/components/ui";
import { DealForm } from "../../DealForm";
import { updateDealAction } from "../../actions";

export const dynamic = "force-dynamic";

export default async function EditDealPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const deal = await getDeal(Number(id));
  if (!deal) notFound();

  const [contacts, companies] = await Promise.all([
    listContacts(),
    listCompanies(),
  ]);

  return (
    <div>
      <PageHeader title={`Edit ${deal.title}`} />
      <DealForm
        action={updateDealAction}
        contacts={contacts}
        companies={companies}
        deal={deal}
      />
    </div>
  );
}
