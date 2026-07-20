import { notFound } from "next/navigation";
import { demoAccessAllowed } from "@/lib/liffAuth";
import { DEV_FALLBACK_ENABLED } from "@/lib/liffEnv";
import { listB2cMembers } from "@/db/queries/member";
import { LiffShell } from "../components/ui";
import { MemberPicker } from "./MemberPicker";

export const dynamic = "force-dynamic";

/**
 * Demo member picker — stands in for a real LINE sign-in when LINE isn't
 * configured. Reachable only in local dev with LIFF_DEV_FALLBACK=1, or for a
 * signed-in staff user previewing a deployment that has no LINE credentials.
 *
 * This route guard is the first line, not the only one: impersonateMemberAction
 * re-checks authorisation itself, because a server action is an independently
 * addressable POST endpoint regardless of whether this page renders.
 */
export default async function LiffDevPage() {
  if (!(await demoAccessAllowed())) notFound();

  const members = await listB2cMembers();

  return (
    <LiffShell>
      <h1 className="text-lg font-bold text-[#14202b]">Choose a member</h1>
      <p className="mb-3 mt-0.5 text-sm text-[#607785]">
        {DEV_FALLBACK_ENABLED
          ? "Local preview — LINE is not configured, so pick a member to open Only-One as."
          : "Staff preview — you are opening Only-One as this member."}
      </p>
      <MemberPicker members={members} />
    </LiffShell>
  );
}
