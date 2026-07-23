import { notFound } from "next/navigation";
import { getOrder, getOrderItems, getOrderStatusHistory } from "@/db/queries/orders";
import { listDeliveryPlans } from "@/db/queries/deliveryPlans";
import { listReceiptScans, getReceiptScanLines } from "@/db/queries/receiptScans";
import { ReceiptDetail, tryParseReceiptSummary } from "@/app/components/ReceiptDetail";
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
  DetailRow,
} from "@/app/components/ui";
import { formatCurrency, formatDate } from "@/lib/format";
import { ORDER_STATUS_LABELS } from "@/lib/orderWorkflow";
import { OrderActions } from "../OrderActions";
import { PlanDeliveryForm } from "../PlanDeliveryForm";
import { ReceiptScanCard } from "./ReceiptScanCard";

export const dynamic = "force-dynamic";

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
        <OrderActions
          orderId={order.id}
          status={order.status}
          isAdmin={session.role === "admin"}
          canApprove={session.role === "admin" || !!session.canApprove}
        />
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
            <div className="overflow-x-auto rounded border border-[#dde5e8]">
              <table className="min-w-full divide-y divide-[#dde5e8] text-sm">
                <thead className="bg-[#f8fafb] text-left text-xs font-semibold uppercase tracking-wide text-[#3c4f5e]">
                  <tr>
                    <th className="px-3 py-2">Product</th>
                    <th className="px-3 py-2 text-right">Unit price</th>
                    <th className="px-3 py-2 text-right">Qty</th>
                    <th className="px-3 py-2 text-right">Line total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#eef3f5]">
                  {items.map((it) => (
                    <tr key={it.id}>
                      <td className="px-3 py-2 text-[#14202b]">{it.product_name} <span className="font-mono text-xs text-[#607785]">({it.sku})</span></td>
                      <td className="px-3 py-2 text-right text-[#3c4f5e]">{formatCurrency(it.unit_price)}</td>
                      <td className="px-3 py-2 text-right text-[#3c4f5e]">{it.quantity}</td>
                      <td className="px-3 py-2 text-right font-medium text-[#14202b]">{formatCurrency(it.unit_price * it.quantity)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {deliveries.length > 0 && (
            <Card>
              <SectionHeader title="Delivery plans" count={deliveries.length} />
              <ul className="divide-y divide-[#eef3f5]">
                {deliveries.map((d) => (
                  <li key={d.id} className="flex items-center justify-between py-2 text-sm">
                    <span className="text-[#3c4f5e]">{d.product_name} · {d.planned_qty.toLocaleString("en-US")}</span>
                    <span className="text-xs text-[#607785]">{formatDate(d.plan_date)} · {d.status}</span>
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
                  <div key={scan.id} className="rounded border border-[#dde5e8] p-3">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-[#14202b]">
                          {scan.store_name || "Receipt"}
                          {scan.receipt_total != null && (
                            <span className="ml-2 font-normal text-[#607785]">
                              {formatCurrency(scan.receipt_total)}
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-[#607785]">
                          Scanned {formatDate(scan.created_at)} by {scan.created_by_name ?? "—"}
                          {scan.receipt_date ? ` · document date ${formatDate(scan.receipt_date)}` : ""}
                        </p>
                      </div>
                      <ScanMatchBadge status={scan.match_status} />
                    </div>
                    {scan.note && <p className="mb-2 text-xs text-[#607785]">{scan.note}</p>}
                    {lines.length > 0 && (
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                          <thead className="text-left text-xs font-semibold uppercase tracking-wide text-[#3c4f5e]">
                            <tr>
                              <th className="py-1.5 pr-2">On receipt</th>
                              <th className="py-1.5 pr-2 text-right">Qty / expected</th>
                              <th className="py-1.5 pr-2 text-right">Price / expected</th>
                              <th className="py-1.5 text-right">Check</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#eef3f5]">
                            {lines.map((line) => (
                              <tr key={line.id}>
                                <td className="py-1.5 pr-2 text-[#14202b]">
                                  {line.ocr_name}
                                  {line.product_name && (
                                    <span className="ml-1 text-xs text-[#607785]">→ {line.product_name}</span>
                                  )}
                                </td>
                                <td className="py-1.5 pr-2 text-right text-[#3c4f5e]">
                                  {line.quantity ?? "—"}
                                  {line.expected_quantity != null && ` / ${line.expected_quantity}`}
                                </td>
                                <td className="py-1.5 pr-2 text-right text-[#3c4f5e]">
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
                    {(() => {
                      const parsedReceipt = tryParseReceiptSummary(scan.raw_summary);
                      if (!parsedReceipt) return null;
                      return (
                        <details className="mt-3">
                          <summary className="cursor-pointer text-xs font-medium text-brand-700">
                            Full receipt details
                          </summary>
                          <div className="mt-2">
                            <ReceiptDetail receipt={parsedReceipt} />
                          </div>
                        </details>
                      );
                    })()}
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
                      <p className="text-[#14202b]">
                        {h.from_status ? `${ORDER_STATUS_LABELS[h.from_status]} → ` : ""}
                        <span className="font-medium">{ORDER_STATUS_LABELS[h.to_status]}</span>
                      </p>
                      <p className="text-xs text-[#607785]">
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
