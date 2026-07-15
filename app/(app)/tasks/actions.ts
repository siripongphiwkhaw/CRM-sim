"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/session";
import { taskSchema, firstError, type FormState } from "@/lib/validation";
import {
  createTask,
  updateTask,
  deleteTask,
  toggleTaskComplete,
} from "@/db/queries/tasks";

function parseTask(formData: FormData) {
  return taskSchema.safeParse({
    type: formData.get("type"),
    subject: formData.get("subject"),
    description: formData.get("description") ?? "",
    due_date: formData.get("due_date") || "",
    contact_id: formData.get("contact_id") || null,
    deal_id: formData.get("deal_id") || null,
  });
}

export async function createTaskAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const session = await requireSession();
  const parsed = parseTask(formData);
  if (!parsed.success) return { error: firstError(parsed.error) };

  createTask({ ...parsed.data, owner_id: session.userId });
  revalidatePath("/tasks");
  redirect("/tasks");
}

export async function updateTaskAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const session = await requireSession();
  const id = Number(formData.get("id"));
  if (!id) return { error: "Missing task id." };

  const parsed = parseTask(formData);
  if (!parsed.success) return { error: firstError(parsed.error) };

  updateTask(id, { ...parsed.data, owner_id: session.userId });
  revalidatePath("/tasks");
  redirect("/tasks");
}

export async function toggleTaskAction(id: number) {
  await requireSession();
  if (id) {
    toggleTaskComplete(id);
    revalidatePath("/tasks");
  }
}

export async function deleteTaskAction(formData: FormData) {
  await requireSession();
  const id = Number(formData.get("id"));
  if (id) {
    deleteTask(id);
    revalidatePath("/tasks");
  }
  redirect("/tasks");
}
