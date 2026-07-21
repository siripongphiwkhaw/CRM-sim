import Link from "next/link";
import { listCampaigns } from "@/db/queries/campaigns";
import { listSegments } from "@/db/queries/segments";
import { PageHeader, Card, SectionHeader, EmptyState } from "@/app/components/ui";
import { formatDate } from "@/lib/format";
import { CampaignForm } from "./CampaignForm";

export const dynamic = "force-dynamic";

const STATUS_TONE: Record<string, string> = {
  DRAFT: "bg-[#e5eaec] text-[#514f4d]",
  SCHEDULED: "bg-[#fff5ec] text-[#8a4b1e]",
  RUNNING: "bg-[#cdefc4] text-[#194e31]",
  PAUSED: "bg-[#feded8] text-[#8e030f]",
  DONE: "bg-[#e5eaec] text-[#514f4d]",
};

export default async function CampaignsPage() {
  const [campaigns, segments] = await Promise.all([listCampaigns(), listSegments()]);

  return (
    <div>
      <PageHeader
        icon="insights"
        overline="Marketing"
        title="Campaigns"
        subtitle="Simulated multi-channel sends to a segment"
        action={
          <Link href="/marketing" className="text-sm font-medium text-brand-700">
            ← Marketing
          </Link>
        }
      />

      <Card>
        <SectionHeader title="All campaigns" count={campaigns.length} />
        {campaigns.length === 0 ? (
          <EmptyState message="No campaigns yet." />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-xs font-semibold uppercase tracking-wide text-[#3c4f5e]">
                <tr>
                  <th className="py-2 pr-2">Campaign</th>
                  <th className="py-2 pr-2">Channel</th>
                  <th className="py-2 pr-2 text-right">Reach</th>
                  <th className="py-2 pr-2 text-right">Converted</th>
                  <th className="py-2 pr-2">Created</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#eef3f5]">
                {campaigns.map((c) => (
                  <tr key={c.id}>
                    <td className="py-2 pr-2">
                      <Link href={`/marketing/campaigns/${c.id}`} className="font-medium text-brand-600 hover:underline">
                        {c.name}
                      </Link>
                    </td>
                    <td className="py-2 pr-2 text-[#607785]">{c.channel}</td>
                    <td className="py-2 pr-2 text-right text-[#14202b]">{c.reach.toLocaleString("en-US")}</td>
                    <td className="py-2 pr-2 text-right text-[#14202b]">{c.converted.toLocaleString("en-US")}</td>
                    <td className="py-2 pr-2 text-[#607785]">{formatDate(c.created_at)}</td>
                    <td className="py-2">
                      <span className={`rounded-[16px] px-2 py-0.5 text-xs font-medium ${STATUS_TONE[c.status]}`}>
                        {c.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="mt-4">
          <CampaignForm segments={segments} />
        </div>
      </Card>
    </div>
  );
}
