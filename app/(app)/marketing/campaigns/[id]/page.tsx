import Link from "next/link";
import { notFound } from "next/navigation";
import { getCampaign, listCampaignAudience } from "@/db/queries/campaigns";
import { getSegment } from "@/db/queries/segments";
import { PageHeader, Card, SectionHeader, EmptyState, StatTile } from "@/app/components/ui";
import { formatDate } from "@/lib/format";
import { CampaignControls } from "./CampaignControls";

export const dynamic = "force-dynamic";

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const campaignId = Number(id);
  if (!Number.isFinite(campaignId)) notFound();

  const campaign = await getCampaign(campaignId);
  if (!campaign) notFound();

  const [segment, audience] = await Promise.all([
    campaign.segment_id ? getSegment(campaign.segment_id) : undefined,
    campaign.launched_at ? listCampaignAudience(campaignId) : Promise.resolve([]),
  ]);

  return (
    <div>
      <PageHeader
        icon="insights"
        overline={`Marketing · ${campaign.channel}`}
        title={campaign.name}
        subtitle={segment ? `Segment: ${segment.name}` : "No segment"}
        action={
          <div className="flex items-center gap-2">
            <CampaignControls id={campaign.id} status={campaign.status} />
            <Link href="/marketing/campaigns" className="text-sm font-medium text-brand-700">
              ← Campaigns
            </Link>
          </div>
        }
      />

      {!campaign.launched_at ? (
        <Card>
          <p className="text-sm text-[#607785]">
            This campaign is a draft. Launching snapshots the segment&apos;s current,
            marketing-consented members and simulates a send on {campaign.channel} —
            no real message goes out (there&apos;s no LINE Messaging API channel wired
            up yet; see the README follow-ups).
          </p>
        </Card>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile label="Segment size at launch" value={campaign.audience_size.toLocaleString("en-US")} />
            <StatTile label="Reach (consented)" value={campaign.reach.toLocaleString("en-US")} tone="brand" />
            <StatTile label="Converted" value={campaign.converted.toLocaleString("en-US")} tone="positive" />
            <StatTile
              label="Conversion rate"
              value={campaign.reach > 0 ? `${Math.round((campaign.converted / campaign.reach) * 100)}%` : "—"}
            />
          </div>

          <Card>
            <SectionHeader title="Audience" count={audience.length} />
            <p className="mb-2 text-xs text-[#607785]">
              Launched {formatDate(campaign.launched_at)} — only members with current MARKETING
              consent were included.
            </p>
            {audience.length === 0 ? (
              <EmptyState message="No consented members in this segment at launch." />
            ) : (
              <ul className="divide-y divide-[#eef3f5]">
                {audience.map((a) => (
                  <li key={a.customer_id} className="flex items-center justify-between gap-2 py-2 text-sm">
                    <Link href={`/customers/${a.customer_id}`} className="text-brand-600 hover:underline">
                      {a.member_name} · <span className="font-mono text-xs">{a.member_code}</span>
                    </Link>
                    <span className="text-xs text-[#607785]">{a.delivered ? "Delivered" : "Pending"}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
