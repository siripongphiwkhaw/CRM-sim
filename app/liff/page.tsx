import Link from "next/link";
import { redirect } from "next/navigation";
import { requireMember, demoAccessAllowed } from "@/lib/liffAuth";
import { LIFF_CONFIGURED } from "@/lib/liffEnv";
import { getCustomer } from "@/db/queries/customers";
import { getMemberHome } from "@/db/queries/loyalty";
import { formatDate } from "@/lib/format";
import type { Tier } from "@/lib/constants";
import {
  LiffShell,
  PointsCard,
  TierRing,
  BrandRow,
  LedgerRow,
  SectionCard,
  LiffEmpty,
  BottomNav,
  DemoBanner,
} from "./components/ui";

export const dynamic = "force-dynamic";

export default async function LiffHomePage() {
  const auth = await requireMember();

  if (!auth.ok) {
    if (auth.reason === "UNLINKED") redirect("/liff/link");
    // No session yet: LiffProvider signs in when LINE is configured; otherwise
    // offer the demo picker if this environment allows it.
    if (!LIFF_CONFIGURED && (await demoAccessAllowed())) redirect("/liff/dev");
    return (
      <LiffShell>
        <p className="py-16 text-center text-sm text-[#607785]">
          Connecting to LINE…
        </p>
      </LiffShell>
    );
  }

  const [member, home] = await Promise.all([
    getCustomer(auth.customerId),
    getMemberHome(auth.customerId),
  ]);
  if (!member) redirect("/liff/link");

  const { summary, brands, recent } = home;
  const totalBrandPoints = brands.reduce((sum, b) => sum + b.points, 0);

  return (
    <>
      <LiffShell>
        {auth.demo && <DemoBanner />}

        <PointsCard
          balance={summary.balance}
          tier={summary.tier as Tier}
          memberCode={member.member_code}
          name={`${member.first_name} ${member.last_name}`}
        />

        <div className="mt-3">
          <TierRing
            lifetime={summary.lifetime}
            tierAt={summary.tier_at}
            nextTierAt={summary.next_tier_at}
            nextTier={summary.next_tier as Tier | null}
            tier={summary.tier as Tier}
          />
        </div>

        <div className="mt-3">
          <SectionCard title="Where you earned">
            {brands.length === 0 ? (
              <LiffEmpty message="No purchases yet. Points appear here once you shop." />
            ) : (
              <div>
                {brands.map((b) => (
                  <BrandRow
                    key={b.brand}
                    brand={b.brand}
                    points={b.points}
                    share={totalBrandPoints > 0 ? b.points / totalBrandPoints : 0}
                  />
                ))}
                <p className="mt-2 text-xs text-[#607785]">
                  One balance, every brand — that&apos;s the Only-One idea.
                </p>
              </div>
            )}
          </SectionCard>
        </div>

        <div className="mt-3">
          <SectionCard
            title="Recent activity"
            action={
              <Link href="/liff/history" className="text-xs font-medium text-brand-700">
                See all
              </Link>
            }
          >
            {recent.length === 0 ? (
              <LiffEmpty message="Nothing here yet." />
            ) : (
              <ul className="divide-y divide-[#eef3f5]">
                {recent.map((e) => (
                  <LedgerRow
                    key={e.id}
                    title={e.note ?? e.entry_type}
                    detail={formatDate(e.occurred_at)}
                    points={e.points}
                    isCredit={e.entry_type === "EARN"}
                  />
                ))}
              </ul>
            )}
          </SectionCard>
        </div>
      </LiffShell>
      <BottomNav active="/liff" />
    </>
  );
}
