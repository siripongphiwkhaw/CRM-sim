"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export interface RailItem {
  href: string;
  label: string;
  icon: RailIconKind;
}

export type RailIconKind =
  | "home"
  | "members"
  | "loyalty"
  | "cases"
  | "insights"
  | "products"
  | "channel"
  | "datacloud"
  | "department"
  | "sql"
  | "setup"
  | "guide";

const RAIL_ICONS: Record<RailIconKind, React.ReactNode> = {
  home: <path d="M12 4 3 11h2.5v7h5v-4h3v4h5v-7H21z" />,
  members: (
    <path d="M12 5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7zm0 8.5c3.6 0 6.5 1.8 6.5 4V19h-13v-1.5c0-2.2 2.9-4 6.5-4z" />
  ),
  loyalty: (
    <path d="M12 3l2.5 5.3 5.5.7-4 4 1 5.7-5-2.8-5 2.8 1-5.7-4-4 5.5-.7z" />
  ),
  cases: (
    <path d="M12 3a7 7 0 0 1 7 7v5a3 3 0 0 1-3 3h-1v-7h2v-1a5 5 0 0 0-10 0v1h2v7H8a3 3 0 0 1-3-3v-5a7 7 0 0 1 7-7z" />
  ),
  insights: (
    <path d="M12 2l1.8 4.7L18.5 8.5l-4.7 1.8L12 15l-1.8-4.7L5.5 8.5l4.7-1.8zM19 14l.9 2.4 2.4.9-2.4.9L19 20.5l-.9-2.3-2.4-.9 2.4-.9zM5 15l.8 2 2 .8-2 .8L5 20.5l-.8-1.9-2-.8 2-.8z" />
  ),
  products: (
    <path d="M12 3 4 7v10l8 4 8-4V7l-8-4zm0 2.3L17.5 8 12 10.7 6.5 8 12 5.3zM6 9.6l5 2.5v6.3l-5-2.5V9.6zm12 6.3-5 2.5v-6.3l5-2.5v6.3z" />
  ),
  channel: <path d="M4 5h16v3l-1.5 2v9h-13V10L4 8V5zm4.5 8H12v4H8.5v-4z" />,
  datacloud: (
    <path d="M7 18a4 4 0 0 1-.6-7.95A5.5 5.5 0 0 1 17 8.3 4.5 4.5 0 0 1 16.5 18H7z" />
  ),
  department: <path d="M4 21V9.5l8-5.3 8 5.3V21h-5v-6H9v6H4z" />,
  sql: (
    <path d="M4 5h16v14H4V5zm3 4 3 3-3 3 1.2 1.2L12.4 12 8.2 7.8 7 9zm6 6h5v1.6h-5V15z" />
  ),
  setup: (
    <path d="M12 8.5A3.5 3.5 0 1 1 12 15.5 3.5 3.5 0 0 1 12 8.5zm8 4.5-.1 1.6-2.2.5a6 6 0 0 1-.6 1.4l1.2 1.9-1.2 1.2-1.9-1.2a6 6 0 0 1-1.4.6l-.5 2.2h-1.7l-.5-2.2a6 6 0 0 1-1.4-.6l-1.9 1.2-1.2-1.2 1.2-1.9a6 6 0 0 1-.6-1.4l-2.2-.5V12l2.2-.5a6 6 0 0 1 .6-1.4L6.5 8.2l1.2-1.2 1.9 1.2a6 6 0 0 1 1.4-.6l.5-2.2h1.7l.5 2.2a6 6 0 0 1 1.4.6l1.9-1.2 1.2 1.2-1.2 1.9a6 6 0 0 1 .6 1.4l2.2.5z" />
  ),
  guide: (
    <path d="M5 4h9a3 3 0 0 1 3 3v13a2.5 2.5 0 0 0-2.5-2.5H5V4zm-1 0v15h9.5A2.5 2.5 0 0 1 16 21.5V21H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zm3.5 4h6v1.6h-6V8zm0 3.2h6v1.6h-6v-1.6z" />
  ),
};

/** Dark charcoal left module rail — icon-only below lg, icon + label from lg up. */
export function ModuleRail({ items }: { items: RailItem[] }) {
  const pathname = usePathname();

  return (
    <nav className="flex w-14 shrink-0 flex-col bg-rail lg:w-60">
      <div className="flex items-center gap-2.5 px-3 py-4 lg:px-4">
        <span
          aria-hidden
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] bg-brand-600 text-sm font-bold text-white"
        >
          L
        </span>
        <div className="hidden min-w-0 lg:block">
          <p className="truncate text-sm font-bold leading-tight text-white">Loyalty Cloud</p>
          <p className="truncate text-[10px] leading-tight text-white/50">CRM &amp; Loyalty</p>
        </div>
      </div>

      <ul className="flex-1 space-y-0.5 overflow-y-auto px-2 pb-4">
        {items.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                title={item.label}
                className={`group relative flex items-center gap-3 rounded-[9px] px-2.5 py-2 text-sm transition-colors ${
                  active
                    ? "bg-rail-hover font-semibold text-white"
                    : "text-white/65 hover:bg-rail-hover hover:text-white"
                }`}
              >
                {active && (
                  <span
                    aria-hidden
                    className="absolute -left-2 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r bg-brand-500"
                  />
                )}
                <svg
                  viewBox="0 0 24 24"
                  width={18}
                  height={18}
                  fill="currentColor"
                  aria-hidden
                  className="shrink-0"
                >
                  {RAIL_ICONS[item.icon]}
                </svg>
                <span className="hidden truncate lg:inline">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
