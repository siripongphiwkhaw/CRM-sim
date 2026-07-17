import Link from "next/link";
import { listCustomers } from "@/db/queries/customers";
import { listProducts } from "@/db/queries/products";
import { listDistributors } from "@/db/queries/distributors";
import { listOrders } from "@/db/queries/orders";
import { PageHeader, Card, SectionHeader, EmptyState, TierBadge, OrderStatusBadge } from "@/app/components/ui";
import { formatCurrency } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = (q ?? "").trim();

  const [customers, products, distributors, orders] = query
    ? await Promise.all([
        listCustomers({ search: query }),
        listProducts({ search: query }),
        listDistributors({ search: query }),
        listOrders(), // order numbers are matched client-side below (small dataset)
      ])
    : [[], [], [], []];

  const matchedOrders = query
    ? orders.filter((o) => o.order_number.toLowerCase().includes(query.toLowerCase()))
    : [];

  const total = customers.length + products.length + distributors.length + matchedOrders.length;

  return (
    <div>
      <PageHeader
        icon="search"
        overline="Search"
        title={query ? `Results for "${query}"` : "Search"}
        subtitle={query ? `${total} matches across all objects` : "Enter a search term above"}
      />

      {!query ? (
        <EmptyState message="Search customers, products, distributors and orders from the bar above." />
      ) : total === 0 ? (
        <EmptyState message={`No records match "${query}".`} />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {customers.length > 0 && (
            <Card>
              <SectionHeader icon="customer" title="Customers" count={customers.length} />
              <ul className="divide-y divide-[#f3f3f3]">
                {customers.slice(0, 10).map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                    <Link href={`/customers/${c.id}`} className="truncate font-medium text-brand-600 hover:underline">
                      {c.first_name} {c.last_name}
                    </Link>
                    <TierBadge tier={c.tier} />
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {products.length > 0 && (
            <Card>
              <SectionHeader icon="product" title="Products" count={products.length} />
              <ul className="divide-y divide-[#f3f3f3]">
                {products.slice(0, 10).map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                    <Link href={`/products/${p.id}/edit`} className="truncate font-medium text-brand-600 hover:underline">
                      {p.name}
                    </Link>
                    <span className="text-[#706e6b]">{formatCurrency(p.unit_price)}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {distributors.length > 0 && (
            <Card>
              <SectionHeader icon="distributor" title="Distributors" count={distributors.length} />
              <ul className="divide-y divide-[#f3f3f3]">
                {distributors.slice(0, 10).map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                    <Link href={`/channel/distributors/${d.id}`} className="truncate font-medium text-brand-600 hover:underline">
                      {d.name}
                    </Link>
                    <span className="text-xs text-[#706e6b]">{d.status}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {matchedOrders.length > 0 && (
            <Card>
              <SectionHeader icon="order" title="Orders" count={matchedOrders.length} />
              <ul className="divide-y divide-[#f3f3f3]">
                {matchedOrders.slice(0, 10).map((o) => (
                  <li key={o.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                    <Link href={`/channel/orders/${o.id}`} className="truncate font-medium text-brand-600 hover:underline">
                      {o.order_number}
                    </Link>
                    <OrderStatusBadge status={o.status} />
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
