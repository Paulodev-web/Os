"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { cascadeDeleteProjects } from "@/lib/delete-helpers";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

export async function createNewClient(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const segment = String(formData.get("segment") ?? "").trim();
  const contact = String(formData.get("contact") ?? "").trim();
  if (!name) return;

  const supabase = await createClient();
  const slug = slugify(name);
  const { error } = await supabase.from("clients").insert({
    name,
    slug,
    segment: segment || null,
    contact: contact || null,
  });

  if (!error) {
    revalidatePath("/clientes");
    redirect(`/clientes/${slug}`);
  }
}

export async function updateClientNotes(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const slug = String(formData.get("slug") ?? "");
  const notes = String(formData.get("notes") ?? "").trim();
  if (!id) return;

  const supabase = await createClient();
  await supabase.from("clients").update({ notes: notes || null }).eq("id", id);
  revalidatePath(`/clientes/${slug}`);
}

export async function updateClient(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const slug = String(formData.get("slug") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const segment = String(formData.get("segment") ?? "").trim();
  const contact = String(formData.get("contact") ?? "").trim();
  if (!id || !name || !slug) return;

  // Não altera slug nem portal_token — evita quebrar links do portal já enviados.
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clients")
    .update({ name, segment: segment || null, contact: contact || null })
    .eq("id", id)
    .select("id");

  revalidatePath(`/clientes/${slug}`);
  revalidatePath("/clientes");
  if (error) redirect(`/clientes/${slug}?erro=${encodeURIComponent(error.message)}`);
  if (!data?.length)
    redirect(
      `/clientes/${slug}?erro=${encodeURIComponent("Nada foi salvo — provável falta de permissão (RLS).")}`
    );
}

export async function deleteClient(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const slug = String(formData.get("slug") ?? "");
  if (!id || !slug) return;

  const supabase = await createClient();

  // Exclusão em cascata: leva junto todos os projetos do cliente (com seus
  // marcos e arquivos, inclusive no Storage), propostas e tarefas abertas
  // vinculadas a ele. Antes isso era bloqueado por um guard — agora resolve
  // tudo de uma vez, sem exigir que o Paulo apague projeto por projeto.
  const { data: projectRows } = await supabase
    .from("projects")
    .select("id")
    .eq("client_id", id);
  const projectIds = (projectRows ?? []).map((p) => p.id as string);
  await cascadeDeleteProjects(supabase, projectIds);

  await supabase.from("proposals").delete().eq("client_id", id);
  await supabase.from("tasks").delete().eq("related_entity_id", id);
  if (projectIds.length > 0) {
    await supabase.from("tasks").delete().in("related_entity_id", projectIds);
  }

  const { data, error } = await supabase
    .from("clients")
    .delete()
    .eq("id", id)
    .select("id");
  if (error) redirect(`/clientes/${slug}?erro=${encodeURIComponent(error.message)}`);
  if (!data?.length)
    redirect(
      `/clientes/${slug}?erro=${encodeURIComponent("Nada foi excluído — provável falta de permissão (RLS).")}`
    );
  revalidatePath("/clientes");
  redirect("/clientes");
}

export async function createProject(formData: FormData) {
  const clientId = String(formData.get("client_id") ?? "");
  const clientSlug = String(formData.get("client_slug") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  if (!clientId || !name) return;

  const supabase = await createClient();
  const { data } = await supabase
    .from("projects")
    .insert({
      client_id: clientId,
      name,
      description: description || null,
      started_at: new Date().toLocaleDateString("sv-SE", {
        timeZone: "America/Sao_Paulo",
      }),
    })
    .select("id")
    .single();

  revalidatePath(`/clientes/${clientSlug}`);
  if (data?.id) redirect(`/projetos/${data.id}`);
}
