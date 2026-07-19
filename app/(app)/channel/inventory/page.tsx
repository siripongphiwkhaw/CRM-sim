import {
  listOnHandSummary,
  listInventoryTransactions,
  getTotalOnHandValue,
} from "@/db/queries/inventory";
import { listDeliveryPlans } from "@/db/queries/deliveryPlans";
import { listDistributors } from "@/db/queries/distributors";
import { listProducts } from "@/db/queries/products";
import { getSession } from "@/lib/session";
import { PageHeader, Card, SectionHeader, EmptyState } from "@/app/components/ui";
import { formatCurrency, formatDate } from "@/lib/format";
import { MarkDeliveredButton } from "./MarkDeliveredButton";
import { AdjustmentForm } from "./AdjustmentForm";

export const dynamic = "force-dynamic";

export default async function InventoryPage() {
  const [onHand, transactions, deliveries, totalValue, distributors, products, session] =
    await Promise.all([
      listOnHandSummary(),
      listInventoryTransactions(),
      listDeliveryPlans({ status: "planned" }),
      getTotalOnHandValue(),
      listDistributors({ status: "active" }),
      listProducts(),
      getSession(),
    ]);

  return (
    <div>
      <PageHeader
        icon="channel"
        overline="Sales & Channel"
        title="Inventory"
        subtitle="On-hand stock, transaction ledger and delivery plans"
      />

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Card>
          <p className="text-xs text-[#607785]">Total on-hand value</p>
          <p className="mt-0.5 text-xl font-bold text-[#14202b]">{formatCurrency(totalValue)}</p>
        </Card>
        <Card>
          <p className="text-xs text-[#607785]">Distributor/product lines with stock</p>
          <p className="mt-0.5 text-xl font-bold text-[#14202b]">{onHand.length}</p>
        </Card>
        <Card>
          <p className="text-xs text-[#607785]">Deliveries pending</p>
          <p className="mt-0.5 text-xl font-bold text-[#14202b]">{deliveries.length}</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <SectionHeader title="On-hand by distributor" count={onHand.length} />
          {onHand.length === 0 ? (
            <EmptyState message="No stock recorded yet." />
          ) : (
            <div className="max-h-96 overflow-auto">
              <table className="min-w-full text-sm">
                <tbody className="divide-y divide-[#eef3f5]">
                  {onHand.map((row) => (
                    <tr key={`${row.distributor_id}-${row.product_id}`}>
                      <td className="py-2 pr-2">
                        <p className="text-[#14202b]">{row.product_name}</p>
                        <p className="text-xs text-[#607785]">{row.distributor_name}</p>
                      </td>
                      <td className="py-2 text-right font-medium text-[#14202b]">
                        {row.on_hand.toLocaleString("en-US")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card>
          <SectionHeader title="Pending deliveries" count={deliveries.length} />
          {deliveries.length === 0 ? (
            <EmptyState message="No deliveries scheduled." />
          ) : (
            <ul className="divide-y divide-[#eef3f5]">
              {deliveries.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <div className="min-w-0">
                    <p className="truncate text-[#14202b]">{d.product_name} · {d.planned_qty.toLocaleString("en-US")}</p>
                    <p className="text-xs text-[#607785]">{d.distributor_name} · {formatDate(d.plan_date)}</p>
                  </div>
                  <MarkDeliveredButton id={d.id} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {session.role === "admin" && (
        <div className="mt-4">
          <Card>
            <SectionHeader title="Manual adjustment" />
            <AdjustmentForm distributors={distributors} products={products} />
          </Card>
        </div>
      )}

      <div className="mt-4">
        <Card>
          <SectionHeader title="Transaction ledger" count={transactions.length} />
          {transactions.length === 0 ? (
            <EmptyState message="No transactions yet." />
          ) : (
            <div className="max-h-96 overflow-auto">
              <table className="min-w-full text-sm">
                <thead className="sticky top-0 bg-white text-left text-xs font-semibold uppercase tracking-wide text-[#3c4f5e]">
                  <tr>
                    <th className="py-1.5">Distributor</th>
                    <th className="py-1.5">Product</th>
                    <th className="py-1.5">Type</th>
                    <th className="py-1.5 text-right">Qty</th>
                    <th className="py-1.5">When</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#eef3f5]">
                  {transactions.map((t) => (
                    <tr key={t.id}>
                      <td className="py-1.5 text-[#3c4f5e]">{t.distributor_name}</td>
                      <td className="py-1.5 text-[#3c4f5e]">{t.product_name}</td>
                      <td className="py-1.5 text-[#607785]">{t.txn_type}</td>
                      <td className={`py-1.5 text-right font-medium ${t.quantity < 0 ? "text-[#8e030f]" : "text-[#194e31]"}`}>
                        {t.quantity > 0 ? "+" : ""}{t.quantity.toLocaleString("en-US")}
                      </td>
                      <td className="py-1.5 text-xs text-[#607785]">{formatDate(t.occurred_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
