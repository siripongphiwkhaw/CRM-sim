import Link from "next/link";
import { listCustomers } from "@/db/queries/customers";
import {
  PageHeader,
  LinkButton,
  EmptyState,
  TierBadge,
  SortableTh,
} from "@/app/components/ui";
import { formatCurrency } from "@/lib/format";
import { BRANDS, TIERS } from "@/lib/constants";

export const dynamic = "force-dynamic";

const filterClass =
  "rounded border border-[#c9c9c9] bg-white px-3 py-1.5 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    brand?: string;
    tier?: string;
    sort?: string;
    dir?: string;
  }>;
}) {
  const { q, brand, tier, sort, dir } = await searchParams;
  const customers = await listCustomers({ search: q, brand, tier, sort, dir });
  const params = { q, brand, tier, sort, dir };

  return (
    <div>
      <PageHeader
        icon="customer"
        overline="Customers"
        title="All Members"
        subtitle={`${customers.length} ${customers.length === 1 ? "record" : "records"}`}
        action={<LinkButton href="/customers/new">New</LinkButton>}
      />

      <form method="get" className="mb-3 flex flex-wrap gap-2">
        <input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search name, email, member code…"
          className={`w-full max-w-xs ${filterClass}`}
        />
        <select name="brand" defaultValue={brand ?? ""} className={filterClass}>
          <option value="">All brands</option>
          {BRANDS.map((b) => (
            <option key={b} value={b}>{b}</option>
          ))}
        </select>
        <select name="tier" defaultValue={tier ?? ""} className={filterClass}>
          <option value="">All tiers</option>
          {TIERS.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded border border-[#c9c9c9] bg-white px-4 py-1.5 text-sm font-medium text-[#444] transition duration-150 hover:bg-[#f3f3f3] active:scale-[0.98]"
        >
          Filter
        </button>
      </form>

      {customers.length === 0 ? (
        <EmptyState message="No members match your filters." />
      ) : (
        <div className="overflow-x-auto rounded border border-[#e5e5e5] bg-white">
          <table className="min-w-full divide-y divide-[#e5e5e5] text-sm">
            <thead className="bg-[#fafaf9]">
              <tr>
                <SortableTh label="Member" column="name" params={params} baseHref="/customers" />
                <SortableTh label="Brand" column="brand" params={params} baseHref="/customers" />
                <SortableTh label="Tier" column="tier" params={params} baseHref="/customers" />
                <SortableTh label="Points" column="points" params={params} baseHref="/customers" align="right" />
                <SortableTh label="CLV" column="clv" params={params} baseHref="/customers" align="right" />
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-[#444]">
                  Data level
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f3f3f3]">
              {customers.map((c) => (
                <tr key={c.id} className="transition-colors hover:bg-[#f3f3f3]">
                  <td className="px-4 py-2.5">
                    <Link href={`/customers/${c.id}`} className="font-medium text-brand-600 hover:underline">
                      {c.first_name} {c.last_name}
                    </Link>
                    <div className="text-xs text-[#706e6b]">{c.member_code}</div>
                  </td>
                  <td className="px-4 py-2.5 text-[#444]">{c.brand}</td>
                  <td className="px-4 py-2.5"><TierBadge tier={c.tier} /></td>
                  <td className="px-4 py-2.5 text-right text-[#444]">
                    {c.points.toLocaleString("en-US")}
                  </td>
                  <td className="px-4 py-2.5 text-right text-[#444]">
                    {formatCurrency(c.clv)}
                  </td>
                  <td className="px-4 py-2.5 text-[#444]">{c.data_level}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
