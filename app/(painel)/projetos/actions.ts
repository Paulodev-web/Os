"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { PORTAL_BUCKET } from "@/lib/storage";

export async function updateProjectStatus(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!id || !status) return;

  const supabase = await createClient();
  await supabase.from("projects").update({ status }).eq("id", id);
  revalidatePath(`/projetos/${id}`);
}

export async function createMilestone(formData: FormData) {
  const projectId = String(formData.get("project_id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  if (!projectId || !title) return;

  const supabase = await createClient();
  await supabase.from("project_milestones").insert({
    project_id: projectId,
    title,
    description: description || null,
  });
  revalidatePath(`/projetos/${projectId}`);
}

export async function setMilestonePublished(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const projectId = String(formData.get("project_id") ?? "");
  const publish = formData.get("publish") === "true";
  if (!id) return;

  const supabase = await createClient();
  await supabase
    .from("project_milestones")
    .update({
      published: publish,
      published_at: publish ? new Date().toISOString() : null,
    })
    .eq("id", id);
  revalidatePath(`/projetos/${projectId}`);
}

export async function deleteMilestone(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const projectId = String(formData.get("project_id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  await supabase.from("project_milestones").delete().eq("id", id);
  revalidatePath(`/projetos/${projectId}`);
}

const IMAGE_TYPES = /^image\//;
const VIDEO_TYPES = /^video\//;

export async function addAsset(formData: FormData) {
  const projectId = String(formData.get("project_id") ?? "");
  const milestoneId = String(formData.get("milestone_id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const externalUrl = String(formData.get("external_url") ?? "").trim();
  const file = formData.get("file");
  if (!projectId) return;

  const supabase = await createClient();

  let storagePath: string | null = null;
  let type = "link";

  if (file instanceof File && file.size > 0) {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(-80);
    storagePath = `${projectId}/${randomUUID()}-${safeName}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: upErr } = await supabase.storage
      .from(PORTAL_BUCKET)
      .upload(storagePath, buffer, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });
    if (upErr) {
      console.error("Erro no upload:", upErr.message);
      return;
    }

    type = IMAGE_TYPES.test(file.type)
      ? "imagem"
      : VIDEO_TYPES.test(file.type)
        ? "video"
        : "documento";
  } else if (!externalUrl) {
    return; // nada pra anexar
  }

  await supabase.from("project_assets").insert({
    project_id: projectId,
    milestone_id: milestoneId || null,
    type,
    title: title || (file instanceof File ? file.name : externalUrl),
    storage_path: storagePath,
    external_url: externalUrl || null,
  });
  revalidatePath(`/projetos/${projectId}`);
}

export async function deleteAsset(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const projectId = String(formData.get("project_id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  const { data } = await supabase
    .from("project_assets")
    .select("storage_path")
    .eq("id", id)
    .maybeSingle();

  if (data?.storage_path) {
    await supabase.storage.from(PORTAL_BUCKET).remove([data.storage_path]);
  }
  await supabase.from("project_assets").delete().eq("id", id);
  revalidatePath(`/projetos/${projectId}`);
}
