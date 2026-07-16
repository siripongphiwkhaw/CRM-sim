import Link from "next/link";
import { listCustomers } from "@/db/queries/customers";
import { PageHeader, LinkButton, EmptyState, TierBadge } from "@/app/components/ui";
import { formatCurrency } from "@/lib/format";
import { BRANDS, TIERS } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; brand?: string; tier?: string }>;
}) {
  const { q, brand, tier } = await searchParams;
  const customers = await listCustomers({ search: q, brand, tier });

  return (
    <div>
      <PageHeader
        title="Customers (CDP)"
        subtitle={`${customers.length} ${customers.length === 1 ? "member" : "members"}`}
        action={<LinkButton href="/customers/new">New member</LinkButton>}
      />

      <form method="get" className="mb-4 flex flex-wrap gap-2">
        <input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search name, email, member code…"
          className="w-full max-w-xs rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
        />
        <select
          name="brand"
          defaultValue={brand ?? ""}
          className="rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
        >
          <option value="">All brands</option>
          {BRANDS.map((b) => (
            <option key={b} value={b}>{b}</option>
          ))}
        </select>
        <select
          name="tier"
          defaultValue={tier ?? ""}
          className="rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
        >
          <option value="">All tiers</option>
          {TIERS.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-md border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100"
        >
          Filter
        </button>
      </form>

      {customers.length === 0 ? (
        <EmptyState message="No members match your filters." />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-stone-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-stone-200 text-sm">
            <thead className="bg-stone-50 text-left text-xs font-medium uppercase tracking-wide text-stone-500">
              <tr>
                <th className="px-4 py-3">Member</th>
                <th className="px-4 py-3">Brand</th>
                <th className="px-4 py-3">Tier</th>
                <th className="px-4 py-3 text-right">Points</th>
                <th className="px-4 py-3 text-right">CLV</th>
                <th className="px-4 py-3">Data level</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {customers.map((c) => (
                <tr key={c.id} className="hover:bg-stone-50">
                  <td className="px-4 py-3">
                    <Link href={`/customers/${c.id}`} className="font-medium text-brand-700 hover:underline">
                      {c.first_name} {c.last_name}
                    </Link>
                    <div className="text-xs text-stone-400">{c.member_code}</div>
                  </td>
                  <td className="px-4 py-3 text-stone-600">{c.brand}</td>
                  <td className="px-4 py-3"><TierBadge tier={c.tier} /></td>
                  <td className="px-4 py-3 text-right text-stone-600">
                    {c.points.toLocaleString("en-US")}
                  </td>
                  <td className="px-4 py-3 text-right text-stone-600">
                    {formatCurrency(c.clv)}
                  </td>
                  <td className="px-4 py-3 text-stone-600">{c.data_level}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
