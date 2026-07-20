import { LiffShell } from "./components/ui";
import { RegisterForm } from "./link/RegisterForm";

/**
 * First-time registration, rendered inline at the LIFF endpoint (never via a
 * redirect — see the note in page.tsx about the LIFF login loop).
 */
export function RegisterPanel({ displayName }: { displayName?: string }) {
  const parts = (displayName ?? "").trim().split(/\s+/).filter(Boolean);
  const firstName = parts[0] ?? "";
  const lastName = parts.slice(1).join(" ") ?? "";

  return (
    <LiffShell>
      <div className="rounded-[14px] border border-[#dde5e8] bg-white p-5">
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-50">
            <svg viewBox="0 0 24 24" width={26} height={26} fill="#0d7d70" aria-hidden>
              <path d="M12 3l2.5 5.3 5.5.7-4 4 1 5.7-5-2.8-5 2.8 1-5.7-4-4 5.5-.7z" />
            </svg>
          </div>
          <h1 className="mt-4 text-lg font-bold text-[#14202b]">
            {displayName ? `Welcome, ${displayName}` : "Join Only-One"}
          </h1>
          <p className="mt-2 text-sm text-[#3c4f5e]">
            Create your Only-One membership to start earning points across every
            brand. Just confirm your details.
          </p>
        </div>

        <div className="mt-4">
          <RegisterForm firstName={firstName} lastName={lastName} />
        </div>

        <p className="mt-3 text-center text-xs text-[#607785]">
          Linked to your LINE account. Manage marketing preferences later in
          Account.
        </p>
      </div>
    </LiffShell>
  );
}
