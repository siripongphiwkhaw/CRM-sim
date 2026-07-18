import Link from "next/link";
import { notFound } from "next/navigation";
import { getReceiptScan, getReceiptScanLines } from "@/db/queries/receiptScans";
import {
  PageHeader,
  Card,
  SectionHeader,
  ScanMatchBadge,
  LineMatchBadge,
  LinkButton,
  EmptyState,
} from "@/app/components/ui";
import { formatCurrency, formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-[#f3f3f3] py-2 last:border-0">
      <dt className="text-xs text-[#706e6b]">{label}</dt>
      <dd className="text-right text-sm text-[#181818]">{value || "—"}</dd>
    </div>
  );
}

export default async function AuditScanDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const scan = await getReceiptScan(Number(id));
  if (!scan || scan.scan_type !== "retail_audit") notFound();

  const lines = await getReceiptScanLines(scan.id);
  const ownLines = lines.filter((l) => l.match_status === "matched");

  return (
    <div>
      <PageHeader
        icon="audit"
        overline="Retail Audit"
        title={scan.store_name || "Unknown store"}
        subtitle={`Scanned ${formatDate(scan.created_at)} by ${scan.created_by_name ?? "—"}`}
        action={
          <div className="flex items-center gap-2">
            <ScanMatchBadge status={scan.match_status} />
            <LinkButton href="/channel/audits/new" variant="secondary">
              Scan another
            </LinkButton>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div>
          <Card>
            <SectionHeader title="Receipt" />
            <dl>
              <DetailRow label="Store" value={scan.store_name} />
              <DetailRow label="Channel" value={scan.channel} />
              <DetailRow label="Document date" value={formatDate(scan.receipt_date)} />
              <DetailRow
                label="Total"
                value={scan.receipt_total != null ? formatCurrency(scan.receipt_total) : null}
              />
              <DetailRow label="Currency" value={scan.currency} />
              <DetailRow label="References" value={scan.raw_summary} />
              <DetailRow
                label="Own products"
                value={`${ownLines.length} of ${lines.length} lines`}
              />
            </dl>
            {scan.note && <p className="mt-3 text-xs text-[#706e6b]">{scan.note}</p>}
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card>
            <SectionHeader title="Receipt lines" count={lines.length} />
            {lines.length === 0 ? (
              <EmptyState message="No line items were readable on this receipt." />
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="text-left text-xs font-semibold uppercase tracking-wide text-[#444]">
                    <tr>
                      <th className="py-2 pr-2">On receipt</th>
                      <th className="py-2 pr-2">Matched product</th>
                      <th className="py-2 pr-2 text-right">Qty</th>
                      <th className="py-2 pr-2 text-right">Price</th>
                      <th className="py-2">Check</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f3f3f3]">
                    {lines.map((line) => (
                      <tr
                        key={line.id}
                        className={line.match_status === "matched" ? "" : "opacity-60"}
                      >
                        <td className="py-2 pr-2 text-[#181818]">{line.ocr_name}</td>
                        <td className="py-2 pr-2">
                          {line.product_id ? (
                            <Link
                              href={`/products/${line.product_id}/edit`}
                              className="text-brand-600 hover:underline"
                            >
                              {line.product_name}
                            </Link>
                          ) : (
                            <span className="text-[#706e6b]">—</span>
                          )}
                        </td>
                        <td className="py-2 pr-2 text-right text-[#444]">{line.quantity ?? "—"}</td>
                        <td className="py-2 pr-2 text-right text-[#444]">
                          {line.unit_price != null ? formatCurrency(line.unit_price) : "—"}
                        </td>
                        <td className="py-2">
                          <LineMatchBadge status={line.match_status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
