import Link from "next/link";
import { redirect } from "next/navigation";
import { requireMember } from "@/lib/liffAuth";
import { listRewards, getBalance } from "@/db/queries/loyalty";
import { LiffShell, SectionCard, LiffEmpty, BottomNav } from "../components/ui";

export const dynamic = "force-dynamic";

export default async function LiffRewardsPage() {
  const auth = await requireMember();
  if (!auth.ok) redirect("/liff");

  const [rewards, balance] = await Promise.all([
    listRewards({ activeOnly: true }),
    getBalance(auth.customerId),
  ]);

  return (
    <>
      <LiffShell>
        <h1 className="text-lg font-bold text-[#14202b]">Rewards</h1>
        <p className="mb-3 mt-0.5 text-sm text-[#607785]">
          You have{" "}
          <span className="font-semibold text-[#14202b]">
            {balance.toLocaleString("en-US")}
          </span>{" "}
          points to spend.
        </p>

        {rewards.length === 0 ? (
          <SectionCard title="Catalog">
            <LiffEmpty message="No rewards available right now." />
          </SectionCard>
        ) : (
          <ul className="space-y-2">
            {rewards.map((r) => {
              const affordable = balance >= r.points_cost;
              const short = r.points_cost - balance;
              return (
                <li key={r.id}>
                  {/* Unaffordable rewards stay tappable on purpose — the detail
                      screen explains how far off you are, rather than the card
                      being a silently dead control. */}
                  <Link
                    href={`/liff/rewards/${r.id}`}
                    className={`flex min-h-[64px] items-center justify-between gap-3 rounded-[14px] border bg-white px-4 py-3 ${
                      affordable ? "border-[#dde5e8]" : "border-[#eef3f5]"
                    }`}
                  >
                    <div className="min-w-0">
                      <p
                        className={`truncate text-sm font-medium ${
                          affordable ? "text-[#14202b]" : "text-[#607785]"
                        }`}
                      >
                        {r.name}
                      </p>
                      <p className="mt-0.5 text-xs text-[#607785]">
                        {affordable
                          ? `${r.points_cost.toLocaleString("en-US")} points`
                          : `Need ${short.toLocaleString("en-US")} more points`}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
                        affordable
                          ? "bg-brand-50 text-brand-700"
                          : "bg-[#eef3f5] text-[#607785]"
                      }`}
                    >
                      {r.points_cost.toLocaleString("en-US")}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </LiffShell>
      <BottomNav active="/liff/rewards" />
    </>
  );
}
