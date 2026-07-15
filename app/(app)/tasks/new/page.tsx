import { listContacts } from "@/db/queries/contacts";
import { listDeals } from "@/db/queries/deals";
import { PageHeader } from "@/app/components/ui";
import { TaskForm } from "../TaskForm";
import { createTaskAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewTaskPage({
  searchParams,
}: {
  searchParams: Promise<{ contact_id?: string; deal_id?: string }>;
}) {
  const { contact_id, deal_id } = await searchParams;
  const [contacts, deals] = await Promise.all([
    listContacts(),
    listDeals(),
  ]);

  return (
    <div>
      <PageHeader title="New task" />
      <TaskForm
        action={createTaskAction}
        contacts={contacts}
        deals={deals}
        defaults={{
          contact_id: contact_id ? Number(contact_id) : undefined,
          deal_id: deal_id ? Number(deal_id) : undefined,
        }}
      />
    </div>
  );
}
