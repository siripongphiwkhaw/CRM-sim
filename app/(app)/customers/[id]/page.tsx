import { notFound } from "next/navigation";
import { getCustomer } from "@/db/queries/customers";
import { listInteractionsByCustomer } from "@/db/queries/interactions";
import {
  PageHeader,
  LinkButton,
  Card,
  SectionHeader,
  TierBadge,
  ConsentPill,
  InteractionBadge,
  EmptyState,
} from "@/app/components/ui";
import { DeleteButton } from "@/app/components/form";
import { formatCurrency, formatDate } from "@/lib/format";
import { TierPath } from "../TierPath";
import { ActivityComposer } from "../ActivityComposer";
import { deleteCustomerAction } from "../actions";

export const dynamic = "force-dynamic";

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-[#f3f3f3] py-2 last:border-0">
      <dt className="text-xs text-[#706e6b]">{label}</dt>
      <dd className="text-right text-sm text-[#181818]">{value || "—"}</dd>
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
        icon="customer"
        overline="Customer"
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

      {/* Highlights strip */}
      <Card className="mb-4">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <p className="text-xs text-[#706e6b]">Tier</p>
            <p className="mt-0.5"><TierBadge tier={customer.tier} /></p>
          </div>
          <div>
            <p className="text-xs text-[#706e6b]">Points</p>
            <p className="mt-0.5 text-lg font-semibold text-[#181818]">
              {customer.points.toLocaleString("en-US")}
            </p>
          </div>
          <div>
            <p className="text-xs text-[#706e6b]">Lifetime value</p>
            <p className="mt-0.5 text-lg font-semibold text-[#181818]">
              {formatCurrency(customer.clv)}
            </p>
          </div>
          <div>
            <p className="text-xs text-[#706e6b]">Data level</p>
            <p className="mt-0.5 text-lg font-semibold text-[#181818]">{customer.data_level}</p>
          </div>
        </div>
      </Card>

      <div className="mb-4">
        <TierPath customerId={customer.id} tier={customer.tier} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-1">
          <Card>
            <SectionHeader title="Details" />
            <dl>
              <DetailRow
                label="Email"
                value={
                  customer.email ? (
                    <a href={`mailto:${customer.email}`} className="text-brand-600 hover:underline">
                      {customer.email}
                    </a>
                  ) : null
                }
              />
              <DetailRow label="Phone" value={customer.phone} />
              <DetailRow label="Register channel" value={customer.register_channel} />
              <DetailRow label="Last purchase" value={formatDate(customer.last_purchase_at)} />
              <DetailRow label="Member since" value={formatDate(customer.created_at)} />
            </dl>
          </Card>

          <Card>
            <SectionHeader title="Consent (PDPA)" />
            <div className="flex flex-wrap gap-2">
              <ConsentPill granted={!!customer.consent_pdpa} label="PDPA" />
              <ConsentPill granted={!!customer.consent_marketing} label="Marketing" />
              <ConsentPill granted={!!customer.consent_migration} label="Migration" />
            </div>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card>
            <SectionHeader title="Activity" count={interactions.length} />
            <div className="mb-4">
              <ActivityComposer customerId={customer.id} />
            </div>
            {interactions.length === 0 ? (
              <EmptyState message="No interactions yet." />
            ) : (
              <ul className="divide-y divide-[#f3f3f3]">
                {interactions.map((it) => (
                  <li key={it.id} className="flex items-center gap-3 py-2 text-sm">
                    <InteractionBadge type={it.type} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[#181818]">{it.description ?? "—"}</p>
                      <p className="text-xs text-[#706e6b]">
                        {it.channel ?? "—"} · {formatDate(it.occurred_at)}
                        {it.points ? ` · +${it.points} pts` : ""}
                      </p>
                    </div>
                    {it.amount > 0 && (
                      <span className="shrink-0 text-[#444]">{formatCurrency(it.amount)}</span>
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
