"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function toggleTask(formData: FormData) {
  const id = formData.get("id");
  const done = formData.get("done") === "true";
  if (typeof id !== "string") return;

  const supabase = await createClient();
  await supabase.from("tasks").update({ done: !done }).eq("id", id);
  revalidatePath("/tarefas");
  revalidatePath("/hoje");
}

export async function createTask(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const spaceId = String(formData.get("space_id") ?? "");
  const category = String(formData.get("category") ?? "operacional");
  const priority = String(formData.get("priority") ?? "media");
  const due = String(formData.get("due_date") ?? "");
  const note = String(formData.get("note") ?? "").trim();

  if (!title || !spaceId) return;

  const supabase = await createClient();
  await supabase.from("tasks").insert({
    title,
    space_id: spaceId,
    category,
    priority,
    due_date: due || null,
    note: note || null,
    source: "manual",
  });
  revalidatePath("/tarefas");
  revalidatePath("/hoje");
}

export async function deleteTask(formData: FormData) {
  const id = formData.get("id");
  if (typeof id !== "string") return;

  const supabase = await createClient();
  await supabase.from("tasks").delete().eq("id", id);
  revalidatePath("/tarefas");
  revalidatePath("/hoje");
}
