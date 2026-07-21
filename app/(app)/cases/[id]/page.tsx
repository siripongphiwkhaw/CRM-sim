import Link from "next/link";
import { notFound } from "next/navigation";
import { getCase } from "@/db/queries/cases";
import {
  PageHeader,
  Card,
  SectionHeader,
  CaseStatusBadge,
  CasePriorityBadge,
  DetailRow,
} from "@/app/components/ui";
import { formatDate } from "@/lib/format";
import type { CaseStatus } from "@/lib/constants";
import { CaseActions } from "./CaseActions";

export const dynamic = "force-dynamic";

export default async function CaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const c = await getCase(Number(id));
  if (!c) notFound();

  return (
    <div>
      <PageHeader
        icon="cases"
        overline={`Case · ${c.category ?? "General"}`}
        title={c.case_number}
        subtitle={c.subject}
        action={
          <div className="flex items-center gap-2">
            <CasePriorityBadge priority={c.priority} />
            <CaseStatusBadge status={c.status} />
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <SectionHeader title="Description" />
            <p className="text-sm text-[#3c4f5e]">{c.description ?? "No description provided."}</p>
            {c.resolution && (
              <div className="mt-3 rounded-[9px] bg-[#eef3f5] p-3">
                <p className="text-xs font-semibold text-[#3c4f5e]">Resolution</p>
                <p className="text-sm text-[#14202b]">{c.resolution}</p>
              </div>
            )}
          </Card>

          <Card>
            <SectionHeader title="Update status" />
            <CaseActions caseId={c.id} status={c.status as CaseStatus} />
          </Card>
        </div>

        <div>
          <Card>
            <SectionHeader title="Details" />
            <dl>
              <DetailRow
                label="Member"
                value={
                  c.customer_id ? (
                    <Link href={`/customers/${c.customer_id}`} className="text-brand-600 hover:underline">
                      {c.member_name} ({c.member_code})
                    </Link>
                  ) : null
                }
              />
              <DetailRow label="Category" value={c.category} />
              <DetailRow label="Assigned to" value={c.assignee_name} />
              <DetailRow label="Opened" value={formatDate(c.created_at)} />
              <DetailRow label="Resolved" value={formatDate(c.resolved_at)} />
            </dl>
          </Card>
        </div>
      </div>
    </div>
  );
}
