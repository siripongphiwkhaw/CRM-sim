import { getSession } from "@/lib/session";
import { isPicOfAny } from "@/db/queries/departments";
import { ModuleRail, type RailItem } from "@/app/components/ModuleRail";
import type { ModuleKey } from "@/lib/constants";
import { TopBar } from "@/app/components/TopBar";
import { logoutAction } from "./actions";

// Always visible, whatever the department grants.
const HOME_ITEM: RailItem = { href: "/dashboard", label: "Home", icon: "home" };
const GUIDE_ITEM: RailItem = { href: "/guide", label: "Guide", icon: "guide" };
const ONLYONE_ITEM: RailItem = { href: "/liff-qr", label: "Only-One QR", icon: "loyalty" };

// Shown only when the user's department grants the module (admins get all).
const GATED_ITEMS: { module: ModuleKey; item: RailItem }[] = [
  { module: "customers", item: { href: "/customers", label: "Members", icon: "members" } },
  { module: "loyalty", item: { href: "/loyalty", label: "Loyalty", icon: "loyalty" } },
  { module: "cases", item: { href: "/cases", label: "Cases", icon: "cases" } },
  { module: "insights", item: { href: "/insights", label: "AI Insights", icon: "insights" } },
  { module: "products", item: { href: "/products", label: "Products", icon: "products" } },
  { module: "channel", item: { href: "/channel", label: "Sales & Channel", icon: "channel" } },
  { module: "data-cloud", item: { href: "/data-cloud", label: "Data Cloud", icon: "datacloud" } },
  { module: "marketing", item: { href: "/marketing", label: "Marketing", icon: "insights" } },
];

const ADMIN_ITEMS: RailItem[] = [
  { href: "/sql", label: "SQL Console", icon: "sql" },
  { href: "/admin", label: "Setup", icon: "setup" },
];

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  const isAdmin = session.role === "admin";
  const isPic = session.userId ? await isPicOfAny(session.userId) : false;

  const granted = new Set(session.modules ?? []);
  const items: RailItem[] = [
    HOME_ITEM,
    ...GATED_ITEMS.filter((g) => isAdmin || granted.has(g.module)).map((g) => g.item),
    ONLYONE_ITEM,
    GUIDE_ITEM,
    ...(isPic
      ? [{ href: "/department", label: "My Department", icon: "department" as const }]
      : []),
    ...(isAdmin ? ADMIN_ITEMS : []),
  ];

  return (
    <div className="flex min-h-screen bg-background">
      <ModuleRail items={items} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          name={session.name ?? "?"}
          role={session.role ?? "user"}
          logoutAction={logoutAction}
        />
        <main className="flex-1 overflow-y-auto p-4">{children}</main>
      </div>
    </div>
  );
}
