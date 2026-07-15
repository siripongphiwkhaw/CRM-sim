import Link from "next/link";
import { notFound } from "next/navigation";
import { getDeal } from "@/db/queries/deals";
import { listTasksByDeal } from "@/db/queries/tasks";
import {
  PageHeader,
  LinkButton,
  Card,
  StageBadge,
  TaskTypeBadge,
  EmptyState,
} from "@/app/components/ui";
import { DeleteButton } from "@/app/components/form";
import { formatCurrency, formatDate, isOverdue } from "@/lib/format";
import { deleteDealAction } from "../actions";

export const dynamic = "force-dynamic";

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-slate-100 py-2 last:border-0">
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd className="text-right text-sm text-slate-800">{value || "—"}</dd>
    </div>
  );
}

export default async function DealDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const deal = getDeal(Number(id));
  if (!deal) notFound();

  const tasks = listTasksByDeal(deal.id);

  return (
    <div>
      <PageHeader
        title={deal.title}
        action={
          <div className="flex items-center gap-2">
            <LinkButton href={`/deals/${deal.id}/edit`} variant="secondary">
              Edit
            </LinkButton>
            <DeleteButton
              action={deleteDealAction}
              id={deal.id}
              confirmMessage={`Delete deal “${deal.title}”? Related tasks will be removed.`}
            />
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <div className="mb-4 flex items-center justify-between">
            <span className="text-3xl font-semibold text-slate-900">
              {formatCurrency(deal.value)}
            </span>
            <StageBadge stage={deal.stage} />
          </div>
          <dl>
            <DetailRow
              label="Contact"
              value={
                deal.contact_id ? (
                  <Link
                    href={`/contacts/${deal.contact_id}`}
                    className="text-indigo-600 hover:underline"
                  >
                    {deal.contact_name}
                  </Link>
                ) : null
              }
            />
            <DetailRow
              label="Company"
              value={
                deal.company_id ? (
                  <Link
                    href={`/companies/${deal.company_id}`}
                    className="text-indigo-600 hover:underline"
                  >
                    {deal.company_name}
                  </Link>
                ) : null
              }
            />
            <DetailRow label="Owner" value={deal.owner_name} />
            <DetailRow
              label="Expected close"
              value={formatDate(deal.expected_close_date)}
            />
            <DetailRow label="Created" value={formatDate(deal.created_at)} />
          </dl>
        </Card>

        <div className="lg:col-span-2">
          <Card>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
                Tasks
              </h2>
              <Link
                href={`/tasks/new?deal_id=${deal.id}`}
                className="text-sm text-indigo-600 hover:underline"
              >
                + Add task
              </Link>
            </div>
            {tasks.length === 0 ? (
              <EmptyState message="No tasks for this deal." />
            ) : (
              <ul className="divide-y divide-slate-100">
                {tasks.map((t) => (
                  <li key={t.id} className="flex items-center gap-3 py-2">
                    <TaskTypeBadge type={t.type} />
                    <Link
                      href={`/tasks/${t.id}/edit`}
                      className={`min-w-0 flex-1 truncate text-sm hover:underline ${
                        t.completed
                          ? "text-slate-400 line-through"
                          : "text-slate-800"
                      }`}
                    >
                      {t.subject}
                    </Link>
                    <span
                      className={`shrink-0 text-xs ${
                        isOverdue(t.due_date, t.completed)
                          ? "font-medium text-rose-600"
                          : "text-slate-400"
                      }`}
                    >
                      {t.completed ? "Done" : formatDate(t.due_date)}
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
