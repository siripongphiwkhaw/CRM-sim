import Link from "next/link";
import { listSegments } from "@/db/queries/segments";
import { listCampaigns } from "@/db/queries/campaigns";
import { getClassificationStats } from "@/db/queries/scores";
import { PageHeader, Card, StatTile } from "@/app/components/ui";

export const dynamic = "force-dynamic";

export default async function MarketingPage() {
  const [segments, campaigns, classification] = await Promise.all([
    listSegments(),
    listCampaigns(),
    getClassificationStats(),
  ]);
  const running = campaigns.filter((c) => c.status === "RUNNING").length;
  const totalReach = campaigns.reduce((sum, c) => sum + c.reach, 0);
  const totalExcluded = campaigns.reduce((sum, c) => sum + c.excluded, 0);

  return (
    <div>
      <PageHeader
        icon="insights"
        overline="Marketing"
        title="Marketing"
        subtitle="Segments and campaigns built on the loyalty, consent and RFM data already in the CDP"
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Segments" value={String(segments.length)} />
        <StatTile label="Campaigns" value={String(campaigns.length)} />
        <StatTile label="Running now" value={String(running)} tone="brand" />
        <StatTile label="Total reach" value={totalReach.toLocaleString("en-US")} tone="positive" />
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Contested customers"
          value={classification.contested.toLocaleString("en-US")}
          tone="warning"
          hint="Active across ≥2 channels — the ones channels compete over"
        />
        <StatTile
          label="Promos avoided (overlap)"
          value={totalExcluded.toLocaleString("en-US")}
          tone="positive"
          hint="Cross-channel sends skipped at launch"
        />
        <StatTile
          label="HoReCa / Trade buyers"
          value={(classification.horeca + classification.trade).toLocaleString("en-US")}
          hint="Business-sized behaviour"
        />
        <StatTile
          label="Reclassify suggestions"
          value={classification.reclassify.toLocaleString("en-US")}
          tone={classification.reclassify > 0 ? "danger" : "default"}
          hint="Declared type ≠ behaviour"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Link href="/marketing/segments">
          <Card className="h-full transition hover:border-brand-600">
            <h2 className="text-sm font-bold text-[#14202b]">Segments</h2>
            <p className="mt-1 text-xs text-[#607785]">
              Build audiences by tier, brand, churn risk, points and consent — with a live count before you save.
            </p>
          </Card>
        </Link>
        <Link href="/marketing/campaigns">
          <Card className="h-full transition hover:border-brand-600">
            <h2 className="text-sm font-bold text-[#14202b]">Campaigns</h2>
            <p className="mt-1 text-xs text-[#607785]">
              Launch a simulated multi-channel send to a segment and track reach and conversion.
            </p>
          </Card>
        </Link>
      </div>
    </div>
  );
}
