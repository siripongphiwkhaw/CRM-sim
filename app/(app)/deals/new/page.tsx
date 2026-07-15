import { listContacts } from "@/db/queries/contacts";
import { listCompanies } from "@/db/queries/companies";
import { PageHeader } from "@/app/components/ui";
import { DealForm } from "../DealForm";
import { createDealAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewDealPage({
  searchParams,
}: {
  searchParams: Promise<{ contact_id?: string; company_id?: string }>;
}) {
  const { contact_id, company_id } = await searchParams;
  const contacts = listContacts();
  const companies = listCompanies();

  return (
    <div>
      <PageHeader title="New deal" />
      <DealForm
        action={createDealAction}
        contacts={contacts}
        companies={companies}
        defaults={{
          contact_id: contact_id ? Number(contact_id) : undefined,
          company_id: company_id ? Number(company_id) : undefined,
        }}
      />
    </div>
  );
}
