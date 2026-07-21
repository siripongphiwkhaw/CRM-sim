import Link from "next/link";
import { listSegments, parseSegmentRule } from "@/db/queries/segments";
import { PageHeader, Card, SectionHeader, EmptyState } from "@/app/components/ui";
import { formatDate } from "@/lib/format";
import { DeleteButton } from "@/app/components/form";
import { SegmentForm } from "./SegmentForm";
import { RefreshCountButton } from "./RefreshCountButton";
import { deleteSegmentAction } from "./actions";

export const dynamic = "force-dynamic";

function ruleSummary(rule: ReturnType<typeof parseSegmentRule>): string {
  const parts: string[] = [];
  if (rule.tier) parts.push(`Tier=${rule.tier}`);
  if (rule.brand) parts.push(`Brand=${rule.brand}`);
  if (rule.cust_type) parts.push(`Type=${rule.cust_type}`);
  if (rule.min_points != null) parts.push(`Points≥${rule.min_points}`);
  if (rule.churn_level) parts.push(`Churn=${rule.churn_level}`);
  if (rule.marketing_consent != null) parts.push(`Marketing=${rule.marketing_consent ? "granted" : "not granted"}`);
  return parts.length ? parts.join(" · ") : "All members";
}

export default async function SegmentsPage() {
  const segments = await listSegments();

  return (
    <div>
      <PageHeader
        icon="insights"
        overline="Marketing"
        title="Segments"
        subtitle="Reusable audiences for campaigns"
        action={
          <Link href="/marketing" className="text-sm font-medium text-brand-700">
            ← Marketing
          </Link>
        }
      />

      <Card>
        <SectionHeader title="Saved segments" count={segments.length} />
        {segments.length === 0 ? (
          <EmptyState message="No segments yet." />
        ) : (
          <ul className="divide-y divide-[#eef3f5]">
            {segments.map((s) => (
              <li key={s.id} className="flex items-start justify-between gap-3 py-3 text-sm">
                <div className="min-w-0">
                  <p className="font-medium text-[#14202b]">{s.name}</p>
                  <p className="mt-0.5 text-xs text-[#607785]">{ruleSummary(parseSegmentRule(s))}</p>
                  <p className="mt-0.5 text-[11px] text-[#607785]">Updated {formatDate(s.updated_at)}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <RefreshCountButton id={s.id} count={s.live_count} />
                  <DeleteButton
                    action={deleteSegmentAction}
                    id={s.id}
                    label="Delete"
                    confirmMessage={`Delete segment "${s.name}"? Campaigns already launched from it keep their audience snapshot.`}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4">
          <SegmentForm />
        </div>
      </Card>
    </div>
  );
}
