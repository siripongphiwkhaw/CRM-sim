import Link from "next/link";
import { listCases, getCaseCounts } from "@/db/queries/cases";
import { listCustomers } from "@/db/queries/customers";
import { listDepartments } from "@/db/queries/departments";
import {
  PageHeader,
  Card,
  SectionHeader,
  CaseStatusBadge,
  CasePriorityBadge,
  EmptyState,
} from "@/app/components/ui";
import { formatDate } from "@/lib/format";
import { CASE_STATUSES, CASE_STATUS_LABELS } from "@/lib/constants";
import { NewCaseForm } from "./NewCaseForm";

export const dynamic = "force-dynamic";

export default async function CasesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; dept?: string }>;
}) {
  const { status, dept } = await searchParams;
  const departmentId = dept ? Number(dept) : undefined;
  const [cases, counts, members, departments] = await Promise.all([
    listCases({ status: status || undefined, departmentId }),
    getCaseCounts(),
    listCustomers(),
    listDepartments(),
  ]);
  const countMap = new Map(counts.map((c) => [c.status, c.count]));
  const memberOptions = members.map((m) => ({
    id: m.id,
    label: `${m.first_name} ${m.last_name} (${m.member_code})`,
  }));

  return (
    <div>
      <PageHeader
        icon="cases"
        overline="Service"
        title="Cases"
        subtitle="Member service cases — open, assign, resolve"
      />

      <div className="mb-2 flex flex-wrap gap-2">
        <Link
          href={dept ? `/cases?dept=${dept}` : "/cases"}
          className={`rounded-[16px] px-3 py-1 text-xs font-medium transition ${!status ? "bg-brand-600 text-white" : "bg-white text-[#3c4f5e] border border-[#dde5e8] hover:bg-[#eef3f5]"}`}
        >
          All
        </Link>
        {CASE_STATUSES.map((s) => {
          const qs = new URLSearchParams();
          qs.set("status", s);
          if (dept) qs.set("dept", dept);
          return (
            <Link
              key={s}
              href={`/cases?${qs.toString()}`}
              className={`rounded-[16px] px-3 py-1 text-xs font-medium transition ${status === s ? "bg-brand-600 text-white" : "bg-white text-[#3c4f5e] border border-[#dde5e8] hover:bg-[#eef3f5]"}`}
            >
              {CASE_STATUS_LABELS[s]} ({countMap.get(s) ?? 0})
            </Link>
          );
        })}
      </div>

      {departments.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="text-xs text-[#607785]">Department:</span>
          <Link
            href={status ? `/cases?status=${status}` : "/cases"}
            className={`rounded-[16px] px-3 py-1 text-xs font-medium transition ${!dept ? "bg-brand-600 text-white" : "bg-white text-[#3c4f5e] border border-[#dde5e8] hover:bg-[#eef3f5]"}`}
          >
            Any
          </Link>
          {departments.map((d) => {
            const qs = new URLSearchParams();
            qs.set("dept", String(d.id));
            if (status) qs.set("status", status);
            return (
              <Link
                key={d.id}
                href={`/cases?${qs.toString()}`}
                className={`rounded-[16px] px-3 py-1 text-xs font-medium transition ${departmentId === d.id ? "bg-brand-600 text-white" : "bg-white text-[#3c4f5e] border border-[#dde5e8] hover:bg-[#eef3f5]"}`}
              >
                {d.name}
              </Link>
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <SectionHeader title="Cases" count={cases.length} />
            {cases.length === 0 ? (
              <EmptyState message="No cases in this view." />
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="text-left text-xs font-semibold uppercase tracking-wide text-[#3c4f5e]">
                    <tr>
                      <th className="py-2 pr-2">Case</th>
                      <th className="py-2 pr-2">Member</th>
                      <th className="py-2 pr-2">Department</th>
                      <th className="py-2 pr-2">Priority</th>
                      <th className="py-2 pr-2">Status</th>
                      <th className="py-2">Opened</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#eef3f5]">
                    {cases.map((c) => (
                      <tr key={c.id} className="transition-colors hover:bg-[#eef3f5]">
                        <td className="py-2 pr-2">
                          <Link href={`/cases/${c.id}`} className="font-medium text-brand-600 hover:underline">
                            {c.case_number}
                          </Link>
                          <p className="truncate text-xs text-[#607785]">{c.subject}</p>
                        </td>
                        <td className="py-2 pr-2 text-[#607785]">{c.member_name ?? "—"}</td>
                        <td className="py-2 pr-2 text-[#607785]">{c.department_name ?? "—"}</td>
                        <td className="py-2 pr-2"><CasePriorityBadge priority={c.priority} /></td>
                        <td className="py-2 pr-2"><CaseStatusBadge status={c.status} /></td>
                        <td className="py-2 text-xs text-[#607785]">{formatDate(c.created_at)}</td>
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
            <SectionHeader title="Open a case" />
            <NewCaseForm members={memberOptions} />
          </Card>
        </div>
      </div>
    </div>
  );
}
