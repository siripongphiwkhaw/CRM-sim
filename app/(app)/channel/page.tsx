import { listChannelRecords, getChannelSummary } from "@/db/queries/channel";
import { PageHeader, Card, EmptyState } from "@/app/components/ui";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <p className="text-sm text-stone-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-stone-900">{value}</p>
    </Card>
  );
}

export default async function ChannelPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const [summary, records] = await Promise.all([
    getChannelSummary(),
    listChannelRecords({ search: q }),
  ]);

  const num = (n: number) => n.toLocaleString("en-US");

  return (
    <div>
      <PageHeader
        title="Sales & Channel"
        subtitle="Sell-out, inventory and demand forecast across dealers"
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Total sell-out" value={num(summary.total_sell_out)} />
        <Stat label="Stock on hand" value={num(summary.total_stock)} />
        <Stat label="Forecast demand" value={num(summary.total_forecast)} />
        <Stat label="Dealers" value={num(summary.dealer_count)} />
      </div>

      <form method="get" className="mb-4">
        <input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search dealer or product…"
          className="w-full max-w-sm rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
        />
      </form>

      {records.length === 0 ? (
        <EmptyState message="No channel records found." />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-stone-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-stone-200 text-sm">
            <thead className="bg-stone-50 text-left text-xs font-medium uppercase tracking-wide text-stone-500">
              <tr>
                <th className="px-4 py-3">Dealer</th>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Channel</th>
                <th className="px-4 py-3 text-right">Sell-out</th>
                <th className="px-4 py-3 text-right">Stock</th>
                <th className="px-4 py-3 text-right">Forecast</th>
                <th className="px-4 py-3">Recorded</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {records.map((r) => (
                <tr key={r.id} className="hover:bg-stone-50">
                  <td className="px-4 py-3 text-stone-800">{r.dealer_name}</td>
                  <td className="px-4 py-3 text-stone-600">
                    {r.product_name ?? "—"}
                    {r.brand && <span className="ml-1 text-xs text-stone-400">({r.brand})</span>}
                  </td>
                  <td className="px-4 py-3 text-stone-600">{r.channel ?? "—"}</td>
                  <td className="px-4 py-3 text-right text-stone-600">{num(r.sell_out_qty)}</td>
                  <td className="px-4 py-3 text-right text-stone-600">{num(r.stock_on_hand)}</td>
                  <td className="px-4 py-3 text-right text-stone-600">{num(r.forecast_qty)}</td>
                  <td className="px-4 py-3 text-stone-500">{formatDate(r.recorded_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
