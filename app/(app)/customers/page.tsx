import Link from "next/link";
import { listCustomers } from "@/db/queries/customers";
import { getCustTypeDistribution } from "@/db/queries/analytics";
import { getCustomerScope, isFullScope } from "@/lib/customerScope";
import {
  PageHeader,
  LinkButton,
  EmptyState,
  TierBadge,
  SortableTh,
} from "@/app/components/ui";
import { formatCurrency } from "@/lib/format";
import { BRANDS, TIERS, CUST_TYPES, type CustType } from "@/lib/constants";
import { SegmentPicker } from "./SegmentPicker";

export const dynamic = "force-dynamic";

const filterClass =
  "rounded border border-[#c2d0d6] bg-white px-3 py-1.5 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600";

type TypeParam = CustType | "all";

const SEGMENT_TITLES: Record<TypeParam, string> = {
  B2B: "B2B Customers",
  B2C: "B2C Customers",
  all: "All Customers",
};

/** null = absent or unrecognised, which falls through to the segment picker
 * rather than filtering the list down to nothing. */
function parseType(raw: string | undefined): TypeParam | null {
  if (raw === "all") return "all";
  return (CUST_TYPES as readonly string[]).includes(raw ?? "")
    ? (raw as CustType)
    : null;
}

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    brand?: string;
    tier?: string;
    sort?: string;
    dir?: string;
    type?: string;
  }>;
}) {
  const { q, brand, tier, sort, dir, type } = await searchParams;
  const scope = await getCustomerScope();

  if (scope === "NONE") {
    return (
      <div>
        <PageHeader icon="customer" overline="Customers" title="Customers" />
        <EmptyState message="No members match your access. Ask an admin to set your department in Setup." />
      </div>
    );
  }

  const requested = parseType(type);
  const fullScope = isFullScope(scope);

  if (fullScope && requested === null) {
    return <SegmentPicker counts={await getCustTypeDistribution(scope)} />;
  }

  // A department scoped to one side only ever sees that side — customersFor()
  // has already narrowed the table. Honouring `type` here would AND a second
  // filter on top and show an empty list for a segment they never chose.
  const effectiveType = fullScope && requested !== "all" ? requested : null;

  const customers = await listCustomers(scope, {
    search: q,
    brand,
    tier,
    custType: effectiveType ?? undefined,
    sort,
    dir,
  });
  // Raw `type`, not effectiveType: SortableTh re-serialises this verbatim, so
  // normalising it here would drop the segment out of every sort link.
  const params = { q, brand, tier, sort, dir, type };

  return (
    <div>
      {fullScope && (
        <p className="mb-2 text-sm">
          <Link
            href="/customers"
            className="rounded-control text-brand-600 transition-colors hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
          >
            ← Back to segments
          </Link>
        </p>
      )}

      <PageHeader
        icon={requested === "B2B" ? "b2b" : "customer"}
        overline="Customers"
        title={requested ? SEGMENT_TITLES[requested] : "All Customers"}
        subtitle={`${customers.length} ${customers.length === 1 ? "record" : "records"}`}
        action={<LinkButton href="/customers/new">New</LinkButton>}
      />

      <form method="get" className="mb-3 flex flex-wrap gap-2">
        {type && <input type="hidden" name="type" value={type} />}
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
          className="rounded border border-[#c2d0d6] bg-white px-4 py-1.5 text-sm font-medium text-[#3c4f5e] transition duration-150 hover:bg-[#eef3f5] active:scale-[0.98]"
        >
          Filter
        </button>
      </form>

      {customers.length === 0 ? (
        <EmptyState message="No members match your filters." />
      ) : (
        <div className="overflow-x-auto rounded border border-[#dde5e8] bg-white">
          <table className="min-w-full divide-y divide-[#dde5e8] text-sm">
            <thead className="bg-[#f8fafb]">
              <tr>
                <SortableTh label="Member" column="name" params={params} baseHref="/customers" />
                <SortableTh label="Brand" column="brand" params={params} baseHref="/customers" />
                <SortableTh label="Tier" column="tier" params={params} baseHref="/customers" />
                <SortableTh label="Points" column="points" params={params} baseHref="/customers" align="right" />
                <SortableTh label="CLV" column="clv" params={params} baseHref="/customers" align="right" />
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-[#3c4f5e]">
                  Data level
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#eef3f5]">
              {customers.map((c) => (
                <tr key={c.id} className="transition-colors hover:bg-[#eef3f5]">
                  <td className="px-4 py-2.5">
                    <Link href={`/customers/${c.id}`} className="font-medium text-brand-600 hover:underline">
                      {c.first_name} {c.last_name}
                    </Link>
                    <div className="text-xs text-[#607785]">{c.member_code}</div>
                  </td>
                  <td className="px-4 py-2.5 text-[#3c4f5e]">{c.brand}</td>
                  <td className="px-4 py-2.5"><TierBadge tier={c.tier} /></td>
                  <td className="px-4 py-2.5 text-right text-[#3c4f5e]">
                    {c.points.toLocaleString("en-US")}
                  </td>
                  <td className="px-4 py-2.5 text-right text-[#3c4f5e]">
                    {formatCurrency(c.clv)}
                  </td>
                  <td className="px-4 py-2.5 text-[#3c4f5e]">{c.data_level}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
