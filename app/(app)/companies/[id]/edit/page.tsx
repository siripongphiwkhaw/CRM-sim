import { notFound } from "next/navigation";
import { getCompany } from "@/db/queries/companies";
import { PageHeader } from "@/app/components/ui";
import { CompanyForm } from "../../CompanyForm";
import { updateCompanyAction } from "../../actions";

export const dynamic = "force-dynamic";

export default async function EditCompanyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const company = getCompany(Number(id));
  if (!company) notFound();

  return (
    <div>
      <PageHeader title={`Edit ${company.name}`} />
      <CompanyForm action={updateCompanyAction} company={company} />
    </div>
  );
}
