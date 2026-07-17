import Link from "next/link";
import { listOrders } from "@/db/queries/orders";
import { ORDER_STATUSES } from "@/lib/orderWorkflow";
import { PageHeader, LinkButton, EmptyState, OrderStatusBadge, SortableTh } from "@/app/components/ui";
import { formatCurrency, formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

const filterClass =
  "rounded border border-[#c9c9c9] bg-white px-3 py-1.5 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600";

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; sort?: string; dir?: string; created?: string }>;
}) {
  const { status, sort, dir, created } = await searchParams;
  const orders = await listOrders({ status, sort, dir });
  const params = { status, sort, dir };

  return (
    <div>
      <PageHeader
        icon="order"
        overline="Sales & Channel"
        title="Orders"
        subtitle={`${orders.length} records`}
        action={<LinkButton href="/channel/orders/new">New</LinkButton>}
      />

      {created && (
        <div className="mb-3 rounded border border-[#9be6ae] bg-[#cdefc4] px-3 py-2 text-sm text-[#194e31]">
          Order {created} created as a draft.
        </div>
      )}

      <form method="get" className="mb-3 flex flex-wrap gap-2">
        <select name="status" defaultValue={status ?? ""} className={filterClass}>
          <option value="">All statuses</option>
          {ORDER_STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <button type="submit" className="rounded border border-[#c9c9c9] bg-white px-4 py-1.5 text-sm font-medium text-[#444] hover:bg-[#f3f3f3]">
          Filter
        </button>
      </form>

      {orders.length === 0 ? (
        <EmptyState message="No orders match your filters." />
      ) : (
        <div className="overflow-x-auto rounded border border-[#e5e5e5] bg-white">
          <table className="min-w-full divide-y divide-[#e5e5e5] text-sm">
            <thead className="bg-[#fafaf9]">
              <tr>
                <SortableTh label="Order #" column="number" params={params} baseHref="/channel/orders" />
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-[#444]">Distributor</th>
                <SortableTh label="Status" column="status" params={params} baseHref="/channel/orders" />
                <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wide text-[#444]">Total</th>
                <SortableTh label="Created" column="created" params={params} baseHref="/channel/orders" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f3f3f3]">
              {orders.map((o) => (
                <tr key={o.id} className="hover:bg-[#f3f3f3]">
                  <td className="px-4 py-2.5">
                    <Link href={`/channel/orders/${o.id}`} className="font-medium text-brand-600 hover:underline">
                      {o.order_number}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-[#444]">{o.distributor_name}</td>
                  <td className="px-4 py-2.5"><OrderStatusBadge status={o.status} /></td>
                  <td className="px-4 py-2.5 text-right text-[#444]">{formatCurrency(o.total_amount)}</td>
                  <td className="px-4 py-2.5 text-[#706e6b]">{formatDate(o.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
