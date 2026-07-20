import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireMember } from "@/lib/liffAuth";
import { getReward, getBalance } from "@/db/queries/loyalty";
import { LiffShell, BottomNav } from "../../components/ui";
import { RedeemForm } from "./RedeemForm";

export const dynamic = "force-dynamic";

export default async function LiffRewardDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const auth = await requireMember();
  if (!auth.ok) redirect("/liff");

  const { id } = await params;
  const rewardId = Number(id);
  if (!Number.isFinite(rewardId)) notFound();

  const [reward, balance] = await Promise.all([getReward(rewardId), getBalance(auth.customerId)]);
  if (!reward) notFound();

  const affordable = balance >= reward.points_cost && Boolean(reward.active);
  const short = reward.points_cost - balance;

  return (
    <>
      <LiffShell>
        <Link href="/liff/rewards" className="text-sm text-brand-700">
          ← Rewards
        </Link>

        <div className="mt-3 rounded-[14px] border border-[#dde5e8] bg-white p-5">
          <p className="text-xs uppercase tracking-wide text-[#607785]">{reward.reward_type}</p>
          <h1 className="mt-1 text-lg font-bold text-[#14202b]">{reward.name}</h1>
          {reward.description && (
            <p className="mt-2 text-sm text-[#3c4f5e]">{reward.description}</p>
          )}

          <div className="mt-4 flex items-baseline justify-between border-t border-[#eef3f5] pt-4">
            <span className="text-sm text-[#607785]">Cost</span>
            <span className="text-xl font-bold tabular-nums text-[#14202b]">
              {reward.points_cost.toLocaleString("en-US")} pts
            </span>
          </div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-sm text-[#607785]">Your balance</span>
            <span className="text-sm font-medium tabular-nums text-[#14202b]">
              {balance.toLocaleString("en-US")} pts
            </span>
          </div>

          {!reward.active && (
            <p className="mt-3 rounded-[12px] bg-[#eef3f5] px-3 py-2 text-sm text-[#607785]">
              This reward is no longer available.
            </p>
          )}
          {reward.active && !affordable && (
            <p className="mt-3 rounded-[12px] bg-[#fff5ec] px-3 py-2 text-sm text-[#8a4b1e]">
              You need {short.toLocaleString("en-US")} more points. Keep shopping at any
              Only-One brand — they all add to the same balance.
            </p>
          )}

          <div className="mt-4">
            <RedeemForm rewardId={reward.id} affordable={affordable} />
          </div>
        </div>
      </LiffShell>
      <BottomNav active="/liff/rewards" />
    </>
  );
}
