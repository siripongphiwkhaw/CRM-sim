import Link from "next/link";
import { listDeals, type DealWithRelations } from "@/db/queries/deals";
import { PageHeader, LinkButton } from "@/app/components/ui";
import { formatCurrency, formatDate } from "@/lib/format";
import { DEAL_STAGES } from "@/lib/constants";
import { StageSelect } from "./StageSelect";

export const dynamic = "force-dynamic";

export default async function DealsPage() {
  const deals = listDeals();

  const byStage = DEAL_STAGES.map((stage) => {
    const stageDeals = deals.filter((d) => d.stage === stage);
    const total = stageDeals.reduce((sum, d) => sum + d.value, 0);
    return { stage, deals: stageDeals, total };
  });

  return (
    <div>
      <PageHeader
        title="Deals"
        subtitle={`${deals.length} ${deals.length === 1 ? "deal" : "deals"} across the pipeline`}
        action={<LinkButton href="/deals/new">New deal</LinkButton>}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {byStage.map(({ stage, deals: stageDeals, total }) => (
          <div
            key={stage}
            className="flex flex-col rounded-lg border border-slate-200 bg-slate-50"
          >
            <div className="border-b border-slate-200 px-3 py-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-700">{stage}</span>
                <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs text-slate-600">
                  {stageDeals.length}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-slate-500">{formatCurrency(total)}</p>
            </div>
            <div className="flex-1 space-y-2 p-2">
              {stageDeals.length === 0 ? (
                <p className="px-1 py-4 text-center text-xs text-slate-400">
                  No deals
                </p>
              ) : (
                stageDeals.map((d) => <DealCard key={d.id} deal={d} />)
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DealCard({ deal }: { deal: DealWithRelations }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-3 shadow-sm">
      <Link
        href={`/deals/${deal.id}`}
        className="block truncate text-sm font-medium text-slate-800 hover:text-indigo-600"
      >
        {deal.title}
      </Link>
      <p className="mt-1 text-sm font-semibold text-slate-900">
        {formatCurrency(deal.value)}
      </p>
      {(deal.company_name || deal.contact_name) && (
        <p className="mt-1 truncate text-xs text-slate-500">
          {deal.company_name ?? deal.contact_name}
        </p>
      )}
      <div className="mt-2 flex items-center justify-between gap-2">
        <StageSelect dealId={deal.id} stage={deal.stage} />
        {deal.expected_close_date && (
          <span className="shrink-0 text-xs text-slate-400">
            {formatDate(deal.expected_close_date)}
          </span>
        )}
      </div>
    </div>
  );
}
