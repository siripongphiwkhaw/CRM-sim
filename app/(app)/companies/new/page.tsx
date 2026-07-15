import { PageHeader } from "@/app/components/ui";
import { CompanyForm } from "../CompanyForm";
import { createCompanyAction } from "../actions";

export const dynamic = "force-dynamic";

export default function NewCompanyPage() {
  return (
    <div>
      <PageHeader title="New company" />
      <CompanyForm action={createCompanyAction} />
    </div>
  );
}
