import Link from "next/link";
import { notFound } from "next/navigation";
import { getCompany } from "@/db/queries/companies";
import { listContacts } from "@/db/queries/contacts";
import { listDealsByCompany } from "@/db/queries/deals";
import {
  PageHeader,
  LinkButton,
  Card,
  StageBadge,
  EmptyState,
} from "@/app/components/ui";
import { DeleteButton } from "@/app/components/form";
import { formatCurrency, formatDate } from "@/lib/format";
import { deleteCompanyAction } from "../actions";

export const dynamic = "force-dynamic";

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-slate-100 py-2 last:border-0">
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd className="text-right text-sm text-slate-800">{value || "—"}</dd>
    </div>
  );
}

export default async function CompanyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const company = await getCompany(Number(id));
  if (!company) notFound();

  const [contacts, deals] = await Promise.all([
    listContacts({ companyId: company.id }),
    listDealsByCompany(company.id),
  ]);

  return (
    <div>
      <PageHeader
        title={company.name}
        subtitle={company.industry ?? undefined}
        action={
          <div className="flex items-center gap-2">
            <LinkButton href={`/companies/${company.id}/edit`} variant="secondary">
              Edit
            </LinkButton>
            <DeleteButton
              action={deleteCompanyAction}
              id={company.id}
              confirmMessage={`Delete ${company.name}? Its contacts and deals will be unlinked.`}
            />
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
            Details
          </h2>
          <dl>
            <DetailRow
              label="Website"
              value={
                company.website ? (
                  <a
                    href={company.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-600 hover:underline"
                  >
                    {company.website.replace(/^https?:\/\//, "")}
                  </a>
                ) : null
              }
            />
            <DetailRow label="Phone" value={company.phone} />
            <DetailRow label="Address" value={company.address} />
            <DetailRow label="Added" value={formatDate(company.created_at)} />
          </dl>
        </Card>

        <div className="space-y-6 lg:col-span-2">
          <Card>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
                Contacts
              </h2>
              <Link
                href="/contacts/new"
                className="text-sm text-indigo-600 hover:underline"
              >
                + Add contact
              </Link>
            </div>
            {contacts.length === 0 ? (
              <EmptyState message="No contacts at this company." />
            ) : (
              <ul className="divide-y divide-slate-100">
                {contacts.map((c) => (
                  <li
                    key={c.id}
                    className="flex items-center justify-between gap-3 py-2"
                  >
                    <Link
                      href={`/contacts/${c.id}`}
                      className="truncate font-medium text-indigo-600 hover:underline"
                    >
                      {c.first_name} {c.last_name}
                    </Link>
                    <span className="shrink-0 text-sm text-slate-500">
                      {c.title ?? "—"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
                Deals
              </h2>
              <Link
                href={`/deals/new?company_id=${company.id}`}
                className="text-sm text-indigo-600 hover:underline"
              >
                + Add deal
              </Link>
            </div>
            {deals.length === 0 ? (
              <EmptyState message="No deals for this company." />
            ) : (
              <ul className="divide-y divide-slate-100">
                {deals.map((d) => (
                  <li
                    key={d.id}
                    className="flex items-center justify-between gap-3 py-2"
                  >
                    <Link
                      href={`/deals/${d.id}`}
                      className="truncate font-medium text-indigo-600 hover:underline"
                    >
                      {d.title}
                    </Link>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="text-sm text-slate-600">
                        {formatCurrency(d.value)}
                      </span>
                      <StageBadge stage={d.stage} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
