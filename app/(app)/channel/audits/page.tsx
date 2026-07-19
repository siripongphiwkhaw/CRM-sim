import Link from "next/link";
import {
  listReceiptScans,
  getAuditSummary,
  listStoreSightings,
} from "@/db/queries/receiptScans";
import {
  PageHeader,
  Card,
  SectionHeader,
  ScanMatchBadge,
  LinkButton,
  EmptyState,
} from "@/app/components/ui";
import { formatCurrency, formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function RetailAuditPage() {
  const [scans, summary, sightings] = await Promise.all([
    listReceiptScans({ scanType: "retail_audit" }),
    getAuditSummary(),
    listStoreSightings(),
  ]);

  return (
    <div>
      <PageHeader
        icon="audit"
        overline="Sales & Channel"
        title="Retail Audit"
        subtitle="Scan store receipts to track where your products are sold"
        action={<LinkButton href="/channel/audits/new">Scan a receipt</LinkButton>}
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card>
          <p className="text-xs text-[#607785]">Receipts scanned</p>
          <p className="mt-0.5 text-xl font-bold text-[#14202b]">{summary.scan_count}</p>
        </Card>
        <Card>
          <p className="text-xs text-[#607785]">Stores covered</p>
          <p className="mt-0.5 text-xl font-bold text-[#14202b]">{summary.store_count}</p>
        </Card>
        <Card>
          <p className="text-xs text-[#607785]">Own-item sightings</p>
          <p className="mt-0.5 text-xl font-bold text-[#14202b]">{summary.own_item_lines}</p>
        </Card>
        <Card>
          <p className="text-xs text-[#607785]">Top store</p>
          <p className="mt-0.5 truncate text-xl font-bold text-[#14202b]">
            {summary.top_store ?? "—"}
          </p>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <SectionHeader title="Scans" count={scans.length} />
            {scans.length === 0 ? (
              <EmptyState message="No receipts scanned yet. Photograph a store receipt to log where your items are selling." />
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="text-left text-xs font-semibold uppercase tracking-wide text-[#3c4f5e]">
                    <tr>
                      <th className="py-2 pr-2">Store</th>
                      <th className="py-2 pr-2">Channel</th>
                      <th className="py-2 pr-2 text-right">Total</th>
                      <th className="py-2 pr-2 text-right">Own items</th>
                      <th className="py-2 pr-2">Scanned</th>
                      <th className="py-2">Result</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#eef3f5]">
                    {scans.map((scan) => (
                      <tr key={scan.id} className="transition-colors hover:bg-[#eef3f5]">
                        <td className="py-2 pr-2">
                          <Link
                            href={`/channel/audits/${scan.id}`}
                            className="font-medium text-brand-600 hover:underline"
                          >
                            {scan.store_name || "Unknown store"}
                          </Link>
                        </td>
                        <td className="py-2 pr-2 text-[#607785]">{scan.channel ?? "—"}</td>
                        <td className="py-2 pr-2 text-right text-[#3c4f5e]">
                          {scan.receipt_total != null ? formatCurrency(scan.receipt_total) : "—"}
                        </td>
                        <td className="py-2 pr-2 text-right text-[#3c4f5e]">
                          {scan.matched_count}/{scan.line_count}
                        </td>
                        <td className="py-2 pr-2 text-xs text-[#607785]">
                          {formatDate(scan.created_at)}
                        </td>
                        <td className="py-2">
                          <ScanMatchBadge status={scan.match_status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        <div>
          <Card>
            <SectionHeader title="Where your items sell" count={sightings.length} />
            {sightings.length === 0 ? (
              <EmptyState message="No store sightings yet." />
            ) : (
              <ul className="divide-y divide-[#eef3f5]">
                {sightings.map((s) => (
                  <li key={s.store_name} className="flex items-center justify-between gap-2 py-2 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-[#14202b]">{s.store_name}</p>
                      <p className="text-xs text-[#607785]">
                        {s.channel ?? "Channel unknown"} · last seen {formatDate(s.last_seen)}
                      </p>
                    </div>
                    <span className="shrink-0 rounded bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700">
                      {s.own_item_lines} items
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
