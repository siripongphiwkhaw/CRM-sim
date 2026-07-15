import Link from "next/link";
import { listContacts } from "@/db/queries/contacts";
import { PageHeader, LinkButton, EmptyState } from "@/app/components/ui";

export const dynamic = "force-dynamic";

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const contacts = await listContacts({ search: q });

  return (
    <div>
      <PageHeader
        title="Contacts"
        subtitle={`${contacts.length} ${contacts.length === 1 ? "contact" : "contacts"}`}
        action={<LinkButton href="/contacts/new">New contact</LinkButton>}
      />

      <form method="get" className="mb-4">
        <input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search by name or email…"
          className="w-full max-w-sm rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </form>

      {contacts.length === 0 ? (
        <EmptyState
          message={
            q ? `No contacts match “${q}”.` : "No contacts yet. Create your first one."
          }
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Company</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Phone</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {contacts.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/contacts/${c.id}`}
                      className="font-medium text-indigo-600 hover:underline"
                    >
                      {c.first_name} {c.last_name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{c.title || "—"}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {c.company_id ? (
                      <Link
                        href={`/companies/${c.company_id}`}
                        className="text-slate-700 hover:underline"
                      >
                        {c.company_name}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{c.email || "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{c.phone || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
