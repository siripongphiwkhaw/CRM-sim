import Link from "next/link";
import type { Tier } from "@/lib/constants";

/**
 * Only-One mini-app primitives. Deliberately separate from app/components/ui.tsx,
 * which is desktop-CRM-flavoured: 12px-dominant type and hover-driven states.
 * Everything here assumes a thumb, so tap targets are >=44px and body text
 * never drops below 14px (inputs never below 16px — iOS Safari auto-zooms).
 */

const TIER_RING: Record<Tier, string> = {
  Bronze: "#b0702c",
  Silver: "#8c9aa3",
  Gold: "#c8b27a",
};

export function LiffShell({ children }: { children: React.ReactNode }) {
  // pb leaves room for the fixed bottom nav plus the home indicator.
  return (
    <div className="mx-auto w-full max-w-md px-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-[calc(1rem+env(safe-area-inset-top))]">
      {children}
    </div>
  );
}

export function PointsCard({
  balance,
  tier,
  memberCode,
  name,
}: {
  balance: number;
  tier: Tier;
  memberCode: string;
  name: string;
}) {
  return (
    <div className="rounded-[20px] bg-gradient-to-br from-brand-600 to-brand-800 px-5 py-6 text-white shadow-[0_6px_20px_rgba(13,125,112,0.25)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-white/70">Only-One</p>
          <p className="mt-0.5 truncate text-sm text-white/90">{name}</p>
        </div>
        <span
          className="shrink-0 rounded-full px-2.5 py-1 text-xs font-bold"
          style={{ backgroundColor: TIER_RING[tier], color: "#1c1206" }}
        >
          {tier}
        </span>
      </div>
      <p className="mt-5 text-[40px] font-bold leading-none tabular-nums">
        {balance.toLocaleString("en-US")}
      </p>
      <p className="mt-1 text-sm text-white/80">points available</p>
      <p className="mt-4 font-mono text-xs text-white/60">{memberCode}</p>
    </div>
  );
}

/**
 * Progress from the current tier's floor to the next tier's threshold.
 * Needs `tier_at` (the floor) — without it the arc has no meaningful start.
 * A member at the top tier has no next threshold, so the ring reads full
 * rather than dividing by zero.
 */
export function TierRing({
  lifetime,
  tierAt,
  nextTierAt,
  nextTier,
  tier,
}: {
  lifetime: number;
  tierAt: number;
  nextTierAt: number | null;
  nextTier: Tier | null;
  tier: Tier;
}) {
  const span = nextTierAt === null ? 0 : Math.max(1, nextTierAt - tierAt);
  const done = nextTierAt === null ? 1 : Math.min(1, Math.max(0, (lifetime - tierAt) / span));
  const remaining = nextTierAt === null ? 0 : Math.max(0, nextTierAt - lifetime);

  const r = 34;
  const circumference = 2 * Math.PI * r;

  return (
    <div className="flex items-center gap-4 rounded-[14px] border border-[#dde5e8] bg-white p-4">
      <svg width="84" height="84" viewBox="0 0 84 84" aria-hidden className="shrink-0">
        <circle cx="42" cy="42" r={r} fill="none" stroke="#eef3f5" strokeWidth="9" />
        <circle
          cx="42"
          cy="42"
          r={r}
          fill="none"
          stroke={TIER_RING[tier]}
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - done)}
          transform="rotate(-90 42 42)"
        />
        <text
          x="42"
          y="47"
          textAnchor="middle"
          className="fill-[#14202b] text-[15px] font-bold"
        >
          {Math.round(done * 100)}%
        </text>
      </svg>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-[#14202b]">{tier} member</p>
        {nextTier ? (
          <p className="mt-1 text-sm text-[#607785]">
            <span className="font-semibold text-[#14202b]">
              {remaining.toLocaleString("en-US")}
            </span>{" "}
            more lifetime points to {nextTier}
          </p>
        ) : (
          <p className="mt-1 text-sm text-[#607785]">Top tier — you&apos;ve earned the best rate.</p>
        )}
        <p className="mt-1 text-xs text-[#607785]">
          {lifetime.toLocaleString("en-US")} lifetime points earned
        </p>
      </div>
    </div>
  );
}

export function BrandRow({
  brand,
  points,
  share,
}: {
  brand: string;
  points: number;
  share: number;
}) {
  return (
    <div className="py-2">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="truncate text-[#14202b]">{brand}</span>
        <span className="shrink-0 font-semibold tabular-nums text-[#14202b]">
          {points.toLocaleString("en-US")}
        </span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[#eef3f5]">
        <div
          className="h-full rounded-full bg-brand-500"
          style={{ width: `${Math.max(2, Math.round(share * 100))}%` }}
        />
      </div>
    </div>
  );
}

export function LedgerRow({
  title,
  detail,
  points,
  isCredit,
}: {
  title: string;
  detail: string;
  points: number;
  isCredit: boolean;
}) {
  return (
    <li className="flex items-center justify-between gap-3 py-3">
      <div className="min-w-0">
        <p className="truncate text-sm text-[#14202b]">{title}</p>
        <p className="mt-0.5 truncate text-xs text-[#607785]">{detail}</p>
      </div>
      <span
        className={`shrink-0 text-sm font-semibold tabular-nums ${
          isCredit ? "text-[#194e31]" : "text-[#8e030f]"
        }`}
      >
        {isCredit ? "+" : "−"}
        {points.toLocaleString("en-US")}
      </span>
    </li>
  );
}

export function SectionCard({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[14px] border border-[#dde5e8] bg-white p-4">
      <div className="mb-1 flex items-center justify-between gap-2">
        <h2 className="text-sm font-bold text-[#14202b]">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function LiffEmpty({ message }: { message: string }) {
  return (
    <p className="py-6 text-center text-sm text-[#607785]">{message}</p>
  );
}

const NAV = [
  { href: "/liff", label: "Points", icon: "M12 3l2.5 5.3 5.5.7-4 4 1 5.7-5-2.8-5 2.8 1-5.7-4-4 5.5-.7z" },
  { href: "/liff/history", label: "History", icon: "M13 3a9 9 0 1 0 8.9 10.5h-2.1A7 7 0 1 1 13 5v4l5-4.5L13 0v3zm-1 5v5.4l4.5 2.7.8-1.3-3.8-2.3V8H12z" },
  { href: "/liff/rewards", label: "Rewards", icon: "M20 7h-2.2a3 3 0 0 0-4.8-3.5A3 3 0 0 0 6.2 7H4v5h1v8h14v-8h1V7zm-6.5-2a1 1 0 1 1 1 1h-1V5zm-4 0a1 1 0 0 1 1 1h-1a1 1 0 0 1 0-2zM11 18H7v-6h4v6zm6 0h-4v-6h4v6z" },
  { href: "/liff/account", label: "Account", icon: "M12 5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7zm0 8.5c3.6 0 6.5 1.8 6.5 4V19h-13v-1.5c0-2.2 2.9-4 6.5-4z" },
];

export function BottomNav({ active }: { active: string }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-[#dde5e8] bg-white pb-[env(safe-area-inset-bottom)]">
      <ul className="mx-auto flex w-full max-w-md">
        {NAV.map((item) => {
          const on = item.href === active;
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={on ? "page" : undefined}
                className={`flex min-h-[56px] flex-col items-center justify-center gap-0.5 text-[11px] ${
                  on ? "font-semibold text-brand-700" : "text-[#607785]"
                }`}
              >
                <svg viewBox="0 0 24 24" width={22} height={22} fill="currentColor" aria-hidden>
                  <path d={item.icon} />
                </svg>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function DemoBanner() {
  return (
    <div className="mb-3 rounded-[14px] border border-[#f0d7a8] bg-[#fff5ec] px-3 py-2 text-xs text-[#8a4b1e]">
      Preview mode — you are viewing this member&apos;s account, not a real LINE sign-in.
    </div>
  );
}
