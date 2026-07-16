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
        <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
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
      ? "bg-indigo-600 text-white hover:bg-indigo-700"
      : "border border-slate-300 text-slate-700 hover:bg-slate-100";
  return (
    <Link
      href={href}
      className={`inline-flex items-center rounded-md px-4 py-2 text-sm font-medium ${styles}`}
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
  Bronze: "bg-amber-100 text-amber-800",
  Silver: "bg-slate-200 text-slate-700",
  Gold: "bg-yellow-100 text-yellow-800",
  Platinum: "bg-violet-100 text-violet-700",
};

export function TierBadge({ tier }: { tier: Tier }) {
  return <Badge className={TIER_STYLES[tier]}>{tier}</Badge>;
}

const SOURCE_STATUS_STYLES: Record<SourceStatus, string> = {
  connected: "bg-emerald-100 text-emerald-700",
  syncing: "bg-amber-100 text-amber-700",
  error: "bg-rose-100 text-rose-700",
};

export function SourceStatusBadge({ status }: { status: SourceStatus }) {
  return <Badge className={SOURCE_STATUS_STYLES[status]}>{status}</Badge>;
}

const INTERACTION_STYLES: Record<InteractionType, string> = {
  register: "bg-blue-100 text-blue-700",
  enrichment: "bg-indigo-100 text-indigo-700",
  purchase: "bg-emerald-100 text-emerald-700",
  engagement: "bg-violet-100 text-violet-700",
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
          : "bg-slate-100 text-slate-500"
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
      className={`rounded-lg border border-slate-200 bg-white p-5 shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
      {message}
    </div>
  );
}
