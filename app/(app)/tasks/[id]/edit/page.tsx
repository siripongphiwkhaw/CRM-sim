import { notFound } from "next/navigation";
import { getTask } from "@/db/queries/tasks";
import { listContacts } from "@/db/queries/contacts";
import { listDeals } from "@/db/queries/deals";
import { PageHeader } from "@/app/components/ui";
import { DeleteButton } from "@/app/components/form";
import { TaskForm } from "../../TaskForm";
import { updateTaskAction, deleteTaskAction } from "../../actions";

export const dynamic = "force-dynamic";

export default async function EditTaskPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const task = await getTask(Number(id));
  if (!task) notFound();

  const [contacts, deals] = await Promise.all([
    listContacts(),
    listDeals(),
  ]);

  return (
    <div>
      <PageHeader
        title="Edit task"
        action={
          <DeleteButton
            action={deleteTaskAction}
            id={task.id}
            confirmMessage={`Delete task “${task.subject}”?`}
          />
        }
      />
      <TaskForm
        action={updateTaskAction}
        contacts={contacts}
        deals={deals}
        task={task}
      />
    </div>
  );
}
