import Link from "next/link";
import { getSession } from "@/lib/session";
import { logoutAction } from "./actions";

const NAV_LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/contacts", label: "Contacts" },
  { href: "/companies", label: "Companies" },
  { href: "/deals", label: "Deals" },
  { href: "/tasks", label: "Tasks" },
];

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  return (
    <div className="flex min-h-screen flex-1 bg-slate-50">
      <aside className="flex w-56 flex-col border-r border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-5">
          <span className="text-lg font-semibold text-slate-900">Simulated CRM</span>
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
        </nav>
        <div className="border-t border-slate-200 px-4 py-4">
          <p className="mb-2 truncate text-xs text-slate-500">{session.name}</p>
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
