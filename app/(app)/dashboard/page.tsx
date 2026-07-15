import Link from "next/link";
import {
  getDealsByStage,
  getOpenPipelineValue,
  getWonValue,
  getUpcomingTaskCount,
  getOverdueTaskCount,
  getRecentActivity,
  getCounts,
} from "@/db/queries/dashboard";
import { Card, TaskTypeBadge } from "@/app/components/ui";
import { formatCurrency, formatDate } from "@/lib/format";
import type { TaskType } from "@/lib/constants";

export const dynamic = "force-dynamic";

function Stat({
  label,
  value,
  href,
  accent,
}: {
  label: string;
  value: string;
  href?: string;
  accent?: string;
}) {
  const inner = (
    <Card className={href ? "transition-shadow hover:shadow-md" : ""}>
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${accent ?? "text-slate-900"}`}>
        {value}
      </p>
    </Card>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

export default function DashboardPage() {
  const dealsByStage = getDealsByStage();
  const openPipeline = getOpenPipelineValue();
  const wonValue = getWonValue();
  const upcoming = getUpcomingTaskCount();
  const overdue = getOverdueTaskCount();
  const recent = getRecentActivity(8);
  const counts = getCounts();

  const totalDeals = dealsByStage.reduce((sum, s) => sum + s.count, 0);
  const maxCount = Math.max(1, ...dealsByStage.map((s) => s.count));

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-slate-900">Dashboard</h1>

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Open pipeline value"
          value={formatCurrency(openPipeline)}
          accent="text-indigo-600"
        />
        <Stat
          label="Won value"
          value={formatCurrency(wonValue)}
          accent="text-emerald-600"
        />
        <Stat
          label="Upcoming tasks"
          value={String(upcoming)}
          href="/tasks"
        />
        <Stat
          label="Overdue tasks"
          value={String(overdue)}
          href="/tasks?filter=overdue"
          accent={overdue > 0 ? "text-rose-600" : "text-slate-900"}
        />
      </div>

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat label="Contacts" value={String(counts.contacts)} href="/contacts" />
        <Stat label="Companies" value={String(counts.companies)} href="/companies" />
        <Stat label="Deals" value={String(counts.deals)} href="/deals" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-medium text-slate-900">Pipeline by stage</h2>
            <Link href="/deals" className="text-sm text-indigo-600 hover:underline">
              View board →
            </Link>
          </div>
          <div className="space-y-3">
            {dealsByStage.map((s) => (
              <div key={s.stage}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="font-medium text-slate-700">{s.stage}</span>
                  <span className="text-slate-500">
                    {s.count} · {formatCurrency(s.value)}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-indigo-500"
                    style={{ width: `${(s.count / maxCount) * 100}%` }}
                  />
                </div>
              </div>
            ))}
            <p className="pt-2 text-sm text-slate-500">{totalDeals} deals total</p>
          </div>
        </Card>

        <Card>
          <h2 className="mb-4 text-lg font-medium text-slate-900">Recent activity</h2>
          {recent.length === 0 ? (
            <p className="text-sm text-slate-500">No activity yet.</p>
          ) : (
            <ul className="space-y-3">
              {recent.map((a) => (
                <li key={a.id} className="flex items-start gap-3 text-sm">
                  <TaskTypeBadge type={a.type as TaskType} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-slate-800">{a.subject}</p>
                    <p className="text-xs text-slate-400">
                      {a.contact_name ?? a.deal_title ?? "General"} ·{" "}
                      {formatDate(a.created_at)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
