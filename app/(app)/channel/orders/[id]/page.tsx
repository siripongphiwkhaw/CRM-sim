import { notFound } from "next/navigation";
import { getOrder, getOrderItems, getOrderStatusHistory } from "@/db/queries/orders";
import { listDeliveryPlans } from "@/db/queries/deliveryPlans";
import { listReceiptScans, getReceiptScanLines } from "@/db/queries/receiptScans";
import { isOcrConfigured } from "@/lib/receiptOcr";
import { getSession } from "@/lib/session";
import {
  PageHeader,
  Card,
  SectionHeader,
  OrderStatusBadge,
  ScanMatchBadge,
  LineMatchBadge,
  EmptyState,
} from "@/app/components/ui";
import { formatCurrency, formatDate } from "@/lib/format";
import { ORDER_STATUS_LABELS } from "@/lib/orderWorkflow";
import { OrderActions } from "../OrderActions";
import { PlanDeliveryForm } from "../PlanDeliveryForm";
import { ReceiptScanCard } from "./ReceiptScanCard";

export const dynamic = "force-dynamic";

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-[#f3f3f3] py-2 last:border-0">
      <dt className="text-xs text-[#706e6b]">{label}</dt>
      <dd className="text-right text-sm text-[#181818]">{value || "—"}</dd>
    </div>
  );
}

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const orderId = Number(id);
  const order = await getOrder(orderId);
  if (!order) notFound();

  const [items, history, deliveries, session, scans] = await Promise.all([
    getOrderItems(orderId),
    getOrderStatusHistory(orderId),
    listDeliveryPlans({ orderId }),
    getSession(),
    listReceiptScans({ orderId }),
  ]);
  const scansWithLines = await Promise.all(
    scans.map(async (scan) => ({ scan, lines: await getReceiptScanLines(scan.id) }))
  );

  return (
    <div>
      <PageHeader
        icon="order"
        overline="Order"
        title={order.order_number}
        subtitle={order.distributor_name}
        action={<OrderStatusBadge status={order.status} />}
      />

      <Card className="mb-4">
        <OrderActions orderId={order.id} status={order.status} isAdmin={session.role === "admin"} />
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-1">
          <Card>
            <SectionHeader title="Details" />
            <dl>
              <DetailRow label="Total" value={formatCurrency(order.total_amount)} />
              <DetailRow label="Requested delivery" value={formatDate(order.requested_delivery_date)} />
              <DetailRow label="Created" value={formatDate(order.created_at)} />
              <DetailRow label="Submitted" value={formatDate(order.submitted_at)} />
              <DetailRow label="Decided" value={formatDate(order.decided_at)} />
              {order.decision_note && (
                <DetailRow label="Decision note" value={order.decision_note} />
              )}
            </dl>
          </Card>

          {order.status === "approved" && (
            <Card>
              <SectionHeader title="Schedule delivery" />
              <PlanDeliveryForm orderId={order.id} />
            </Card>
          )}
        </div>

        <div className="space-y-4 lg:col-span-2">
          <Card>
            <SectionHeader title="Line items" count={items.length} />
            <div className="overflow-x-auto rounded border border-[#e5e5e5]">
              <table className="min-w-full divide-y divide-[#e5e5e5] text-sm">
                <thead className="bg-[#fafaf9] text-left text-xs font-semibold uppercase tracking-wide text-[#444]">
                  <tr>
                    <th className="px-3 py-2">Product</th>
                    <th className="px-3 py-2 text-right">Unit price</th>
                    <th className="px-3 py-2 text-right">Qty</th>
                    <th className="px-3 py-2 text-right">Line total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f3f3f3]">
                  {items.map((it) => (
                    <tr key={it.id}>
                      <td className="px-3 py-2 text-[#181818]">{it.product_name} <span className="font-mono text-xs text-[#706e6b]">({it.sku})</span></td>
                      <td className="px-3 py-2 text-right text-[#444]">{formatCurrency(it.unit_price)}</td>
                      <td className="px-3 py-2 text-right text-[#444]">{it.quantity}</td>
                      <td className="px-3 py-2 text-right font-medium text-[#181818]">{formatCurrency(it.unit_price * it.quantity)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {deliveries.length > 0 && (
            <Card>
              <SectionHeader title="Delivery plans" count={deliveries.length} />
              <ul className="divide-y divide-[#f3f3f3]">
                {deliveries.map((d) => (
                  <li key={d.id} className="flex items-center justify-between py-2 text-sm">
                    <span className="text-[#444]">{d.product_name} · {d.planned_qty.toLocaleString("en-US")}</span>
                    <span className="text-xs text-[#706e6b]">{formatDate(d.plan_date)} · {d.status}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card>
            <SectionHeader icon="audit" title="Receipt verification (OCR)" count={scans.length} />
            <ReceiptScanCard orderId={order.id} ocrConfigured={isOcrConfigured()} />
            {scansWithLines.length > 0 && (
              <div className="mt-4 space-y-4">
                {scansWithLines.map(({ scan, lines }) => (
                  <div key={scan.id} className="rounded border border-[#e5e5e5] p-3">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-[#181818]">
                          {scan.store_name || "Receipt"}
                          {scan.receipt_total != null && (
                            <span className="ml-2 font-normal text-[#706e6b]">
                              {formatCurrency(scan.receipt_total)}
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-[#706e6b]">
                          Scanned {formatDate(scan.created_at)} by {scan.created_by_name ?? "—"}
                          {scan.receipt_date ? ` · document date ${formatDate(scan.receipt_date)}` : ""}
                        </p>
                      </div>
                      <ScanMatchBadge status={scan.match_status} />
                    </div>
                    {scan.note && <p className="mb-2 text-xs text-[#706e6b]">{scan.note}</p>}
                    {lines.length > 0 && (
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                          <thead className="text-left text-xs font-semibold uppercase tracking-wide text-[#444]">
                            <tr>
                              <th className="py-1.5 pr-2">On receipt</th>
                              <th className="py-1.5 pr-2 text-right">Qty / expected</th>
                              <th className="py-1.5 pr-2 text-right">Price / expected</th>
                              <th className="py-1.5 text-right">Check</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#f3f3f3]">
                            {lines.map((line) => (
                              <tr key={line.id}>
                                <td className="py-1.5 pr-2 text-[#181818]">
                                  {line.ocr_name}
                                  {line.product_name && (
                                    <span className="ml-1 text-xs text-[#706e6b]">→ {line.product_name}</span>
                                  )}
                                </td>
                                <td className="py-1.5 pr-2 text-right text-[#444]">
                                  {line.quantity ?? "—"}
                                  {line.expected_quantity != null && ` / ${line.expected_quantity}`}
                                </td>
                                <td className="py-1.5 pr-2 text-right text-[#444]">
                                  {line.unit_price != null ? formatCurrency(line.unit_price) : "—"}
                                  {line.expected_price != null && ` / ${formatCurrency(line.expected_price)}`}
                                </td>
                                <td className="py-1.5 text-right">
                                  <LineMatchBadge status={line.match_status} />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <SectionHeader title="Status timeline" count={history.length} />
            {history.length === 0 ? (
              <EmptyState message="No status changes yet." />
            ) : (
              <ol className="space-y-3">
                {history.map((h) => (
                  <li key={h.id} className="flex items-start gap-3 text-sm">
                    <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-brand-600" />
                    <div>
                      <p className="text-[#181818]">
                        {h.from_status ? `${ORDER_STATUS_LABELS[h.from_status]} → ` : ""}
                        <span className="font-medium">{ORDER_STATUS_LABELS[h.to_status]}</span>
                      </p>
                      <p className="text-xs text-[#706e6b]">
                        {h.changed_by_name} · {formatDate(h.changed_at)}
                        {h.note ? ` · “${h.note}”` : ""}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
