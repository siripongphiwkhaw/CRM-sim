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
        subtitle={
          configured
            ? "Read by AI vision (Thai or English) — your own products are spotted automatically"
            : "Read free in your browser (Thai + English) — your own products are spotted automatically"
        }
      />
      <Card>
        <AuditScanForm ocrConfigured={configured} />
      </Card>
    </div>
  );
}
