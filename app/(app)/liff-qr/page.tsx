import QRCode from "qrcode";
import { requireSession } from "@/lib/session";
import { LIFF_URL, LIFF_CONFIGURED } from "@/lib/liffEnv";
import { PageHeader, Card, EmptyState } from "@/app/components/ui";

export const dynamic = "force-dynamic";

/**
 * A scannable QR to the Only-One LIFF app, for staff to show or print so a
 * member can open it from LINE. Encodes the liff.line.me link (which LINE
 * resolves to the deployed endpoint), so it works regardless of the CRM's own
 * URL. The SVG is generated server-side — no client JS, CSP-safe.
 */
export default async function LiffQrPage() {
  await requireSession();

  const svg = LIFF_URL
    ? await QRCode.toString(LIFF_URL, {
        type: "svg",
        margin: 1,
        errorCorrectionLevel: "M",
        color: { dark: "#14202b", light: "#ffffff" },
      })
    : "";

  return (
    <div>
      <PageHeader
        icon="loyalty"
        overline="Only-One"
        title="Member app QR"
        subtitle="Let a member scan this to open Only-One in LINE"
      />

      {!LIFF_CONFIGURED ? (
        <EmptyState message="LINE isn't configured yet. Set NEXT_PUBLIC_LIFF_ID and LINE_CHANNEL_ID, then this QR appears." />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <div className="flex flex-col items-center">
              <div
                className="w-full max-w-[280px] [&>svg]:h-auto [&>svg]:w-full"
                // eslint-disable-next-line react/no-danger
                dangerouslySetInnerHTML={{ __html: svg }}
              />
              <a
                href={LIFF_URL}
                className="mt-3 break-all text-center font-mono text-xs text-brand-600 hover:underline"
              >
                {LIFF_URL}
              </a>
            </div>
          </Card>

          <Card>
            <h2 className="text-sm font-bold text-[#14202b]">How members use it</h2>
            <ol className="mt-2 space-y-2 text-sm text-[#3c4f5e]">
              <li className="flex gap-2">
                <span className="font-semibold text-brand-600">1.</span>
                Open LINE on your phone and tap the QR scanner (Home tab, top-right).
              </li>
              <li className="flex gap-2">
                <span className="font-semibold text-brand-600">2.</span>
                Scan this code — Only-One opens inside LINE, already signed in.
              </li>
              <li className="flex gap-2">
                <span className="font-semibold text-brand-600">3.</span>
                First time: fill the short registration (phone + email). After
                that it opens straight to your points.
              </li>
            </ol>
            <p className="mt-3 rounded-[9px] bg-[#f8fafb] px-3 py-2 text-xs text-[#607785]">
              Scanning with the phone camera also works, but the in-LINE scanner
              gives the smoothest sign-in.
            </p>
          </Card>
        </div>
      )}
    </div>
  );
}
