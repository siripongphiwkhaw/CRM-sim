import { getSession } from "@/lib/session";
import { isPicOfAny } from "@/db/queries/departments";
import { ModuleRail, type RailItem } from "@/app/components/ModuleRail";
import { TopBar } from "@/app/components/TopBar";
import { logoutAction } from "./actions";

const BASE_ITEMS: RailItem[] = [
  { href: "/dashboard", label: "Home", icon: "home" },
  { href: "/customers", label: "Members", icon: "members" },
  { href: "/loyalty", label: "Loyalty", icon: "loyalty" },
  { href: "/cases", label: "Cases", icon: "cases" },
  { href: "/insights", label: "AI Insights", icon: "insights" },
  { href: "/products", label: "Products", icon: "products" },
  { href: "/channel", label: "Sales & Channel", icon: "channel" },
  { href: "/data-cloud", label: "Data Cloud", icon: "datacloud" },
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

  const items: RailItem[] = [
    ...BASE_ITEMS,
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
