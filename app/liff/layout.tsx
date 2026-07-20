import type { Metadata, Viewport } from "next";
import { LiffProvider } from "./LiffProvider";
import { requireMember } from "@/lib/liffAuth";
import { LIFF_ID, LIFF_CONFIGURED } from "@/lib/liffEnv";

export const metadata: Metadata = {
  title: "Only-One — Cross-brand rewards",
  description: "Your Only-One points across every brand, in one place.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  // Required for env(safe-area-inset-*) to be non-zero on notched devices.
  viewportFit: "cover",
  themeColor: "#12a594",
};

export const dynamic = "force-dynamic";

/**
 * The Only-One mini-app shell. Lives outside app/(app)/, so it inherits none
 * of the staff CRM chrome — same mechanism /login uses.
 */
export default async function LiffLayout({ children }: { children: React.ReactNode }) {
  const auth = await requireMember();

  return (
    <div className="min-h-dvh bg-[#f4f7f8]">
      <LiffProvider
        liffId={LIFF_ID}
        configured={LIFF_CONFIGURED}
        hasSession={auth.ok || (!auth.ok && auth.reason === "UNLINKED")}
      />
      {children}
    </div>
  );
}
