import { listDistributorReports, getReportSummary, getReportBreakdown } from "@/db/queries/reports";
import { listDistributors } from "@/db/queries/distributors";
import { listProducts } from "@/db/queries/products";
import { PageHeader, Card, SectionHeader, EmptyState, SortableTh } from "@/app/components/ui";
import { formatDate } from "@/lib/format";
import { ReportForm } from "./ReportForm";

export const dynamic = "force-dynamic";

const filterClass =
  "rounded border border-[#c9c9c9] bg-white px-3 py-1.5 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600";

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
          <p className="text-xs text-[#706e6b]">Total sell-out</p>
          <p className="mt-0.5 text-xl font-bold text-[#181818]">{summary.total_sell_out.toLocaleString("en-US")}</p>
        </Card>
        <Card>
          <p className="text-xs text-[#706e6b]">Total forecast</p>
          <p className="mt-0.5 text-xl font-bold text-[#181818]">{summary.total_forecast.toLocaleString("en-US")}</p>
        </Card>
        <Card>
          <p className="text-xs text-[#706e6b]">Reports filed</p>
          <p className="mt-0.5 text-xl font-bold text-[#181818]">{summary.record_count}</p>
        </Card>
        <Card>
          <p className="text-xs text-[#706e6b]">Distributors reporting</p>
          <p className="mt-0.5 text-xl font-bold text-[#181818]">{summary.distributor_count}</p>
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
                  <span className="font-medium text-[#444]">{row.channel}</span>
                  <span className="text-[#706e6b]">{row.sell_out.toLocaleString("en-US")}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-sm bg-[#f3f3f3]">
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
        <button type="submit" className="rounded border border-[#c9c9c9] bg-white px-4 py-1.5 text-sm font-medium text-[#444] transition duration-150 hover:bg-[#f3f3f3] active:scale-[0.98]">
          Search
        </button>
      </form>

      {reports.length === 0 ? (
        <EmptyState message="No sell-out reports found." />
      ) : (
        <div className="overflow-x-auto rounded border border-[#e5e5e5] bg-white">
          <table className="min-w-full divide-y divide-[#e5e5e5] text-sm">
            <thead className="bg-[#fafaf9]">
              <tr>
                <SortableTh label="Distributor" column="distributor" params={params} baseHref="/channel/reports" />
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-[#444]">Product</th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-[#444]">Period</th>
                <SortableTh label="Sell-out" column="sellout" params={params} baseHref="/channel/reports" align="right" />
                <SortableTh label="Forecast" column="forecast" params={params} baseHref="/channel/reports" align="right" />
                <SortableTh label="Recorded" column="recorded" params={params} baseHref="/channel/reports" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f3f3f3]">
              {reports.map((r) => (
                <tr key={r.id} className="transition-colors hover:bg-[#f3f3f3]">
                  <td className="px-4 py-2.5 text-[#181818]">{r.distributor_name}</td>
                  <td className="px-4 py-2.5 text-[#444]">
                    {r.product_name} <span className="text-xs text-[#706e6b]">({r.brand})</span>
                  </td>
                  <td className="px-4 py-2.5 text-[#444]">{r.period}</td>
                  <td className="px-4 py-2.5 text-right text-[#444]">{r.sell_out_qty.toLocaleString("en-US")}</td>
                  <td className="px-4 py-2.5 text-right text-[#444]">{r.forecast_qty.toLocaleString("en-US")}</td>
                  <td className="px-4 py-2.5 text-xs text-[#706e6b]">{formatDate(r.recorded_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
