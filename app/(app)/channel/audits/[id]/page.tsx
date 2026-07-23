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
  DetailRow,
} from "@/app/components/ui";
import { ReceiptDetail, tryParseReceiptSummary } from "@/app/components/ReceiptDetail";
import { formatCurrency, formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

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
  // Rows scanned before the structured extract existed hold a plain
  // joined-references string in raw_summary instead of JSON — fall back to
  // showing that as-is rather than a blank "Tax invoice" section.
  const parsedReceipt = tryParseReceiptSummary(scan.raw_summary);

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
              {!parsedReceipt && <DetailRow label="References" value={scan.raw_summary} />}
              <DetailRow
                label="Own products"
                value={`${ownLines.length} of ${lines.length} lines`}
              />
            </dl>
            {scan.note && <p className="mt-3 text-xs text-[#607785]">{scan.note}</p>}
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
                  <thead className="text-left text-xs font-semibold uppercase tracking-wide text-[#3c4f5e]">
                    <tr>
                      <th className="py-2 pr-2">On receipt</th>
                      <th className="py-2 pr-2">Matched product</th>
                      <th className="py-2 pr-2 text-right">Qty</th>
                      <th className="py-2 pr-2 text-right">Price</th>
                      <th className="py-2">Check</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#eef3f5]">
                    {lines.map((line) => (
                      <tr
                        key={line.id}
                        className={line.match_status === "matched" ? "" : "opacity-60"}
                      >
                        <td className="py-2 pr-2 text-[#14202b]">{line.ocr_name}</td>
                        <td className="py-2 pr-2">
                          {line.product_id ? (
                            <Link
                              href={`/products/${line.product_id}/edit`}
                              className="text-brand-600 hover:underline"
                            >
                              {line.product_name}
                            </Link>
                          ) : (
                            <span className="text-[#607785]">—</span>
                          )}
                        </td>
                        <td className="py-2 pr-2 text-right text-[#3c4f5e]">{line.quantity ?? "—"}</td>
                        <td className="py-2 pr-2 text-right text-[#3c4f5e]">
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

      {parsedReceipt && (
        <div className="mt-4">
          <ReceiptDetail receipt={parsedReceipt} />
        </div>
      )}
    </div>
  );
}
