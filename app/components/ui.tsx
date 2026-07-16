import Link from "next/link";
import type {
  Tier,
  SourceStatus,
  InteractionType,
} from "@/lib/constants";
import { INTERACTION_TYPE_LABELS } from "@/lib/constants";

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex items-start justify-between gap-4">
      <div>
        <h1 className="font-display text-3xl text-stone-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-stone-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function LinkButton({
  href,
  children,
  variant = "primary",
}: {
  href: string;
  children: React.ReactNode;
  variant?: "primary" | "secondary";
}) {
  const styles =
    variant === "primary"
      ? "bg-brand-600 text-white shadow-sm hover:bg-brand-700"
      : "border border-stone-300 bg-white text-stone-700 hover:border-brand-600 hover:text-brand-700";
  return (
    <Link
      href={href}
      className={`inline-flex items-center rounded-full px-5 py-2 text-sm font-medium transition-colors ${styles}`}
    >
      {children}
    </Link>
  );
}

function Badge({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${className}`}
    >
      {children}
    </span>
  );
}

const TIER_STYLES: Record<Tier, string> = {
  Bronze: "bg-cream-200 text-amber-900",
  Silver: "bg-stone-200 text-stone-700",
  Gold: "bg-gold-400/30 text-gold-600",
  Platinum: "bg-stone-800 text-cream-100",
};

export function TierBadge({ tier }: { tier: Tier }) {
  return <Badge className={TIER_STYLES[tier]}>{tier}</Badge>;
}

const SOURCE_STATUS_STYLES: Record<SourceStatus, string> = {
  connected: "bg-emerald-100 text-emerald-700",
  syncing: "bg-amber-100 text-amber-700",
  error: "bg-brand-100 text-brand-700",
};

export function SourceStatusBadge({ status }: { status: SourceStatus }) {
  return <Badge className={SOURCE_STATUS_STYLES[status]}>{status}</Badge>;
}

const INTERACTION_STYLES: Record<InteractionType, string> = {
  register: "bg-sky-100 text-sky-700",
  enrichment: "bg-cream-200 text-amber-800",
  purchase: "bg-emerald-100 text-emerald-700",
  engagement: "bg-brand-100 text-brand-700",
};

export function InteractionBadge({ type }: { type: InteractionType }) {
  return (
    <Badge className={INTERACTION_STYLES[type]}>
      {INTERACTION_TYPE_LABELS[type]}
    </Badge>
  );
}

export function ConsentPill({ granted, label }: { granted: boolean; label: string }) {
  return (
    <Badge
      className={
        granted
          ? "bg-emerald-100 text-emerald-700"
          : "bg-stone-100 text-stone-500"
      }
    >
      {granted ? "✓" : "✕"} {label}
    </Badge>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-stone-200/80 bg-white p-5 shadow-[0_1px_3px_rgba(41,37,36,0.06)] ${className}`}
    >
      {children}
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-8 text-center text-sm text-stone-500">
      {message}
    </div>
  );
}
