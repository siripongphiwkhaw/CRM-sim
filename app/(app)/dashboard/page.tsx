import Link from "next/link";
import {
  getOverview,
  getTierDistribution,
  getBrandDistribution,
  getMonthlyPurchases,
  getMembersWithoutPdpa,
} from "@/db/queries/analytics";
import { listRecentInteractions } from "@/db/queries/interactions";
import { listRecentCustomers, getTopCustomer } from "@/db/queries/customers";
import { listDataSources } from "@/db/queries/dataSources";
import {
  Card,
  SectionHeader,
  InteractionBadge,
  TierBadge,
  ObjectIcon,
} from "@/app/components/ui";
import { PerformanceChart } from "@/app/components/PerformanceChart";
import { formatCurrency, formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

function Kpi({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded border border-[#dde5e8] bg-white px-4 py-3">
      <p className="text-xs text-[#607785]">{label}</p>
      <p className={`mt-0.5 text-xl font-bold ${accent ?? "text-[#14202b]"}`}>{value}</p>
    </div>
  );
}

function BarList({ title, rows }: { title: string; rows: { label: string; count: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <Card>
      <SectionHeader title={title} />
      <div className="space-y-2.5">
        {rows.map((r) => (
          <div key={r.label} title={`${r.label}: ${r.count}`}>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="font-medium text-[#3c4f5e]">{r.label}</span>
              <span className="text-[#607785]">{r.count}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-sm bg-[#eef3f5]">
              <div
                className="h-full rounded-sm bg-brand-600"
                style={{ width: `${(r.count / max) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

export default async function HomePage() {
  const [overview, tiers, brands, monthly, noPdpa, recentActivity, recentCustomers, topCustomer, sources] =
    await Promise.all([
      getOverview(),
      getTierDistribution(),
      getBrandDistribution(),
      getMonthlyPurchases(),
      getMembersWithoutPdpa(),
      listRecentInteractions(6),
      listRecentCustomers(5),
      getTopCustomer(),
      listDataSources(),
    ]);

  const unhealthySources = sources.filter((s) => s.status !== "connected");

  const insights: { icon: string; text: React.ReactNode }[] = [];
  if (noPdpa > 0) {
    insights.push({
      icon: "⚠️",
      text: (
        <>
          <Link href="/customers" className="font-medium text-brand-600 hover:underline">
            {noPdpa} members
          </Link>{" "}
          have not granted marketing consent — review before the next campaign.
        </>
      ),
    });
  }
  if (unhealthySources.length > 0) {
    insights.push({
      icon: "🔄",
      text: (
        <>
          <Link href="/data-cloud" className="font-medium text-brand-600 hover:underline">
            {unhealthySources.length} data source{unhealthySources.length > 1 ? "s" : ""}
          </Link>{" "}
          {unhealthySources.length > 1 ? "are" : "is"} not fully connected.
        </>
      ),
    });
  }
  if (topCustomer) {
    insights.push({
      icon: "⭐",
      text: (
        <>
          Top member{" "}
          <Link href={`/customers/${topCustomer.id}`} className="font-medium text-brand-600 hover:underline">
            {topCustomer.first_name} {topCustomer.last_name}
          </Link>{" "}
          has a lifetime value of {formatCurrency(topCustomer.clv)}.
        </>
      ),
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi label="Total members" value={String(overview.total_customers)} />
        <Kpi label="Active (90d)" value={String(overview.active_customers)} accent="text-brand-600" />
        <Kpi label="Total CLV" value={formatCurrency(overview.total_clv)} accent="text-[#2e844a]" />
        <Kpi label="Repeat purchase" value={`${overview.repeat_rate.toFixed(1)}%`} />
        <Kpi label="Points issued" value={overview.total_points.toLocaleString("en-US")} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <SectionHeader
            title="Loyalty Performance — purchase revenue (6 months)"
            action={
              <Link href="/customers" className="text-xs text-brand-600 hover:underline">
                View members
              </Link>
            }
          />
          <PerformanceChart data={monthly} />
        </Card>

        <Card>
          <SectionHeader title="Insights" />
          {insights.length === 0 ? (
            <p className="text-sm text-[#607785]">Everything looks healthy today.</p>
          ) : (
            <ul className="space-y-3">
              {insights.map((ins, i) => (
                <li key={i} className="flex items-start gap-2 border-b border-[#eef3f5] pb-3 text-sm text-[#3c4f5e] last:border-0 last:pb-0">
                  <span aria-hidden>{ins.icon}</span>
                  <span>{ins.text}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <SectionHeader icon="customer" title="Recent Records" count={recentCustomers.length} />
          <ul className="divide-y divide-[#eef3f5]">
            {recentCustomers.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-2 py-2">
                <div className="min-w-0">
                  <Link href={`/customers/${c.id}`} className="block truncate text-sm font-medium text-brand-600 hover:underline">
                    {c.first_name} {c.last_name}
                  </Link>
                  <p className="text-xs text-[#607785]">{c.member_code} · {c.brand}</p>
                </div>
                <TierBadge tier={c.tier} />
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <SectionHeader title="Recent Activity" count={recentActivity.length} />
          <ul className="divide-y divide-[#eef3f5]">
            {recentActivity.map((a) => (
              <li key={a.id} className="flex items-center gap-2 py-2 text-sm">
                <InteractionBadge type={a.type} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[#3c4f5e]">{a.description}</p>
                  <p className="text-xs text-[#607785]">{a.customer_name} · {formatDate(a.occurred_at)}</p>
                </div>
                {a.amount > 0 && (
                  <span className="shrink-0 text-xs text-[#3c4f5e]">{formatCurrency(a.amount)}</span>
                )}
              </li>
            ))}
          </ul>
        </Card>

        <div className="space-y-4">
          <BarList title="Members by tier" rows={tiers.map((t) => ({ label: t.tier, count: t.count }))} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <BarList title="Members by brand" rows={brands} />
        <Card>
          <SectionHeader icon="datacloud" title="Data Cloud" count={sources.length} />
          <ul className="divide-y divide-[#eef3f5]">
            {sources.map((s) => (
              <li key={s.id} className="flex items-center justify-between py-2 text-sm">
                <span className="text-[#3c4f5e]">{s.name}</span>
                <span className={`text-xs ${s.status === "connected" ? "text-[#2e844a]" : "text-[#dd7a01]"}`}>
                  {s.status}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {/* decorative footer nod to the classic Lightning home */}
      <p className="flex items-center gap-2 text-xs text-[#607785]">
        <ObjectIcon kind="home" size="sm" /> Loyalty Cloud — demo environment
      </p>
    </div>
  );
}
