import Link from "next/link";
import { listTasks } from "@/db/queries/tasks";
import {
  PageHeader,
  LinkButton,
  TaskTypeBadge,
  EmptyState,
} from "@/app/components/ui";
import { DeleteButton } from "@/app/components/form";
import { formatDate, isOverdue } from "@/lib/format";
import { TaskToggle } from "./TaskToggle";
import { deleteTaskAction } from "./actions";

export const dynamic = "force-dynamic";

const FILTERS = [
  { key: "open", label: "Open" },
  { key: "overdue", label: "Overdue" },
  { key: "completed", label: "Completed" },
  { key: "all", label: "All" },
] as const;

type FilterKey = (typeof FILTERS)[number]["key"];

function queryTasks(filter: FilterKey) {
  switch (filter) {
    case "overdue":
      return listTasks({ overdueOnly: true });
    case "completed":
      return listTasks({ completed: true });
    case "all":
      return listTasks();
    case "open":
    default:
      return listTasks({ completed: false });
  }
}

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { filter: rawFilter } = await searchParams;
  const filter: FilterKey = FILTERS.some((f) => f.key === rawFilter)
    ? (rawFilter as FilterKey)
    : "open";
  const tasks = queryTasks(filter);

  return (
    <div>
      <PageHeader
        title="Tasks"
        subtitle={`${tasks.length} ${tasks.length === 1 ? "task" : "tasks"}`}
        action={<LinkButton href="/tasks/new">New task</LinkButton>}
      />

      <div className="mb-4 flex gap-1 border-b border-slate-200">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={f.key === "open" ? "/tasks" : `/tasks?filter=${f.key}`}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
              filter === f.key
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {tasks.length === 0 ? (
        <EmptyState message="No tasks in this view." />
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <ul className="divide-y divide-slate-100">
            {tasks.map((t) => {
              const overdue = isOverdue(t.due_date, t.completed);
              return (
                <li
                  key={t.id}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50"
                >
                  <TaskToggle id={t.id} completed={t.completed === 1} />
                  <TaskTypeBadge type={t.type} />
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/tasks/${t.id}/edit`}
                      className={`block truncate text-sm font-medium hover:underline ${
                        t.completed
                          ? "text-slate-400 line-through"
                          : "text-slate-800"
                      }`}
                    >
                      {t.subject}
                    </Link>
                    {(t.contact_name || t.deal_title) && (
                      <p className="truncate text-xs text-slate-400">
                        {[t.contact_name, t.deal_title]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    )}
                  </div>
                  <span
                    className={`shrink-0 text-xs ${
                      overdue ? "font-medium text-rose-600" : "text-slate-400"
                    }`}
                  >
                    {t.due_date ? formatDate(t.due_date) : "No due date"}
                  </span>
                  <DeleteButton
                    action={deleteTaskAction}
                    id={t.id}
                    label="✕"
                    confirmMessage={`Delete task “${t.subject}”?`}
                  />
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
