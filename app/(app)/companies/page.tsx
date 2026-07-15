import Link from "next/link";
import { listCompaniesWithCounts } from "@/db/queries/companies";
import { PageHeader, LinkButton, EmptyState } from "@/app/components/ui";

export const dynamic = "force-dynamic";

export default async function CompaniesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const companies = await listCompaniesWithCounts(q);

  return (
    <div>
      <PageHeader
        title="Companies"
        subtitle={`${companies.length} ${companies.length === 1 ? "company" : "companies"}`}
        action={<LinkButton href="/companies/new">New company</LinkButton>}
      />

      <form method="get" className="mb-4">
        <input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search companies…"
          className="w-full max-w-sm rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </form>

      {companies.length === 0 ? (
        <EmptyState
          message={
            q ? `No companies match “${q}”.` : "No companies yet. Create your first one."
          }
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Industry</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3 text-right">Contacts</th>
                <th className="px-4 py-3 text-right">Deals</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {companies.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/companies/${c.id}`}
                      className="font-medium text-indigo-600 hover:underline"
                    >
                      {c.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{c.industry || "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{c.phone || "—"}</td>
                  <td className="px-4 py-3 text-right text-slate-600">
                    {c.contact_count}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-600">
                    {c.deal_count}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
