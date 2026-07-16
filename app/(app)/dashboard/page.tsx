import Link from "next/link";
import {
  getOverview,
  getTierDistribution,
  getBrandDistribution,
  getDataLevelDistribution,
} from "@/db/queries/analytics";
import { listRecentInteractions } from "@/db/queries/interactions";
import { Card, InteractionBadge, TierBadge } from "@/app/components/ui";
import { formatCurrency, formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <Card>
      <p className="text-sm text-stone-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${accent ?? "text-stone-900"}`}>
        {value}
      </p>
    </Card>
  );
}

function BarList({
  title,
  rows,
}: {
  title: string;
  rows: { label: string; count: number }[];
}) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <Card>
      <h2 className="mb-4 text-lg font-medium text-stone-900">{title}</h2>
      <div className="space-y-3">
        {rows.map((r) => (
          <div key={r.label}>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="font-medium text-stone-700">{r.label}</span>
              <span className="text-stone-500">{r.count}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-stone-100">
              <div
                className="h-full rounded-full bg-brand-600"
                style={{ width: `${(r.count / max) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

export default async function DashboardPage() {
  const [overview, tiers, brands, levels, recent] = await Promise.all([
    getOverview(),
    getTierDistribution(),
    getBrandDistribution(),
    getDataLevelDistribution(),
    listRecentInteractions(8),
  ]);

  const consentPct =
    overview.total_customers > 0
      ? Math.round((overview.consent_pdpa / overview.total_customers) * 100)
      : 0;

  const maxTier = Math.max(1, ...tiers.map((x) => x.count));

  return (
    <div>
      <div className="mb-6 overflow-hidden rounded-2xl bg-gradient-to-r from-brand-600 via-brand-500 to-brand-700 px-8 py-7 shadow-sm">
        <h1 className="font-display text-3xl text-white">Analytics Dashboard</h1>
        <p className="mt-1 text-sm text-brand-100">
          สุขภาพดี เริ่มต้นที่นี่ — loyalty overview across {overview.brands} brands ·{" "}
          {overview.total_customers} members
        </p>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Total members" value={String(overview.total_customers)} />
        <Stat
          label="Active (90d)"
          value={String(overview.active_customers)}
          accent="text-brand-600"
        />
        <Stat
          label="Avg. CLV"
          value={formatCurrency(overview.avg_clv)}
          accent="text-emerald-600"
        />
        <Stat
          label="Repeat purchase rate"
          value={`${overview.repeat_rate.toFixed(1)}%`}
        />
      </div>

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat
          label="Total CLV"
          value={formatCurrency(overview.total_clv)}
          accent="text-emerald-600"
        />
        <Stat
          label="Points issued"
          value={overview.total_points.toLocaleString("en-US")}
        />
        <Stat
          label="PDPA consent"
          value={`${consentPct}%`}
          accent={consentPct >= 80 ? "text-emerald-600" : "text-amber-600"}
        />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card>
          <h2 className="mb-4 text-lg font-medium text-stone-900">Members by tier</h2>
          <div className="space-y-3">
            {tiers.map((t) => (
              <div key={t.tier}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <TierBadge tier={t.tier} />
                  <span className="text-stone-500">{t.count}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-stone-100">
                  <div
                    className="h-full rounded-full bg-brand-600"
                    style={{ width: `${(t.count / maxTier) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>
        <BarList title="Members by brand" rows={brands} />
        <BarList title="Data collection level" rows={levels} />
      </div>

      <Card>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-medium text-stone-900">Recent activity</h2>
          <Link href="/customers" className="text-sm text-brand-700 hover:underline">
            View members →
          </Link>
        </div>
        {recent.length === 0 ? (
          <p className="text-sm text-stone-500">No activity yet.</p>
        ) : (
          <ul className="divide-y divide-stone-100">
            {recent.map((a) => (
              <li key={a.id} className="flex items-center gap-3 py-2 text-sm">
                <InteractionBadge type={a.type} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-stone-800">{a.description}</p>
                  <p className="text-xs text-stone-400">
                    {a.customer_name} · {a.member_code} · {formatDate(a.occurred_at)}
                  </p>
                </div>
                {a.amount > 0 && (
                  <span className="shrink-0 text-sm text-stone-600">
                    {formatCurrency(a.amount)}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
