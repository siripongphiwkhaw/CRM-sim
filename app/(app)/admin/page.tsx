import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/session";
import { listUsers } from "@/db/queries/users";
import { getConsentStats } from "@/db/queries/analytics";
import { listDepartments, listPicsForDepartment } from "@/db/queries/departments";
import { PageHeader, Card, SectionHeader, ObjectIcon, EmptyState } from "@/app/components/ui";
import { RoleSelect } from "./RoleSelect";
import { NewUserForm } from "./NewUserForm";
import { NewDepartmentForm } from "./NewDepartmentForm";
import { PicManager } from "./PicManager";
import { DeleteButton } from "@/app/components/form";
import { deleteDepartmentAction } from "./actions";

export const dynamic = "force-dynamic";

function ConsentBar({ label, count, total }: { label: string; count: number; total: number }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="text-[#444]">{label}</span>
        <span className="text-[#706e6b]">{count}/{total} · {pct}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-sm bg-[#f3f3f3]">
        <div className="h-full rounded-sm bg-[#2e844a]" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default async function AdminPage() {
  // Defense in depth — the proxy already blocks non-admins from /admin.
  if (!(await isAdmin())) redirect("/dashboard");

  const [users, consent, departments] = await Promise.all([
    listUsers(),
    getConsentStats(),
    listDepartments(),
  ]);
  const departmentsWithPics = await Promise.all(
    departments.map(async (d) => ({ department: d, pics: await listPicsForDepartment(d.id) }))
  );

  return (
    <div>
      <PageHeader
        icon="setup"
        overline="Setup"
        title="Administration"
        subtitle="User roles and data governance (admin only)"
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <SectionHeader title="Users & Roles" count={users.length} />
          <div className="mb-4 overflow-x-auto">
          <table className="min-w-full divide-y divide-[#f3f3f3] text-sm">
            <thead className="text-left text-xs font-semibold uppercase tracking-wide text-[#444]">
              <tr>
                <th className="py-2">Name</th>
                <th className="py-2">Email</th>
                <th className="py-2">Role</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f3f3f3]">
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="py-2 text-[#181818]">{u.name}</td>
                  <td className="py-2 text-[#706e6b]">{u.email}</td>
                  <td className="py-2">
                    <RoleSelect userId={u.id} role={u.role} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          <NewUserForm />
        </Card>

        <Card>
          <SectionHeader title="Data Governance (PDPA)" />
          <div className="space-y-4">
            <ConsentBar label="PDPA consent" count={consent.pdpa} total={consent.total} />
            <ConsentBar label="Marketing consent" count={consent.marketing} total={consent.total} />
            <ConsentBar label="Data migration consent" count={consent.migration} total={consent.total} />
          </div>
          <p className="mt-4 text-xs text-[#706e6b]">
            Consent is captured per member and governs marketing outreach and
            cross-system data migration.
          </p>
        </Card>
      </div>

      <div className="mt-4">
        <Card>
          <SectionHeader icon="department" title="Departments & PICs" count={departments.length} />
          <p className="mb-3 text-xs text-[#706e6b]">
            Functional units and their Person In Charge (PIC) — the backend control
            surface. PICs manage their own department&apos;s settings from{" "}
            <span className="font-mono">/department</span>; workflow routing to
            department PICs is not wired up yet.
          </p>
          {departmentsWithPics.length === 0 ? (
            <EmptyState message="No departments yet." />
          ) : (
            <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {departmentsWithPics.map(({ department, pics }) => (
                <div key={department.id} className="rounded border border-[#e5e5e5] p-3">
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <ObjectIcon kind="department" size="sm" />
                      <div>
                        <p className="text-sm font-semibold text-[#181818]">{department.name}</p>
                        {department.description && (
                          <p className="text-xs text-[#706e6b]">{department.description}</p>
                        )}
                      </div>
                    </div>
                    <DeleteButton
                      action={deleteDepartmentAction}
                      id={department.id}
                      label="✕"
                      confirmMessage={`Delete department "${department.name}"?`}
                    />
                  </div>
                  <PicManager departmentId={department.id} pics={pics} allUsers={users} />
                </div>
              ))}
            </div>
          )}
          <NewDepartmentForm />
        </Card>
      </div>
    </div>
  );
}
