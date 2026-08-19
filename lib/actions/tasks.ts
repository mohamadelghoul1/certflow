"use server";

import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function createTaskList(formData: FormData) {
  const { profile } = await requireProfile("certifier");
  const supabase = await createClient();
  const title = String(formData.get("title") || "").trim();
  if (!title) return;
  const { count } = await supabase.from("task_lists").select("id", { count: "exact", head: true }).eq("firm_id", profile.firm_id);
  await supabase.from("task_lists").insert({ firm_id: profile.firm_id, title, sort_order: count || 0 });
  revalidatePath("/dashboard");
}

export async function renameTaskList(formData: FormData) {
  const { profile } = await requireProfile("certifier");
  const supabase = await createClient();
  const listId = String(formData.get("list_id"));
  const title = String(formData.get("title") || "").trim();
  if (!title) return;
  await supabase.from("task_lists").update({ title }).eq("id", listId).eq("firm_id", profile.firm_id);
  revalidatePath("/dashboard");
}

export async function deleteTaskList(formData: FormData) {
  const { profile } = await requireProfile("certifier");
  const supabase = await createClient();
  const listId = String(formData.get("list_id"));
  await supabase.from("task_lists").delete().eq("id", listId).eq("firm_id", profile.firm_id);
  revalidatePath("/dashboard");
}

export async function addTask(formData: FormData) {
  await requireProfile("certifier");
  const supabase = await createClient();
  const listId = String(formData.get("list_id"));
  const text = String(formData.get("text") || "").trim();
  const note = String(formData.get("note") || "").trim();
  if (!text) return;
  const { count } = await supabase.from("manual_tasks").select("id", { count: "exact", head: true }).eq("list_id", listId);
  await supabase.from("manual_tasks").insert({ list_id: listId, text, note: note || null, sort_order: count || 0 });
  revalidatePath("/dashboard");
}

export async function toggleTaskComplete(formData: FormData) {
  await requireProfile("certifier");
  const supabase = await createClient();
  const taskId = String(formData.get("task_id"));
  const completed = formData.get("completed") === "true";
  await supabase
    .from("manual_tasks")
    .update({ completed, completed_at: completed ? new Date().toISOString() : null })
    .eq("id", taskId);
  revalidatePath("/dashboard");
}

export async function updateTaskText(formData: FormData) {
  await requireProfile("certifier");
  const supabase = await createClient();
  const taskId = String(formData.get("task_id"));
  const text = String(formData.get("text") || "").trim();
  const note = String(formData.get("note") || "").trim();
  if (!text) return;
  await supabase.from("manual_tasks").update({ text, note: note || null }).eq("id", taskId);
  revalidatePath("/dashboard");
}

export async function deleteTask(formData: FormData) {
  await requireProfile("certifier");
  const supabase = await createClient();
  const taskId = String(formData.get("task_id"));
  await supabase.from("manual_tasks").delete().eq("id", taskId);
  revalidatePath("/dashboard");
}
