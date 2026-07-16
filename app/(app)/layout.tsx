import Link from "next/link";
import { getSession } from "@/lib/session";
import { logoutAction } from "./actions";

const NAV_LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/customers", label: "Customers (CDP)" },
  { href: "/products", label: "Products" },
  { href: "/channel", label: "Sales & Channel" },
  { href: "/data-cloud", label: "Data Cloud" },
];

const ADMIN_LINKS = [
  { href: "/sql", label: "SQL Console" },
  { href: "/admin", label: "Administration" },
];

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  const isAdmin = session.role === "admin";

  return (
    <div className="flex min-h-screen flex-1 bg-slate-50">
      <aside className="flex w-60 flex-col border-r border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-5">
          <span className="text-lg font-semibold text-slate-900">Loyalty CRM</span>
          <p className="text-xs text-slate-400">Customer Data Platform</p>
        </div>
        <nav className="flex-1 space-y-1 px-2 py-4">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="block rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              {link.label}
            </Link>
          ))}

          {isAdmin && (
            <>
              <p className="px-3 pb-1 pt-4 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Admin
              </p>
              {ADMIN_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="block rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                >
                  {link.label}
                </Link>
              ))}
            </>
          )}
        </nav>
        <div className="border-t border-slate-200 px-4 py-4">
          <p className="truncate text-sm text-slate-700">{session.name}</p>
          <p className="mb-2 text-xs capitalize text-slate-400">{session.role} account</p>
          <form action={logoutAction}>
            <button
              type="submit"
              className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
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
