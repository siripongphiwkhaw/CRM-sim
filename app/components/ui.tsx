import Link from "next/link";
import type {
  Tier,
  SourceStatus,
  InteractionType,
} from "@/lib/constants";
import { INTERACTION_TYPE_LABELS } from "@/lib/constants";
import type { OrderStatus } from "@/lib/orderWorkflow";
import { ORDER_STATUS_LABELS } from "@/lib/orderWorkflow";

/* ---------- Object icons (SLDS-style colored squares) ---------- */

export type ObjectKind =
  | "home"
  | "customer"
  | "product"
  | "channel"
  | "datacloud"
  | "sql"
  | "setup"
  | "search"
  | "distributor"
  | "order"
  | "department"
  | "audit";

const OBJECT_ICONS: Record<ObjectKind, { bg: string; glyph: React.ReactNode }> = {
  home: {
    bg: "#12a594",
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
    bg: "#12a594",
    glyph: (
      <path d="M7 18a4 4 0 0 1-.6-7.95A5.5 5.5 0 0 1 17 8.3 4.5 4.5 0 0 1 16.5 18H7z" />
    ),
  },
  sql: {
    bg: "#0d7d70",
    glyph: <path d="M4 5h16v14H4V5zm3 4 3 3-3 3 1.2 1.2L12.4 12 8.2 7.8 7 9zm6 6h5v1.6h-5V15z" />,
  },
  setup: {
    bg: "#607785",
    glyph: (
      <path d="M12 8.5A3.5 3.5 0 1 1 12 15.5 3.5 3.5 0 0 1 12 8.5zm8 4.5-.1 1.6-2.2.5a6 6 0 0 1-.6 1.4l1.2 1.9-1.2 1.2-1.9-1.2a6 6 0 0 1-1.4.6l-.5 2.2h-1.7l-.5-2.2a6 6 0 0 1-1.4-.6l-1.9 1.2-1.2-1.2 1.2-1.9a6 6 0 0 1-.6-1.4l-2.2-.5V12l2.2-.5a6 6 0 0 1 .6-1.4L6.5 8.2l1.2-1.2 1.9 1.2a6 6 0 0 1 1.4-.6l.5-2.2h1.7l.5 2.2a6 6 0 0 1 1.4.6l1.9-1.2 1.2 1.2-1.2 1.9a6 6 0 0 1 .6 1.4l2.2.5z" />
    ),
  },
  search: {
    bg: "#607785",
    glyph: (
      <path d="M10 4a6 6 0 1 1 0 12 6 6 0 0 1 0-12zm0 2.2A3.8 3.8 0 1 0 10 13.8 3.8 3.8 0 0 0 10 6.2zM15.3 14l4.7 4.7-1.3 1.3-4.7-4.7 1.3-1.3z" />
    ),
  },
  distributor: {
    bg: "#b0702c",
    glyph: (
      <path d="M12 3 3 8v2h1v9h5v-6h6v6h5V10h1V8l-9-5zm-3 8V9h2v2H9zm4 0V9h2v2h-2z" />
    ),
  },
  order: {
    bg: "#ba0517",
    glyph: (
      <path d="M6 4h13l-1.6 9.2a2 2 0 0 1-2 1.6H8.9l-.3 1.6H18v2H8.2a1.6 1.6 0 0 1-1.6-1.9L8 12.6 5.6 4H2V2h4.8L6 4zm.6 2 1.6 7h9l1.2-7H6.6zM8.5 20a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zm7 0a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3z" />
    ),
  },
  department: {
    bg: "#5c6f7d",
    glyph: <path d="M4 21V9.5l8-5.3 8 5.3V21h-5v-6H9v6H4z" />,
  },
  audit: {
    bg: "#0b827c",
    glyph: (
      <path d="M6 2h9l3 3v13a2 2 0 0 1-2 2h-3.3a5.5 5.5 0 0 0 .8-2H16V6.4L14.6 5H8v5.3a5.6 5.6 0 0 0-2 .6V4a2 2 0 0 1 2-2H6zm3.5 10a4.5 4.5 0 0 1 3.5 7.3l2.6 2.6-1.4 1.4-2.6-2.6A4.5 4.5 0 1 1 9.5 12zm0 2a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z" />
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
    <div className="mb-4 rounded-[14px] border border-[#dde5e8] bg-white px-4 py-3">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {icon && <ObjectIcon kind={icon} size="lg" />}
          <div>
            {overline && (
              <p className="text-xs text-[#607785]">{overline}</p>
            )}
            <h1 className="text-xl font-bold text-[#14202b]">{title}</h1>
            {subtitle && <p className="text-xs text-[#607785]">{subtitle}</p>}
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
      ? "border border-brand-600 bg-brand-600 text-white shadow-sm hover:bg-brand-700 hover:border-brand-700 hover:shadow"
      : "border border-[#c2d0d6] bg-white text-brand-600 hover:bg-[#eef3f5]";
  return (
    <Link
      href={href}
      className={`inline-flex items-center rounded-[9px] px-4 py-1.5 text-sm font-medium transition duration-150 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 ${styles}`}
    >
      {children}
    </Link>
  );
}

/* ---------- Badges ---------- */

function Badge({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex rounded-[16px] px-2 py-0.5 text-xs font-medium ${className}`}
    >
      {children}
    </span>
  );
}

const TIER_STYLES: Record<Tier, string> = {
  Bronze: "bg-cream-200 text-amber-900",
  Silver: "bg-[#e5eaec] text-[#514f4d]",
  Gold: "bg-gold-400/30 text-gold-600",
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

const ORDER_STATUS_STYLES: Record<OrderStatus, string> = {
  draft: "bg-[#ecebea] text-[#514f4d]",
  submitted: "bg-[#fbf3e0] text-[#5f3e02]",
  approved: "bg-[#cdefc4] text-[#194e31]",
  rejected: "bg-[#feded8] text-[#8e030f]",
  fulfilled: "bg-brand-800 text-white",
  cancelled: "bg-[#ecebea] text-[#607785]",
};

const SCAN_MATCH_STYLES: Record<string, { className: string; label: string }> = {
  matched: { className: "bg-[#cdefc4] text-[#194e31]", label: "Matched" },
  partial: { className: "bg-[#fbf3e0] text-[#5f3e02]", label: "Partial match" },
  mismatched: { className: "bg-[#feded8] text-[#8e030f]", label: "Mismatch" },
  unmatched: { className: "bg-[#ecebea] text-[#514f4d]", label: "No match" },
};

export function ScanMatchBadge({ status }: { status: string }) {
  const style = SCAN_MATCH_STYLES[status] ?? SCAN_MATCH_STYLES.unmatched;
  return <Badge className={style.className}>{style.label}</Badge>;
}

const LINE_MATCH_STYLES: Record<string, { className: string; label: string }> = {
  matched: { className: "bg-[#cdefc4] text-[#194e31]", label: "OK" },
  qty_mismatch: { className: "bg-[#fbf3e0] text-[#5f3e02]", label: "Qty differs" },
  price_mismatch: { className: "bg-[#fbf3e0] text-[#5f3e02]", label: "Price differs" },
  not_in_order: { className: "bg-[#feded8] text-[#8e030f]", label: "Not in order" },
  not_our_product: { className: "bg-[#ecebea] text-[#514f4d]", label: "Other brand" },
};

export function LineMatchBadge({ status }: { status: string }) {
  const style = LINE_MATCH_STYLES[status] ?? LINE_MATCH_STYLES.not_our_product;
  return <Badge className={style.className}>{style.label}</Badge>;
}

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return (
    <Badge className={ORDER_STATUS_STYLES[status]}>
      {ORDER_STATUS_LABELS[status]}
    </Badge>
  );
}

export function ConsentPill({ granted, label }: { granted: boolean; label: string }) {
  return (
    <Badge
      className={
        granted ? "bg-[#cdefc4] text-[#194e31]" : "bg-[#ecebea] text-[#607785]"
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
      className={`rounded-[14px] border border-[#dde5e8] bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.05)] ${className}`}
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
        <h2 className="text-sm font-bold text-[#14202b]">
          {title}
          {count !== undefined && (
            <span className="ml-1 font-normal text-[#607785]">({count})</span>
          )}
        </h2>
      </div>
      {action}
    </div>
  );
}

/**
 * A `<th>` that links to the same list with `sort`/`dir` toggled, preserving
 * every other current query param (search text, filters, etc.). Server-
 * renderable — no client state, just a Link with a recomputed query string.
 */
export function SortableTh({
  label,
  column,
  params,
  baseHref,
  align = "left",
}: {
  label: string;
  column: string;
  params: Record<string, string | undefined>;
  baseHref: string;
  align?: "left" | "right";
}) {
  const active = params.sort === column;
  const currentDir = params.dir === "asc" ? "asc" : "desc";
  const nextDir = active && currentDir === "desc" ? "asc" : "desc";

  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value && key !== "sort" && key !== "dir") qs.set(key, value);
  }
  qs.set("sort", column);
  qs.set("dir", nextDir);

  return (
    <th
      className={`px-4 py-2 text-xs font-semibold uppercase tracking-wide text-[#3c4f5e] ${
        align === "right" ? "text-right" : "text-left"
      }`}
    >
      <Link
        href={`${baseHref}?${qs.toString()}`}
        className="inline-flex items-center gap-1 transition-colors hover:text-brand-600"
      >
        {label}
        {active && <span aria-hidden>{currentDir === "asc" ? "▲" : "▼"}</span>}
      </Link>
    </th>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-[14px] border border-dashed border-[#c2d0d6] bg-white p-8 text-center text-sm text-[#607785]">
      {message}
    </div>
  );
}
