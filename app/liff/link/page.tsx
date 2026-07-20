import { redirect } from "next/navigation";
import { requireMember } from "@/lib/liffAuth";
import { LiffShell } from "../components/ui";
import { LinkRequestForm } from "./LinkRequestForm";

export const dynamic = "force-dynamic";

/**
 * Terminus for a verified LINE user with no membership yet.
 *
 * Linking is staff-assisted on purpose. The obvious alternative — "enter your
 * phone number to find your membership" — is an account-takeover vector: phone
 * numbers aren't secrets, and a match would hand over the balance plus the
 * ability to spend it. Phone OTP would be the safe version of that.
 */
export default async function LiffLinkPage() {
  const auth = await requireMember();
  if (auth.ok) redirect("/liff");
  if (auth.reason === "NO_SESSION") redirect("/liff");

  return (
    <LiffShell>
      <div className="rounded-[14px] border border-[#dde5e8] bg-white p-5 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-50">
          <svg viewBox="0 0 24 24" width={26} height={26} fill="none" stroke="#0d7d70" strokeWidth="2" aria-hidden>
            <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.5 1.5" strokeLinecap="round" />
            <path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7L12 19" strokeLinecap="round" />
          </svg>
        </div>

        <h1 className="mt-4 text-lg font-bold text-[#14202b]">
          {auth.displayName ? `Hi ${auth.displayName}` : "Almost there"}
        </h1>
        <p className="mt-2 text-sm text-[#3c4f5e]">
          Your LINE account isn&apos;t linked to an Only-One membership yet. Send a
          request and our team will connect it for you.
        </p>

        <div className="mt-4 rounded-[12px] bg-[#f8fafb] px-3 py-2 text-left">
          <p className="text-xs text-[#607785]">Your LINE reference</p>
          <p className="mt-0.5 break-all font-mono text-xs text-[#14202b]">{auth.lineUserId}</p>
        </div>

        <div className="mt-4">
          <LinkRequestForm />
        </div>
      </div>
    </LiffShell>
  );
}
