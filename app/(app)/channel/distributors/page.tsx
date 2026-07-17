import Link from "next/link";
import { listDistributors } from "@/db/queries/distributors";
import { PageHeader, LinkButton, EmptyState, SortableTh } from "@/app/components/ui";
import { formatCurrency } from "@/lib/format";

export const dynamic = "force-dynamic";

const filterClass =
  "rounded border border-[#c9c9c9] bg-white px-3 py-1.5 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600";

export default async function DistributorsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; sort?: string; dir?: string }>;
}) {
  const { q, status, sort, dir } = await searchParams;
  const distributors = await listDistributors({ search: q, status, sort, dir });
  const params = { q, status, sort, dir };

  return (
    <div>
      <PageHeader
        icon="distributor"
        overline="Sales & Channel"
        title="Distributors"
        subtitle={`${distributors.length} records`}
        action={<LinkButton href="/channel/distributors/new">New</LinkButton>}
      />

      <form method="get" className="mb-3 flex flex-wrap gap-2">
        <input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search name or code…"
          className={`w-full max-w-xs ${filterClass}`}
        />
        <select name="status" defaultValue={status ?? ""} className={filterClass}>
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        <button type="submit" className="rounded border border-[#c9c9c9] bg-white px-4 py-1.5 text-sm font-medium text-[#444] transition duration-150 hover:bg-[#f3f3f3] active:scale-[0.98]">
          Filter
        </button>
      </form>

      {distributors.length === 0 ? (
        <EmptyState message="No distributors match your filters." />
      ) : (
        <div className="overflow-x-auto rounded border border-[#e5e5e5] bg-white">
          <table className="min-w-full divide-y divide-[#e5e5e5] text-sm">
            <thead className="bg-[#fafaf9]">
              <tr>
                <SortableTh label="Name" column="name" params={params} baseHref="/channel/distributors" />
                <SortableTh label="Code" column="code" params={params} baseHref="/channel/distributors" />
                <SortableTh label="Region" column="region" params={params} baseHref="/channel/distributors" />
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-[#444]">Channel</th>
                <SortableTh label="Status" column="status" params={params} baseHref="/channel/distributors" />
                <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wide text-[#444]">Credit limit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f3f3f3]">
              {distributors.map((d) => (
                <tr key={d.id} className="transition-colors hover:bg-[#f3f3f3]">
                  <td className="px-4 py-2.5">
                    <Link href={`/channel/distributors/${d.id}`} className="font-medium text-brand-600 hover:underline">
                      {d.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs text-[#706e6b]">{d.distributor_code}</td>
                  <td className="px-4 py-2.5 text-[#444]">{d.region || "—"}</td>
                  <td className="px-4 py-2.5 text-[#444]">{d.channel || "—"}</td>
                  <td className="px-4 py-2.5">
                    <span className={d.status === "active" ? "text-[#194e31]" : "text-[#706e6b]"}>
                      {d.status}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right text-[#444]">{formatCurrency(d.credit_limit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
