import { notFound } from "next/navigation";
import { getCustomer } from "@/db/queries/customers";
import { listInteractionsByCustomer } from "@/db/queries/interactions";
import {
  PageHeader,
  LinkButton,
  Card,
  TierBadge,
  ConsentPill,
  InteractionBadge,
  EmptyState,
} from "@/app/components/ui";
import { DeleteButton } from "@/app/components/form";
import { formatCurrency, formatDate } from "@/lib/format";
import { AddInteractionForm } from "../AddInteractionForm";
import { deleteCustomerAction } from "../actions";

export const dynamic = "force-dynamic";

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-stone-100 py-2 last:border-0">
      <dt className="text-sm text-stone-500">{label}</dt>
      <dd className="text-right text-sm text-stone-800">{value || "—"}</dd>
    </div>
  );
}

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const customer = await getCustomer(Number(id));
  if (!customer) notFound();

  const interactions = await listInteractionsByCustomer(customer.id);

  return (
    <div>
      <PageHeader
        title={`${customer.first_name} ${customer.last_name}`}
        subtitle={`${customer.member_code} · ${customer.brand}`}
        action={
          <div className="flex items-center gap-2">
            <LinkButton href={`/customers/${customer.id}/edit`} variant="secondary">
              Edit
            </LinkButton>
            <DeleteButton
              action={deleteCustomerAction}
              id={customer.id}
              confirmMessage={`Delete ${customer.first_name} ${customer.last_name} and their interaction history?`}
            />
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-1">
          <Card>
            <div className="mb-4 flex items-center justify-between">
              <TierBadge tier={customer.tier} />
              <span className="text-sm text-stone-500">
                {customer.points.toLocaleString("en-US")} pts
              </span>
            </div>
            <dl>
              <DetailRow label="CLV" value={formatCurrency(customer.clv)} />
              <DetailRow label="Email" value={customer.email} />
              <DetailRow label="Phone" value={customer.phone} />
              <DetailRow label="Register channel" value={customer.register_channel} />
              <DetailRow label="Data level" value={customer.data_level} />
              <DetailRow label="Last purchase" value={formatDate(customer.last_purchase_at)} />
              <DetailRow label="Member since" value={formatDate(customer.created_at)} />
            </dl>
          </Card>

          <Card>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-stone-400">
              Consent (PDPA)
            </h2>
            <div className="flex flex-wrap gap-2">
              <ConsentPill granted={!!customer.consent_pdpa} label="PDPA" />
              <ConsentPill granted={!!customer.consent_marketing} label="Marketing" />
              <ConsentPill granted={!!customer.consent_migration} label="Migration" />
            </div>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-stone-400">
              Interaction history
            </h2>
            <div className="mb-4">
              <AddInteractionForm customerId={customer.id} />
            </div>
            {interactions.length === 0 ? (
              <EmptyState message="No interactions yet." />
            ) : (
              <ul className="divide-y divide-stone-100">
                {interactions.map((it) => (
                  <li key={it.id} className="flex items-center gap-3 py-2 text-sm">
                    <InteractionBadge type={it.type} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-stone-800">{it.description ?? "—"}</p>
                      <p className="text-xs text-stone-400">
                        {it.channel ?? "—"} · {formatDate(it.occurred_at)}
                        {it.points ? ` · +${it.points} pts` : ""}
                      </p>
                    </div>
                    {it.amount > 0 && (
                      <span className="shrink-0 text-stone-600">
                        {formatCurrency(it.amount)}
                      </span>
                    )}
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
