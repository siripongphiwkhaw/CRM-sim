import { listCompanies } from "@/db/queries/companies";
import { PageHeader } from "@/app/components/ui";
import { ContactForm } from "../ContactForm";
import { createContactAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewContactPage() {
  const companies = listCompanies();

  return (
    <div>
      <PageHeader title="New contact" />
      <ContactForm action={createContactAction} companies={companies} />
    </div>
  );
}
