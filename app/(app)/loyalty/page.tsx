import Link from "next/link";
import {
  getLiabilityStats,
  getTierRules,
  listRewards,
  listRecentLedger,
} from "@/db/queries/loyalty";
import { getSession } from "@/lib/session";
import { PageHeader, Card, SectionHeader, EmptyState, StatTile } from "@/app/components/ui";
import { formatDate } from "@/lib/format";
import { RewardForm } from "./RewardForm";
import { RewardActiveToggle } from "./RewardActiveToggle";

export const dynamic = "force-dynamic";

export default async function LoyaltyPage() {
  const [liability, tiers, rewards, ledger, session] = await Promise.all([
    getLiabilityStats(),
    getTierRules(),
    listRewards(),
    listRecentLedger(20),
    getSession(),
  ]);
  const isAdmin = session.role === "admin";

  return (
    <div>
      <PageHeader
        icon="loyalty"
        overline="Loyalty"
        title="Loyalty Management"
        subtitle="Points liability, tiers, rewards catalog and the ledger feed"
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Outstanding points" value={liability.outstanding.toLocaleString("en-US")} />
        <StatTile label="Points earned" value={liability.earned.toLocaleString("en-US")} tone="positive" />
        <StatTile label="Points burned" value={liability.burned.toLocaleString("en-US")} />
        <StatTile label="Redemption rate" value={`${liability.redemption_rate}%`} tone="brand" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <SectionHeader title="Rewards catalog" count={rewards.length} />
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-left text-xs font-semibold uppercase tracking-wide text-[#3c4f5e]">
                  <tr>
                    <th className="py-2 pr-2">Code</th>
                    <th className="py-2 pr-2">Reward</th>
                    <th className="py-2 pr-2">Type</th>
                    <th className="py-2 pr-2 text-right">Cost</th>
                    <th className="py-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#eef3f5]">
                  {rewards.map((r) => (
                    <tr key={r.id}>
                      <td className="py-2 pr-2 font-mono text-xs text-[#607785]">{r.code}</td>
                      <td className="py-2 pr-2 text-[#14202b]">{r.name}</td>
                      <td className="py-2 pr-2 text-[#607785]">{r.reward_type}</td>
                      <td className="py-2 pr-2 text-right text-[#14202b]">{r.points_cost.toLocaleString("en-US")}</td>
                      <td className="py-2">
                        {isAdmin ? (
                          <RewardActiveToggle id={r.id} active={!!r.active} />
                        ) : (
                          <span className="text-xs text-[#607785]">{r.active ? "Active" : "Inactive"}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {isAdmin && (
              <div className="mt-4">
                <RewardForm />
              </div>
            )}
          </Card>

          <Card>
            <SectionHeader title="Recent ledger" count={ledger.length} />
            {ledger.length === 0 ? (
              <EmptyState message="No ledger activity yet." />
            ) : (
              <ul className="divide-y divide-[#eef3f5]">
                {ledger.map((e) => (
                  <li key={e.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                    <div className="min-w-0">
                      <Link href={`/customers/${e.customer_id}`} className="truncate font-medium text-brand-600 hover:underline">
                        {e.member_name}
                      </Link>
                      <p className="text-xs text-[#607785]">{e.note ?? e.entry_type} · {formatDate(e.occurred_at)}</p>
                    </div>
                    <span className={`shrink-0 font-medium ${e.entry_type === "EARN" ? "text-[#194e31]" : "text-[#8e030f]"}`}>
                      {e.entry_type === "EARN" ? "+" : "−"}{e.points.toLocaleString("en-US")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div>
          <Card>
            <SectionHeader title="Tier ladder" />
            <ul className="space-y-3">
              {tiers.map((t) => (
                <li key={t.tier} className="flex items-center justify-between text-sm">
                  <span className="font-medium text-[#14202b]">{t.tier}</span>
                  <span className="text-xs text-[#607785]">
                    ≥ {t.min_lifetime_points.toLocaleString("en-US")} pts · ×{t.multiplier.toFixed(2)}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs text-[#607785]">
              Tier is set by lifetime earned points. The earn multiplier applies to
              every purchase; the ledger is the system of record for the balance.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
