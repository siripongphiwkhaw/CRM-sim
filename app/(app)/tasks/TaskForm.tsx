"use client";

import { useActionState } from "react";
import Link from "next/link";
import {
  Field,
  TextInput,
  TextArea,
  Select,
  FormError,
  SubmitButton,
} from "@/app/components/form";
import { TASK_TYPES, TASK_TYPE_LABELS } from "@/lib/constants";
import type { FormState } from "@/lib/validation";
import type { Task } from "@/db/queries/tasks";
import type { ContactWithCompany } from "@/db/queries/contacts";
import type { DealWithRelations } from "@/db/queries/deals";

type TaskAction = (prev: FormState, formData: FormData) => Promise<FormState>;

export function TaskForm({
  action,
  contacts,
  deals,
  task,
  defaults,
}: {
  action: TaskAction;
  contacts: ContactWithCompany[];
  deals: DealWithRelations[];
  task?: Task;
  defaults?: { contact_id?: number; deal_id?: number };
}) {
  const [state, formAction] = useActionState<FormState, FormData>(action, {});

  const contactId = task?.contact_id ?? defaults?.contact_id ?? "";
  const dealId = task?.deal_id ?? defaults?.deal_id ?? "";

  return (
    <form action={formAction} className="max-w-2xl space-y-5">
      {task && <input type="hidden" name="id" value={task.id} />}
      <FormError message={state.error} />

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field label="Type" htmlFor="type" required>
          <Select id="type" name="type" defaultValue={task?.type ?? "call"}>
            {TASK_TYPES.map((t) => (
              <option key={t} value={t}>
                {TASK_TYPE_LABELS[t]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Due date" htmlFor="due_date">
          <TextInput
            id="due_date"
            name="due_date"
            type="date"
            defaultValue={task?.due_date ?? ""}
          />
        </Field>
      </div>

      <Field label="Subject" htmlFor="subject" required>
        <TextInput
          id="subject"
          name="subject"
          defaultValue={task?.subject ?? ""}
          required
        />
      </Field>

      <Field label="Description" htmlFor="description">
        <TextArea
          id="description"
          name="description"
          rows={3}
          defaultValue={task?.description ?? ""}
        />
      </Field>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field label="Contact" htmlFor="contact_id">
          <Select id="contact_id" name="contact_id" defaultValue={contactId}>
            <option value="">— None —</option>
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.first_name} {c.last_name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Deal" htmlFor="deal_id">
          <Select id="deal_id" name="deal_id" defaultValue={dealId}>
            <option value="">— None —</option>
            {deals.map((d) => (
              <option key={d.id} value={d.id}>
                {d.title}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="flex items-center gap-3">
        <SubmitButton>{task ? "Save changes" : "Create task"}</SubmitButton>
        <Link
          href="/tasks"
          className="text-sm text-slate-500 hover:text-slate-700"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
