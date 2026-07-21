import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getDistributor,
  hasActiveOrders,
} from "@/db/queries/distributors";
import { listOnHandByDistributor } from "@/db/queries/inventory";
import { listOrders } from "@/db/queries/orders";
import { listDeliveryPlans } from "@/db/queries/deliveryPlans";
import { listDistributorReports } from "@/db/queries/reports";
import {
  PageHeader,
  LinkButton,
  Card,
  SectionHeader,
  OrderStatusBadge,
  EmptyState,
  DetailRow,
} from "@/app/components/ui";
import { DeleteButton, FormError } from "@/app/components/form";
import { formatCurrency, formatDate } from "@/lib/format";
import { deleteDistributorAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function DistributorDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const distributor = await getDistributor(Number(id));
  if (!distributor) notFound();

  const [onHand, orders, deliveries, reports, blockedDelete] = await Promise.all([
    listOnHandByDistributor(distributor.id),
    listOrders({ distributorId: distributor.id }),
    listDeliveryPlans({ distributorId: distributor.id }),
    listDistributorReports({ distributorId: distributor.id }),
    hasActiveOrders(distributor.id),
  ]);

  return (
    <div>
      <PageHeader
        icon="distributor"
        overline="Distributor"
        title={distributor.name}
        subtitle={distributor.distributor_code}
        action={
          <div className="flex items-center gap-2">
            <LinkButton href={`/channel/distributors/${distributor.id}/edit`} variant="secondary">
              Edit
            </LinkButton>
            <DeleteButton
              action={deleteDistributorAction}
              id={distributor.id}
              confirmMessage={
                blockedDelete
                  ? `${distributor.name} has active orders and cannot be deleted.`
                  : `Delete ${distributor.name}?`
              }
            />
          </div>
        }
      />

      {error === "has-active-orders" && (
        <div className="mb-4">
          <FormError message="This distributor has active (non-terminal) orders and cannot be deleted." />
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-1">
          <Card>
            <SectionHeader title="Details" />
            <dl>
              <DetailRow
                label="Status"
                value={
                  <span className={distributor.status === "active" ? "text-[#194e31]" : "text-[#607785]"}>
                    {distributor.status}
                  </span>
                }
              />
              <DetailRow label="Region" value={distributor.region} />
              <DetailRow label="Channel" value={distributor.channel} />
              <DetailRow label="Contact" value={distributor.contact_name} />
              <DetailRow label="Phone" value={distributor.phone} />
              <DetailRow label="Email" value={distributor.email} />
              <DetailRow label="Address" value={distributor.address} />
              <DetailRow label="Credit limit" value={formatCurrency(distributor.credit_limit)} />
            </dl>
          </Card>

          <Card>
            <SectionHeader title="On-hand inventory" count={onHand.length} />
            {onHand.length === 0 ? (
              <EmptyState message="No stock on hand." />
            ) : (
              <ul className="divide-y divide-[#eef3f5]">
                {onHand.map((row) => (
                  <li key={row.product_id} className="flex items-center justify-between py-2 text-sm">
                    <span className="text-[#3c4f5e]">{row.name}</span>
                    <span className="font-medium text-[#14202b]">{row.on_hand.toLocaleString("en-US")}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-4 lg:col-span-2">
          <Card>
            <SectionHeader
              icon="order"
              title="Orders"
              count={orders.length}
              action={
                <Link href={`/channel/orders/new?distributor=${distributor.id}`} className="text-xs text-brand-600 hover:underline">
                  + New order
                </Link>
              }
            />
            {orders.length === 0 ? (
              <EmptyState message="No orders yet." />
            ) : (
              <ul className="divide-y divide-[#eef3f5]">
                {orders.map((o) => (
                  <li key={o.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <Link href={`/channel/orders/${o.id}`} className="truncate font-medium text-brand-600 hover:underline">
                      {o.order_number}
                    </Link>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="text-[#3c4f5e]">{formatCurrency(o.total_amount)}</span>
                      <OrderStatusBadge status={o.status} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <SectionHeader title="Delivery plans" count={deliveries.length} />
            {deliveries.length === 0 ? (
              <EmptyState message="No deliveries scheduled." />
            ) : (
              <ul className="divide-y divide-[#eef3f5]">
                {deliveries.map((d) => (
                  <li key={d.id} className="flex items-center justify-between py-2 text-sm">
                    <span className="text-[#3c4f5e]">{d.product_name} · {d.planned_qty.toLocaleString("en-US")}</span>
                    <span className="text-xs text-[#607785]">{formatDate(d.plan_date)} · {d.status}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <SectionHeader title="Sell-out reports" count={reports.length} />
            {reports.length === 0 ? (
              <EmptyState message="No sell-out reports yet." />
            ) : (
              <ul className="divide-y divide-[#eef3f5]">
                {reports.map((r) => (
                  <li key={r.id} className="flex items-center justify-between py-2 text-sm">
                    <span className="text-[#3c4f5e]">{r.product_name} · {r.period}</span>
                    <span className="text-xs text-[#607785]">
                      sold {r.sell_out_qty.toLocaleString("en-US")} · forecast {r.forecast_qty.toLocaleString("en-US")}
                    </span>
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
