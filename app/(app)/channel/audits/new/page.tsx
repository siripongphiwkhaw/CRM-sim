import { PageHeader, Card } from "@/app/components/ui";
import { isOcrConfigured } from "@/lib/receiptOcr";
import { AuditScanForm } from "./AuditScanForm";

export const dynamic = "force-dynamic";

export default function NewAuditScanPage() {
  const configured = isOcrConfigured();

  return (
    <div>
      <PageHeader
        icon="audit"
        overline="Retail Audit"
        title="Scan a store receipt"
        subtitle="The AI reads the receipt (Thai or English) and spots your own products on it"
      />
      <Card>
        {!configured && (
          <p className="mb-3 rounded border border-[#fbcb8c] bg-[#fbf3e0] px-3 py-2 text-sm text-[#5f3e02]">
            AI OCR is not configured on this server — scans will fail until
            ANTHROPIC_API_KEY is set in .env.local (or Vercel project settings).
          </p>
        )}
        <AuditScanForm />
      </Card>
    </div>
  );
}
