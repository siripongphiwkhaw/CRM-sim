import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/session";
import { listUsers } from "@/db/queries/users";
import { getConsentStats } from "@/db/queries/analytics";
import { PageHeader, Card } from "@/app/components/ui";
import { formatDate } from "@/lib/format";
import { RoleSelect } from "./RoleSelect";

export const dynamic = "force-dynamic";

function ConsentBar({ label, count, total }: { label: string; count: number; total: number }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="text-slate-700">{label}</span>
        <span className="text-slate-500">{count}/{total} · {pct}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default async function AdminPage() {
  if (!(await isAdmin())) redirect("/dashboard");

  const [users, consent] = await Promise.all([listUsers(), getConsentStats()]);

  return (
    <div>
      <PageHeader
        title="Administration"
        subtitle="User roles and data governance (admin only)"
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-4 text-lg font-medium text-slate-900">Users & roles</h2>
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="text-left text-xs font-medium uppercase tracking-wide text-slate-500">
              <tr>
                <th className="py-2">Name</th>
                <th className="py-2">Email</th>
                <th className="py-2">Role</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="py-2 text-slate-800">{u.name}</td>
                  <td className="py-2 text-slate-500">{u.email}</td>
                  <td className="py-2">
                    <RoleSelect userId={u.id} role={u.role} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card>
          <h2 className="mb-4 text-lg font-medium text-slate-900">
            Data governance (PDPA)
          </h2>
          <div className="space-y-4">
            <ConsentBar label="PDPA consent" count={consent.pdpa} total={consent.total} />
            <ConsentBar label="Marketing consent" count={consent.marketing} total={consent.total} />
            <ConsentBar label="Data migration consent" count={consent.migration} total={consent.total} />
          </div>
          <p className="mt-4 text-xs text-slate-400">
            Consent is captured per member and governs marketing outreach and
            cross-system data migration.
          </p>
        </Card>
      </div>

      <p className="mt-6 text-xs text-slate-400">
        Signed-in admin view generated {formatDate(new Date().toISOString())}.
      </p>
    </div>
  );
}
