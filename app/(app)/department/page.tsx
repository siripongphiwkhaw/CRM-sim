import { requireSession } from "@/lib/session";
import { listDepartmentsForUser } from "@/db/queries/departments";
import { PageHeader, Card, SectionHeader, EmptyState } from "@/app/components/ui";
import { DepartmentSettingsForm } from "./DepartmentSettingsForm";

export const dynamic = "force-dynamic";

export default async function MyDepartmentPage() {
  const session = await requireSession();
  const departments = await listDepartmentsForUser(session.userId!);

  return (
    <div>
      <PageHeader
        icon="department"
        overline="My Department"
        title="Department Settings"
        subtitle="Manage the departments you're the PIC (Person In Charge) of"
      />

      {departments.length === 0 ? (
        <EmptyState message="You are not assigned as a PIC of any department yet. Contact an admin to be assigned." />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {departments.map((d) => (
            <Card key={d.id}>
              <SectionHeader icon="department" title={d.name} />
              <DepartmentSettingsForm department={d} />
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
