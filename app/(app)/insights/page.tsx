import Link from "next/link";
import { listInsights } from "@/db/queries/insights";
import { PageHeader, Card, SectionHeader, SeverityBadge, EmptyState } from "@/app/components/ui";
import { formatDate } from "@/lib/format";
import { INSIGHT_SEVERITIES } from "@/lib/constants";
import { RegenerateButton, DismissButton } from "./InsightActions";

export const dynamic = "force-dynamic";

function entityHref(type: string | null, id: number | null): string | null {
  if (!id) return null;
  if (type === "customer") return `/customers/${id}`;
  if (type === "distributor") return `/channel/distributors/${id}`;
  return null;
}

export default async function InsightsPage() {
  const insights = await listInsights();
  const bySeverity = INSIGHT_SEVERITIES.map((sev) => ({
    severity: sev,
    items: insights.filter((i) => i.severity === sev),
  })).filter((g) => g.items.length > 0);

  return (
    <div>
      <PageHeader
        icon="insights"
        overline="AI"
        title="AI Insights"
        subtitle="Rule-based signals across loyalty, channel and consent"
        action={<RegenerateButton />}
      />

      {insights.length === 0 ? (
        <EmptyState message="No active insights. Press Regenerate to scan the current data." />
      ) : (
        <div className="space-y-4">
          {bySeverity.map((group) => (
            <Card key={group.severity}>
              <SectionHeader
                title={group.severity}
                count={group.items.length}
                action={<SeverityBadge severity={group.severity} />}
              />
              <ul className="space-y-3">
                {group.items.map((ins) => {
                  const href = entityHref(ins.entity_type, ins.entity_id);
                  return (
                    <li key={ins.id} className="rounded-[9px] border border-[#dde5e8] bg-[#f5f2ff] p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-[#14202b]">{ins.title}</p>
                          {ins.description && <p className="text-xs text-[#607785]">{ins.description}</p>}
                          {ins.recommendation && (
                            <p className="mt-1 text-xs text-ai-600">→ {ins.recommendation}</p>
                          )}
                          <p className="mt-1 text-[11px] text-[#607785]">
                            {ins.insight_type} · {formatDate(ins.created_at)}
                            {href ? " · " : ""}
                            {href && (
                              <Link href={href} className="text-brand-600 hover:underline">
                                view
                              </Link>
                            )}
                          </p>
                        </div>
                        <DismissButton id={ins.id} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
