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
import { EarnDemoForm } from "./components/EarnDemoForm";
import { RegisterPanel } from "./RegisterPanel";

export const dynamic = "force-dynamic";

export default async function LiffHomePage() {
  const auth = await requireMember();

  if (!auth.ok) {
    // First-time user: render the registration form INLINE. Never redirect to
    // another path here — the LINE LIFF login round-trip completes at the
    // endpoint URL, and a server redirect mid-login makes the SDK re-trigger
    // login endlessly (ERR_TOO_MANY_REDIRECTS).
    if (auth.reason === "UNLINKED") {
      return <RegisterPanel displayName={auth.displayName} />;
    }
    // No session yet: locally, offer the demo picker; in production LiffProvider
    // signs the member in and refreshes.
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
  // Cache says linked but the row is gone (rare) — show registration inline
  // rather than redirecting, same reason as above.
  if (!member) return <RegisterPanel displayName={undefined} />;

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
          <SectionCard title="Add points (demo)">
            <p className="mb-2 text-xs text-[#607785]">
              Simulate a purchase at any brand — it writes a real transaction to
              the CRM and your balance updates here.
            </p>
            <EarnDemoForm />
          </SectionCard>
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
