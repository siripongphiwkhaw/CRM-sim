import Link from "next/link";
import { getSession } from "@/lib/session";
import { logoutAction } from "./actions";

const NAV_LINKS = [
  { href: "/dashboard", label: "Dashboard", icon: "📊" },
  { href: "/customers", label: "Customers (CDP)", icon: "👥" },
  { href: "/products", label: "Products", icon: "🛒" },
  { href: "/channel", label: "Sales & Channel", icon: "🏪" },
  { href: "/data-cloud", label: "Data Cloud", icon: "☁️" },
];

const ADMIN_LINKS = [
  { href: "/sql", label: "SQL Console", icon: "⌨️" },
  { href: "/admin", label: "Administration", icon: "🛡️" },
];

function NavItem({ href, label, icon }: { href: string; label: string; icon: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2.5 rounded-full px-4 py-2 text-sm font-medium text-stone-700 transition-colors hover:bg-brand-50 hover:text-brand-700"
    >
      <span aria-hidden className="text-base leading-none">{icon}</span>
      {label}
    </Link>
  );
}

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  const isAdmin = session.role === "admin";

  return (
    <div className="flex min-h-screen flex-1 bg-background">
      <aside className="flex w-64 flex-col border-r border-stone-200 bg-white">
        <div className="bg-gradient-to-br from-brand-600 to-brand-800 px-5 py-6">
          <span className="font-display text-2xl text-white">Loyalty CRM</span>
          <p className="mt-0.5 text-xs text-brand-100">
            Well-being · Customer Data Platform
          </p>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-4">
          {NAV_LINKS.map((link) => (
            <NavItem key={link.href} {...link} />
          ))}

          {isAdmin && (
            <>
              <p className="px-4 pb-1 pt-5 text-xs font-semibold uppercase tracking-wide text-stone-400">
                Admin
              </p>
              {ADMIN_LINKS.map((link) => (
                <NavItem key={link.href} {...link} />
              ))}
            </>
          )}
        </nav>
        <div className="border-t border-stone-200 bg-cream-50 px-5 py-4">
          <p className="truncate text-sm font-medium text-stone-800">{session.name}</p>
          <p className="mb-3 text-xs capitalize text-stone-400">{session.role} account</p>
          <form action={logoutAction}>
            <button
              type="submit"
              className="w-full rounded-full border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-700 transition-colors hover:border-brand-600 hover:text-brand-700"
            >
              Sign out
            </button>
          </form>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto p-8">{children}</main>
    </div>
  );
}
