import Link from "next/link";
import { listIdentityLinks } from "@/db/queries/identityLinks";
import { PageHeader, Card, SectionHeader, EmptyState, StatTile } from "@/app/components/ui";
import { formatDate } from "@/lib/format";
import { ScanButton, DecideButtons } from "./IdentityLinkControls";

export const dynamic = "force-dynamic";

const STATUS_TONE: Record<string, string> = {
  PENDING: "bg-[#fff5ec] text-[#8a4b1e]",
  CONFIRMED: "bg-[#cdefc4] text-[#194e31]",
  REJECTED: "bg-[#e5eaec] text-[#514f4d]",
};

export default async function IdentityLinksPage() {
  const links = await listIdentityLinks();
  const pending = links.filter((l) => l.status === "PENDING");
  const confirmed = links.filter((l) => l.status === "CONFIRMED");

  return (
    <div>
      <PageHeader
        icon="insights"
        overline="Marketing · CDP"
        title="Identity links (B2C ↔ B2B)"
        subtitle="Accounts sharing an email or phone across the B2C/B2B line — one buyer, promoted from one side only"
        action={
          <Link href="/marketing" className="text-sm font-medium text-brand-700">
            ← Marketing
          </Link>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Detected pairs" value={String(links.length)} />
        <StatTile label="Pending review" value={String(pending.length)} tone="warning" />
        <StatTile label="Confirmed (enforced)" value={String(confirmed.length)} tone="positive" />
      </div>

      <Card className="mb-4">
        <SectionHeader title="Detect" />
        <p className="mb-2 text-xs text-[#607785]">
          Scans for a B2C account and a B2B account sharing an email or phone, judges which side spends
          and buys more, and routes each to the owning department (Business Unit + Digital Marketing for
          B2C-dominant, Sales and Ingredient for B2B-dominant) to confirm.
        </p>
        <ScanButton />
      </Card>

      <Card>
        <SectionHeader title="Links" count={links.length} />
        {links.length === 0 ? (
          <EmptyState message="No identity links yet — run a scan." />
        ) : (
          <ul className="divide-y divide-[#eef3f5]">
            {links.map((l) => (
              <li key={l.id} className="py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 text-sm">
                    <p className="text-[#14202b]">
                      <Link href={`/customers/${l.customer_a_id}`} className="text-brand-600 hover:underline">
                        {l.a_name} <span className="font-mono text-xs">({l.a_code} · {l.a_type})</span>
                      </Link>
                      {" ↔ "}
                      <Link href={`/customers/${l.customer_b_id}`} className="text-brand-600 hover:underline">
                        {l.b_name} <span className="font-mono text-xs">({l.b_code} · {l.b_type})</span>
                      </Link>
                    </p>
                    <p className="mt-0.5 text-xs text-[#607785]">
                      Matched by {l.matched_by} · dominant{" "}
                      <span className="font-semibold text-[#14202b]">{l.dominant_side ?? "—"}</span>
                      {l.case_id ? (
                        <>
                          {" · "}
                          <Link href={`/cases/${l.case_id}`} className="text-brand-600 hover:underline">
                            review case
                          </Link>
                        </>
                      ) : null}
                    </p>
                    {l.verdict_note && <p className="mt-0.5 text-xs text-[#607785]">{l.verdict_note}</p>}
                    <p className="mt-0.5 text-[11px] text-[#607785]">Detected {formatDate(l.created_at)}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <span className={`rounded-[16px] px-2 py-0.5 text-xs font-medium ${STATUS_TONE[l.status]}`}>
                      {l.status}
                    </span>
                    {l.status === "PENDING" && <DecideButtons linkId={l.id} />}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
