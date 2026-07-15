import { notFound } from "next/navigation";
import { getContact } from "@/db/queries/contacts";
import { listCompanies } from "@/db/queries/companies";
import { PageHeader } from "@/app/components/ui";
import { ContactForm } from "../../ContactForm";
import { updateContactAction } from "../../actions";

export const dynamic = "force-dynamic";

export default async function EditContactPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const contact = await getContact(Number(id));
  if (!contact) notFound();

  const companies = await listCompanies();

  return (
    <div>
      <PageHeader title={`Edit ${contact.first_name} ${contact.last_name}`} />
      <ContactForm
        action={updateContactAction}
        companies={companies}
        contact={contact}
      />
    </div>
  );
}
