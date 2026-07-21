import { redirect } from "next/navigation";
import { requireMember } from "@/lib/liffAuth";
import { getCustomer } from "@/db/queries/customers";
import { getCurrentConsents } from "@/db/queries/consent";
import { getLoyaltySummary } from "@/db/queries/loyalty";
import { CONSENT_PURPOSES, CONSENT_PURPOSE_LABELS } from "@/lib/constants";
import { maskLineId } from "@/lib/format";
import { LIFF_URL } from "@/lib/liffEnv";
import { LiffShell, SectionCard, BottomNav, DemoBanner } from "../components/ui";
import { ConsentToggle } from "./ConsentToggle";
import { SignOutButton } from "./SignOutButton";
import { ReferralShare } from "./ReferralShare";

export const dynamic = "force-dynamic";

const CONSENT_COPY: Record<string, string> = {
  MARKETING: "Offers and news from Only-One brands.",
  ANALYTICS: "Helps us understand how the programme is used.",
  PROFILING: "Personalised rewards based on what you buy.",
};

export default async function LiffAccountPage() {
  const auth = await requireMember();
  if (!auth.ok) redirect("/liff");

  const [member, consents, summary] = await Promise.all([
    getCustomer(auth.customerId),
    getCurrentConsents(auth.customerId),
    getLoyaltySummary(auth.customerId),
  ]);
  if (!member) redirect("/liff/link");

  return (
    <>
      <LiffShell>
        {auth.demo && <DemoBanner />}
        <h1 className="mb-3 text-lg font-bold text-[#14202b]">Account</h1>

        <SectionCard title="Membership">
          <dl className="divide-y divide-[#eef3f5] text-sm">
            <div className="flex justify-between gap-3 py-2">
              <dt className="text-[#607785]">Name</dt>
              <dd className="text-right text-[#14202b]">
                {member.first_name} {member.last_name}
              </dd>
            </div>
            <div className="flex justify-between gap-3 py-2">
              <dt className="text-[#607785]">Member code</dt>
              <dd className="text-right font-mono text-xs text-[#14202b]">{member.member_code}</dd>
            </div>
            <div className="flex justify-between gap-3 py-2">
              <dt className="text-[#607785]">Tier</dt>
              <dd className="text-right text-[#14202b]">
                {summary.tier} · ×{summary.multiplier.toFixed(2)} earn rate
              </dd>
            </div>
            <div className="flex justify-between gap-3 py-2">
              <dt className="text-[#607785]">LINE</dt>
              <dd className="text-right text-[#14202b]">
                {member.line_user_id ? (
                  <>
                    Linked ·{" "}
                    <span className="font-mono text-xs">{maskLineId(member.line_user_id)}</span>
                  </>
                ) : (
                  "Not linked"
                )}
              </dd>
            </div>
          </dl>
        </SectionCard>

        {member.referral_code && LIFF_URL && (
          <div className="mt-3">
            <SectionCard title="Invite friends">
              <ReferralShare
                code={member.referral_code}
                shareUrl={`${LIFF_URL}?ref=${member.referral_code}`}
              />
            </SectionCard>
          </div>
        )}

        <div className="mt-3">
          <SectionCard title="Privacy preferences">
            <div className="divide-y divide-[#eef3f5]">
              {CONSENT_PURPOSES.map((p) => (
                <ConsentToggle
                  key={p}
                  purpose={p}
                  label={CONSENT_PURPOSE_LABELS[p]}
                  description={CONSENT_COPY[p] ?? ""}
                  granted={consents[p]?.status === "GRANTED"}
                />
              ))}
            </div>
            <p className="mt-2 text-xs text-[#607785]">
              You can change these at any time. Every change is recorded with a date.
            </p>
          </SectionCard>
        </div>

        <div className="mt-3">
          <SignOutButton />
        </div>
      </LiffShell>
      <BottomNav active="/liff/account" />
    </>
  );
}
