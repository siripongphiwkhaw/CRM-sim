import Link from "next/link";
import { notFound } from "next/navigation";
import { getCustomer } from "@/db/queries/customers";
import { getLoyaltySummary, listRewards } from "@/db/queries/loyalty";
import { getCustomerTimeline } from "@/db/queries/transactions";
import { getCurrentConsents, listConsentHistory } from "@/db/queries/consent";
import { getNbaForCustomer } from "@/db/queries/insights";
import { getCustomerScore } from "@/db/queries/scores";
import { getLinksForCustomer } from "@/db/queries/identityLinks";
import { listCases } from "@/db/queries/cases";
import {
  PageHeader,
  LinkButton,
  Card,
  SectionHeader,
  TierBadge,
  EmptyState,
  ObjectIcon,
  type ObjectKind,
  DetailRow,
} from "@/app/components/ui";
import { DeleteButton } from "@/app/components/form";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  CONSENT_PURPOSES,
  BEHAVIOR_CLASS_LABELS,
  CHANNEL_AFFINITY_LABELS,
  TX_CHANNEL_LABELS,
  type ConsentStatus,
} from "@/lib/constants";
import { TierPath } from "../TierPath";
import { RecordTransactionForm } from "./RecordTransactionForm";
import { RedeemForm } from "./RedeemForm";
import { ConsentCard } from "./ConsentCard";
import { LineLinkForm } from "./LineLinkForm";
import { deleteCustomerAction } from "../actions";

export const dynamic = "force-dynamic";

const TIMELINE_ICON: Record<string, ObjectKind> = {
  transaction: "order",
  earn: "earn",
  burn: "burn",
  adjust: "setup",
  interaction: "customer",
  case: "cases",
};

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const customer = await getCustomer(Number(id));
  if (!customer) notFound();

  const [summary, timeline, currentConsents, consentHistory, nba, rewards, cases, score, identityLinks] =
    await Promise.all([
      getLoyaltySummary(customer.id),
      getCustomerTimeline(customer.id),
      getCurrentConsents(customer.id),
      listConsentHistory(customer.id),
      getNbaForCustomer(customer.id),
      listRewards({ availableOnly: true }),
      listCases({ customerId: customer.id }),
      getCustomerScore(customer.id),
      getLinksForCustomer(customer.id),
    ]);

  const currentStatuses: Partial<Record<(typeof CONSENT_PURPOSES)[number], ConsentStatus>> = {};
  for (const p of CONSENT_PURPOSES) currentStatuses[p] = currentConsents[p]?.status;

  return (
    <div>
      <PageHeader
        icon="customer"
        overline={`Member · ${customer.cust_type}`}
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
              confirmMessage={`Delete ${customer.first_name} ${customer.last_name} and their history?`}
            />
          </div>
        }
      />

      {/* Highlights strip */}
      <Card className="mb-4">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
          <div>
            <p className="text-xs text-[#607785]">Tier</p>
            <p className="mt-0.5"><TierBadge tier={summary.tier} /></p>
          </div>
          <div>
            <p className="text-xs text-[#607785]">Points balance</p>
            <p className="mt-0.5 text-lg font-semibold text-[#14202b]">
              {summary.balance.toLocaleString("en-US")}
            </p>
          </div>
          <div>
            <p className="text-xs text-[#607785]">Lifetime earned</p>
            <p className="mt-0.5 text-lg font-semibold text-[#14202b]">
              {summary.lifetime.toLocaleString("en-US")}
            </p>
          </div>
          <div>
            <p className="text-xs text-[#607785]">Earn multiplier</p>
            <p className="mt-0.5 text-lg font-semibold text-[#14202b]">×{summary.multiplier.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-xs text-[#607785]">Lifetime value</p>
            <p className="mt-0.5 text-lg font-semibold text-[#14202b]">
              {formatCurrency(customer.clv)}
            </p>
          </div>
        </div>
      </Card>

      <div className="mb-4">
        <TierPath
          tier={summary.tier}
          lifetime={summary.lifetime}
          nextTier={summary.next_tier}
          nextTierAt={summary.next_tier_at}
        />
      </div>

      {/* Next Best Action */}
      <div className="mb-4 rounded-[14px] border border-[#f4cfa8] bg-nba-50 p-4">
        <div className="flex items-start gap-3">
          <span aria-hidden className="text-lg">🎯</span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-nba-500">Next Best Action</p>
            <p className="text-sm font-semibold text-[#14202b]">{nba.title}</p>
            <p className="text-xs text-[#607785]">{nba.reason}</p>
          </div>
        </div>
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
              <DetailRow label="Member type" value={customer.cust_type} />
              <DetailRow label="Register channel" value={customer.register_channel} />
              <DetailRow label="Last purchase" value={formatDate(customer.last_purchase_at)} />
              <DetailRow label="Member since" value={formatDate(customer.created_at)} />
            </dl>
          </Card>

          <Card>
            <SectionHeader title="Classification &amp; scores" />
            {score ? (
              <dl>
                <DetailRow label="Declared type" value={customer.cust_type} />
                <DetailRow
                  label="Behaves as"
                  value={
                    score.behavior_class ? (
                      <span className={score.behavior_class !== "CONSUMER" ? "font-medium text-[#5f3e02]" : ""}>
                        {score.behavior_class
                          ? BEHAVIOR_CLASS_LABELS[score.behavior_class]
                          : "—"}
                        {score.behavior_class === "HORECA" || score.behavior_class === "TRADE"
                          ? customer.cust_type === "B2C"
                            ? " · review reclassification"
                            : ""
                          : ""}
                      </span>
                    ) : (
                      "—"
                    )
                  }
                />
                <DetailRow
                  label="Channel affinity"
                  value={
                    score.channel_affinity ? (
                      <span className={score.channel_affinity === "CONTESTED" ? "font-medium text-[#8e030f]" : ""}>
                        {CHANNEL_AFFINITY_LABELS[score.channel_affinity]}
                        {score.primary_channel ? ` · ${TX_CHANNEL_LABELS[score.primary_channel]}` : ""}
                      </span>
                    ) : (
                      "—"
                    )
                  }
                />
                <DetailRow label="RFM cell" value={<span className="font-mono">{score.rfm_cell}</span>} />
                <DetailRow
                  label="Recency / Frequency / Monetary"
                  value={`${score.rfm_recency} / ${score.rfm_frequency} / ${score.rfm_monetary}`}
                />
                <DetailRow
                  label="Churn risk"
                  value={
                    <span
                      className={
                        score.churn_score === "High"
                          ? "text-[#8e030f]"
                          : score.churn_score === "Medium"
                            ? "text-[#5f3e02]"
                            : "text-[#194e31]"
                      }
                    >
                      {score.churn_score}
                    </span>
                  }
                />
                <DetailRow label="Last computed" value={formatDate(score.calculated_at)} />
              </dl>
            ) : (
              <p className="text-sm text-[#607785]">
                Not yet computed — run &quot;Recompute scores &amp; insights&quot; from AI Insights.
              </p>
            )}
          </Card>

          {identityLinks.length > 0 && (
            <Card>
              <SectionHeader title="Identity link (B2C ↔ B2B)" />
              <ul className="space-y-2 text-sm">
                {identityLinks.map((l) => {
                  const otherId = l.customer_a_id === customer.id ? l.customer_b_id : l.customer_a_id;
                  const otherName = l.customer_a_id === customer.id ? l.b_name : l.a_name;
                  const otherCode = l.customer_a_id === customer.id ? l.b_code : l.a_code;
                  const otherType = l.customer_a_id === customer.id ? l.b_type : l.a_type;
                  return (
                    <li key={l.id}>
                      <p className="text-[#14202b]">
                        Same {l.matched_by} as{" "}
                        <Link href={`/customers/${otherId}`} className="text-brand-600 hover:underline">
                          {otherName} ({otherCode} · {otherType})
                        </Link>
                      </p>
                      <p className="text-xs text-[#607785]">
                        Dominant side <strong>{l.dominant_side ?? "—"}</strong> · {l.status}
                        {l.status === "CONFIRMED" && " — promotion restricted to that side"}
                        {l.case_id ? (
                          <>
                            {" · "}
                            <Link href={`/cases/${l.case_id}`} className="text-brand-600 hover:underline">
                              review case
                            </Link>
                          </>
                        ) : null}
                      </p>
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}

          <Card>
            <SectionHeader title="Consent (PDPA)" />
            <ConsentCard
              customerId={customer.id}
              current={currentStatuses}
              history={consentHistory}
            />
          </Card>

          <Card>
            <SectionHeader title="Redeem reward" />
            <RedeemForm customerId={customer.id} rewards={rewards} />
          </Card>

          {customer.cust_type === "B2C" && (
            <Card>
              <SectionHeader title="Only-One (LINE)" />
              <LineLinkForm customerId={customer.id} lineUserId={customer.line_user_id} />
            </Card>
          )}
        </div>

        <div className="space-y-4 lg:col-span-2">
          <Card>
            <SectionHeader title="Record a purchase" />
            <RecordTransactionForm customerId={customer.id} />
          </Card>

          <Card>
            <SectionHeader title="Activity timeline" count={timeline.length} />
            {timeline.length === 0 ? (
              <EmptyState message="No activity yet — record a purchase to get started." />
            ) : (
              <ul className="divide-y divide-[#eef3f5]">
                {timeline.map((item, i) => (
                  <li key={i} className="flex items-center gap-3 py-2 text-sm">
                    <ObjectIcon kind={TIMELINE_ICON[item.kind] ?? "customer"} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[#14202b]">{item.title}</p>
                      <p className="text-xs text-[#607785]">
                        {item.detail ?? ""} {item.detail ? "· " : ""}{formatDate(item.occurred_at)}
                        {item.points ? ` · ${item.points} pts` : ""}
                      </p>
                    </div>
                    {item.amount != null && item.amount > 0 && (
                      <span className="shrink-0 text-[#3c4f5e]">{formatCurrency(item.amount)}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {cases.length > 0 && (
            <Card>
              <SectionHeader icon="setup" title="Cases" count={cases.length} />
              <ul className="divide-y divide-[#eef3f5]">
                {cases.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                    <a href={`/cases/${c.id}`} className="truncate text-brand-600 hover:underline">
                      {c.case_number} · {c.subject}
                    </a>
                    <span className="text-xs text-[#607785]">{c.status}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
