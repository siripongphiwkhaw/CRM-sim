import { getSession } from "@/lib/session";
import { isPicOfAny } from "@/db/queries/departments";
import { GlobalNav, type NavTab } from "@/app/components/GlobalNav";
import { logoutAction } from "./actions";

const BASE_TABS: NavTab[] = [
  { href: "/dashboard", label: "Home" },
  { href: "/customers", label: "Customers" },
  { href: "/products", label: "Products" },
  { href: "/channel", label: "Sales & Channel" },
  { href: "/data-cloud", label: "Data Cloud" },
];

const ADMIN_TABS: NavTab[] = [
  { href: "/sql", label: "SQL Console" },
  { href: "/admin", label: "Setup" },
];

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  const isAdmin = session.role === "admin";
  const isPic = session.userId ? await isPicOfAny(session.userId) : false;

  const tabs = [
    ...BASE_TABS,
    ...(isPic ? [{ href: "/department", label: "My Department" }] : []),
    ...(isAdmin ? ADMIN_TABS : []),
  ];
  const initials = (session.name ?? "?")
    .split(/\s+/)
    .map((p) => p.charAt(0))
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="flex min-h-screen flex-1 flex-col bg-background">
      <div className="h-1 bg-brand-600" />
      <header className="flex items-center gap-4 border-b border-[#e5e5e5] bg-white px-4 py-2">
        {/* app-launcher waffle */}
        <span aria-hidden className="grid grid-cols-3 gap-[3px] p-1">
          {Array.from({ length: 9 }).map((_, i) => (
            <span key={i} className="h-1 w-1 rounded-[1px] bg-[#747474]" />
          ))}
        </span>
        <span className="text-base font-bold text-[#032d60]">Loyalty Cloud</span>

        <form action="/search" method="get" className="mx-auto w-full max-w-xl">
          <input
            type="search"
            name="q"
            placeholder="Search customers, products and more…"
            className="w-full rounded-full border border-[#c9c9c9] bg-[#f3f3f3] px-4 py-1.5 text-sm focus:border-brand-600 focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-600"
          />
        </form>

        <div className="flex shrink-0 items-center gap-3">
          <div className="text-right">
            <p className="text-xs font-semibold leading-tight text-[#181818]">
              {session.name}
            </p>
            <p className="text-[11px] capitalize leading-tight text-[#706e6b]">
              {session.role}
            </p>
          </div>
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-700 text-xs font-semibold text-white">
            {initials}
          </span>
          <form action={logoutAction}>
            <button
              type="submit"
              className="rounded border border-[#c9c9c9] bg-white px-3 py-1 text-xs text-[#444] hover:bg-[#f3f3f3]"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>

      <GlobalNav tabs={tabs} />

      <main className="flex-1 overflow-y-auto p-4">{children}</main>
    </div>
  );
}
