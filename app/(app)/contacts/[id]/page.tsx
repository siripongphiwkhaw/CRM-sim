import Link from "next/link";
import { notFound } from "next/navigation";
import { getContact } from "@/db/queries/contacts";
import { listDealsByContact } from "@/db/queries/deals";
import { listTasksByContact } from "@/db/queries/tasks";
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
import { deleteContactAction } from "../actions";

export const dynamic = "force-dynamic";

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-slate-100 py-2 last:border-0">
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd className="text-right text-sm text-slate-800">{value || "—"}</dd>
    </div>
  );
}

export default async function ContactDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const contact = await getContact(Number(id));
  if (!contact) notFound();

  const [deals, tasks] = await Promise.all([
    listDealsByContact(contact.id),
    listTasksByContact(contact.id),
  ]);

  return (
    <div>
      <PageHeader
        title={`${contact.first_name} ${contact.last_name}`}
        subtitle={contact.title ?? undefined}
        action={
          <div className="flex items-center gap-2">
            <LinkButton href={`/contacts/${contact.id}/edit`} variant="secondary">
              Edit
            </LinkButton>
            <DeleteButton
              action={deleteContactAction}
              id={contact.id}
              confirmMessage={`Delete ${contact.first_name} ${contact.last_name}? Related deals will be unlinked and tasks removed.`}
            />
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
            Details
          </h2>
          <dl>
            <DetailRow
              label="Email"
              value={
                contact.email ? (
                  <a
                    href={`mailto:${contact.email}`}
                    className="text-indigo-600 hover:underline"
                  >
                    {contact.email}
                  </a>
                ) : null
              }
            />
            <DetailRow label="Phone" value={contact.phone} />
            <DetailRow
              label="Company"
              value={
                contact.company_id ? (
                  <Link
                    href={`/companies/${contact.company_id}`}
                    className="text-indigo-600 hover:underline"
                  >
                    {contact.company_name}
                  </Link>
                ) : null
              }
            />
            <DetailRow label="Added" value={formatDate(contact.created_at)} />
          </dl>
          {contact.notes && (
            <div className="mt-4">
              <h3 className="mb-1 text-sm font-medium text-slate-700">Notes</h3>
              <p className="whitespace-pre-wrap text-sm text-slate-600">
                {contact.notes}
              </p>
            </div>
          )}
        </Card>

        <div className="space-y-6 lg:col-span-2">
          <Card>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
                Deals
              </h2>
              <Link
                href={`/deals/new?contact_id=${contact.id}`}
                className="text-sm text-indigo-600 hover:underline"
              >
                + Add deal
              </Link>
            </div>
            {deals.length === 0 ? (
              <EmptyState message="No deals for this contact." />
            ) : (
              <ul className="divide-y divide-slate-100">
                {deals.map((d) => (
                  <li
                    key={d.id}
                    className="flex items-center justify-between gap-3 py-2"
                  >
                    <Link
                      href={`/deals/${d.id}`}
                      className="truncate font-medium text-indigo-600 hover:underline"
                    >
                      {d.title}
                    </Link>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="text-sm text-slate-600">
                        {formatCurrency(d.value)}
                      </span>
                      <StageBadge stage={d.stage} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
                Tasks
              </h2>
              <Link
                href={`/tasks/new?contact_id=${contact.id}`}
                className="text-sm text-indigo-600 hover:underline"
              >
                + Add task
              </Link>
            </div>
            {tasks.length === 0 ? (
              <EmptyState message="No tasks for this contact." />
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
