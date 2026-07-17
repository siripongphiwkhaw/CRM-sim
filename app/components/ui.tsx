import Link from "next/link";
import type {
  Tier,
  SourceStatus,
  InteractionType,
} from "@/lib/constants";
import { INTERACTION_TYPE_LABELS } from "@/lib/constants";

/* ---------- Object icons (SLDS-style colored squares) ---------- */

export type ObjectKind =
  | "home"
  | "customer"
  | "product"
  | "channel"
  | "datacloud"
  | "sql"
  | "setup"
  | "search";

const OBJECT_ICONS: Record<ObjectKind, { bg: string; glyph: React.ReactNode }> = {
  home: {
    bg: "#0176d3",
    glyph: <path d="M12 4 3 11h2.5v7h5v-4h3v4h5v-7H21z" />,
  },
  customer: {
    bg: "#a094ed",
    glyph: (
      <path d="M12 5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7zm0 8.5c3.6 0 6.5 1.8 6.5 4V19h-13v-1.5c0-2.2 2.9-4 6.5-4z" />
    ),
  },
  product: {
    bg: "#fcb95b",
    glyph: <path d="M12 3 4 7v10l8 4 8-4V7l-8-4zm0 2.3L17.5 8 12 10.7 6.5 8 12 5.3zM6 9.6l5 2.5v6.3l-5-2.5V9.6zm12 6.3-5 2.5v-6.3l5-2.5v6.3z" />,
  },
  channel: {
    bg: "#2e844a",
    glyph: <path d="M4 5h16v3l-1.5 2v9h-13V10L4 8V5zm4.5 8H12v4H8.5v-4z" />,
  },
  datacloud: {
    bg: "#0176d3",
    glyph: (
      <path d="M7 18a4 4 0 0 1-.6-7.95A5.5 5.5 0 0 1 17 8.3 4.5 4.5 0 0 1 16.5 18H7z" />
    ),
  },
  sql: {
    bg: "#032d60",
    glyph: <path d="M4 5h16v14H4V5zm3 4 3 3-3 3 1.2 1.2L12.4 12 8.2 7.8 7 9zm6 6h5v1.6h-5V15z" />,
  },
  setup: {
    bg: "#706e6b",
    glyph: (
      <path d="M12 8.5A3.5 3.5 0 1 1 12 15.5 3.5 3.5 0 0 1 12 8.5zm8 4.5-.1 1.6-2.2.5a6 6 0 0 1-.6 1.4l1.2 1.9-1.2 1.2-1.9-1.2a6 6 0 0 1-1.4.6l-.5 2.2h-1.7l-.5-2.2a6 6 0 0 1-1.4-.6l-1.9 1.2-1.2-1.2 1.2-1.9a6 6 0 0 1-.6-1.4l-2.2-.5V12l2.2-.5a6 6 0 0 1 .6-1.4L6.5 8.2l1.2-1.2 1.9 1.2a6 6 0 0 1 1.4-.6l.5-2.2h1.7l.5 2.2a6 6 0 0 1 1.4.6l1.9-1.2 1.2 1.2-1.2 1.9a6 6 0 0 1 .6 1.4l2.2.5z" />
    ),
  },
  search: {
    bg: "#706e6b",
    glyph: (
      <path d="M10 4a6 6 0 1 1 0 12 6 6 0 0 1 0-12zm0 2.2A3.8 3.8 0 1 0 10 13.8 3.8 3.8 0 0 0 10 6.2zM15.3 14l4.7 4.7-1.3 1.3-4.7-4.7 1.3-1.3z" />
    ),
  },
};

export function ObjectIcon({
  kind,
  size = "md",
}: {
  kind: ObjectKind;
  size?: "sm" | "md" | "lg";
}) {
  const { bg, glyph } = OBJECT_ICONS[kind];
  const px = size === "lg" ? 40 : size === "md" ? 32 : 24;
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-lg"
      style={{ backgroundColor: bg, width: px, height: px }}
    >
      <svg viewBox="0 0 24 24" width={px * 0.62} height={px * 0.62} fill="#fff" aria-hidden>
        {glyph}
      </svg>
    </span>
  );
}

/* ---------- Page & object-home headers ---------- */

export function PageHeader({
  title,
  subtitle,
  icon,
  overline,
  action,
}: {
  title: string;
  subtitle?: string;
  icon?: ObjectKind;
  overline?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-4 rounded border border-[#e5e5e5] bg-white px-4 py-3">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {icon && <ObjectIcon kind={icon} size="lg" />}
          <div>
            {overline && (
              <p className="text-xs text-[#706e6b]">{overline}</p>
            )}
            <h1 className="text-xl font-bold text-[#181818]">{title}</h1>
            {subtitle && <p className="text-xs text-[#706e6b]">{subtitle}</p>}
          </div>
        </div>
        {action && <div className="flex items-center gap-2">{action}</div>}
      </div>
    </div>
  );
}

/* ---------- Buttons ---------- */

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
      ? "border border-brand-600 bg-brand-600 text-white hover:bg-brand-700 hover:border-brand-700"
      : "border border-[#c9c9c9] bg-white text-brand-600 hover:bg-[#f3f3f3]";
  return (
    <Link
      href={href}
      className={`inline-flex items-center rounded px-4 py-1.5 text-sm font-medium transition-colors ${styles}`}
    >
      {children}
    </Link>
  );
}

/* ---------- Badges ---------- */

function Badge({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ${className}`}
    >
      {children}
    </span>
  );
}

const TIER_STYLES: Record<Tier, string> = {
  Bronze: "bg-cream-200 text-amber-900",
  Silver: "bg-[#ecebea] text-[#514f4d]",
  Gold: "bg-gold-400/30 text-gold-600",
  Platinum: "bg-brand-800 text-white",
};

export function TierBadge({ tier }: { tier: Tier }) {
  return <Badge className={TIER_STYLES[tier]}>{tier}</Badge>;
}

const SOURCE_STATUS_STYLES: Record<SourceStatus, string> = {
  connected: "bg-[#cdefc4] text-[#194e31]",
  syncing: "bg-[#fbf3e0] text-[#5f3e02]",
  error: "bg-[#feded8] text-[#8e030f]",
};

export function SourceStatusBadge({ status }: { status: SourceStatus }) {
  return <Badge className={SOURCE_STATUS_STYLES[status]}>{status}</Badge>;
}

const INTERACTION_STYLES: Record<InteractionType, string> = {
  register: "bg-brand-100 text-brand-800",
  enrichment: "bg-[#ecebea] text-[#514f4d]",
  purchase: "bg-[#cdefc4] text-[#194e31]",
  engagement: "bg-[#e5e0fd] text-[#3a3183]",
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
        granted ? "bg-[#cdefc4] text-[#194e31]" : "bg-[#ecebea] text-[#706e6b]"
      }
    >
      {granted ? "✓" : "✕"} {label}
    </Badge>
  );
}

/* ---------- Surfaces ---------- */

export function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded border border-[#e5e5e5] bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.05)] ${className}`}
    >
      {children}
    </div>
  );
}

/** Salesforce-style related-list / section header inside a card. */
export function SectionHeader({
  icon,
  title,
  count,
  action,
}: {
  icon?: ObjectKind;
  title: string;
  count?: number;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        {icon && <ObjectIcon kind={icon} size="sm" />}
        <h2 className="text-sm font-bold text-[#181818]">
          {title}
          {count !== undefined && (
            <span className="ml-1 font-normal text-[#706e6b]">({count})</span>
          )}
        </h2>
      </div>
      {action}
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded border border-dashed border-[#c9c9c9] bg-white p-8 text-center text-sm text-[#706e6b]">
      {message}
    </div>
  );
}
