"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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

  // Guard: não deixa apagar cliente com projeto ainda vinculado (evita
  // órfãos e apagões acidentais de histórico).
  const { count } = await supabase
    .from("projects")
    .select("id", { count: "exact", head: true })
    .eq("client_id", id);
  if ((count ?? 0) > 0) {
    redirect(
      `/clientes/${slug}?erro=${encodeURIComponent(
        "Apague ou arquive os projetos deste cliente antes de excluí-lo."
      )}`
    );
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
