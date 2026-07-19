import { listDistributorReports, getReportSummary, getReportBreakdown } from "@/db/queries/reports";
import { listDistributors } from "@/db/queries/distributors";
import { listProducts } from "@/db/queries/products";
import { PageHeader, Card, SectionHeader, EmptyState, SortableTh } from "@/app/components/ui";
import { formatDate } from "@/lib/format";
import { ReportForm } from "./ReportForm";

export const dynamic = "force-dynamic";

const filterClass =
  "rounded border border-[#c2d0d6] bg-white px-3 py-1.5 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; sort?: string; dir?: string }>;
}) {
  const { q, sort, dir } = await searchParams;
  const [reports, summary, breakdown, distributors, products] = await Promise.all([
    listDistributorReports({ search: q, sort, dir }),
    getReportSummary(),
    getReportBreakdown(),
    listDistributors({ status: "active" }),
    listProducts(),
  ]);
  const params = { q, sort, dir };

  return (
    <div>
      <PageHeader
        icon="channel"
        overline="Sales & Channel"
        title="Sell-out Reports"
        subtitle="Sell-out actuals and demand forecast by distributor"
      />

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <p className="text-xs text-[#607785]">Total sell-out</p>
          <p className="mt-0.5 text-xl font-bold text-[#14202b]">{summary.total_sell_out.toLocaleString("en-US")}</p>
        </Card>
        <Card>
          <p className="text-xs text-[#607785]">Total forecast</p>
          <p className="mt-0.5 text-xl font-bold text-[#14202b]">{summary.total_forecast.toLocaleString("en-US")}</p>
        </Card>
        <Card>
          <p className="text-xs text-[#607785]">Reports filed</p>
          <p className="mt-0.5 text-xl font-bold text-[#14202b]">{summary.record_count}</p>
        </Card>
        <Card>
          <p className="text-xs text-[#607785]">Distributors reporting</p>
          <p className="mt-0.5 text-xl font-bold text-[#14202b]">{summary.distributor_count}</p>
        </Card>
      </div>

      <Card className="mb-4">
        <SectionHeader title="Sell-out by trade channel" />
        <div className="space-y-2.5">
          {breakdown.map((row) => {
            const max = Math.max(1, ...breakdown.map((r) => r.sell_out));
            return (
              <div key={row.channel}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="font-medium text-[#3c4f5e]">{row.channel}</span>
                  <span className="text-[#607785]">{row.sell_out.toLocaleString("en-US")}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-sm bg-[#eef3f5]">
                  <div className="h-full rounded-sm bg-brand-600" style={{ width: `${(row.sell_out / max) * 100}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <div className="mb-4">
        <ReportForm distributors={distributors} products={products} />
      </div>

      <form method="get" className="mb-3 flex flex-wrap gap-2">
        <input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search distributor or product…"
          className={`w-full max-w-xs ${filterClass}`}
        />
        <button type="submit" className="rounded border border-[#c2d0d6] bg-white px-4 py-1.5 text-sm font-medium text-[#3c4f5e] transition duration-150 hover:bg-[#eef3f5] active:scale-[0.98]">
          Search
        </button>
      </form>

      {reports.length === 0 ? (
        <EmptyState message="No sell-out reports found." />
      ) : (
        <div className="overflow-x-auto rounded border border-[#dde5e8] bg-white">
          <table className="min-w-full divide-y divide-[#dde5e8] text-sm">
            <thead className="bg-[#f8fafb]">
              <tr>
                <SortableTh label="Distributor" column="distributor" params={params} baseHref="/channel/reports" />
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-[#3c4f5e]">Product</th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-[#3c4f5e]">Period</th>
                <SortableTh label="Sell-out" column="sellout" params={params} baseHref="/channel/reports" align="right" />
                <SortableTh label="Forecast" column="forecast" params={params} baseHref="/channel/reports" align="right" />
                <SortableTh label="Recorded" column="recorded" params={params} baseHref="/channel/reports" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[#eef3f5]">
              {reports.map((r) => (
                <tr key={r.id} className="transition-colors hover:bg-[#eef3f5]">
                  <td className="px-4 py-2.5 text-[#14202b]">{r.distributor_name}</td>
                  <td className="px-4 py-2.5 text-[#3c4f5e]">
                    {r.product_name} <span className="text-xs text-[#607785]">({r.brand})</span>
                  </td>
                  <td className="px-4 py-2.5 text-[#3c4f5e]">{r.period}</td>
                  <td className="px-4 py-2.5 text-right text-[#3c4f5e]">{r.sell_out_qty.toLocaleString("en-US")}</td>
                  <td className="px-4 py-2.5 text-right text-[#3c4f5e]">{r.forecast_qty.toLocaleString("en-US")}</td>
                  <td className="px-4 py-2.5 text-xs text-[#607785]">{formatDate(r.recorded_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
