"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PORTAL_BUCKET } from "@/lib/storage";

export async function updateProjectStatus(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!id || !status) return;

  const supabase = await createClient();
  const { error } = await supabase
    .from("projects")
    .update({ status })
    .eq("id", id);
  revalidatePath(`/projetos/${id}`);
  if (error) redirect(`/projetos/${id}?erro=${encodeURIComponent(error.message)}`);
}

export async function createMilestone(formData: FormData) {
  const projectId = String(formData.get("project_id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const phase = String(formData.get("phase") ?? "").trim();
  if (!projectId || !title) return;

  const supabase = await createClient();
  const { error } = await supabase.from("project_milestones").insert({
    project_id: projectId,
    title,
    description: description || null,
    phase: phase || null,
  });
  revalidatePath(`/projetos/${projectId}`);
  if (error) redirect(`/projetos/${projectId}?erro=${encodeURIComponent(error.message)}`);
}

export async function updateProjectPortalSettings(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const currentPhase = String(formData.get("current_phase") ?? "").trim();
  const currentPhaseTargetDate = String(
    formData.get("current_phase_target_date") ?? ""
  ).trim();
  const scopeIncluded = String(formData.get("scope_included") ?? "").trim();
  const scopeExcluded = String(formData.get("scope_excluded") ?? "").trim();
  const nextAction = String(formData.get("next_action") ?? "").trim();
  const nextActionDate = String(formData.get("next_action_date") ?? "").trim();

  const supabase = await createClient();
  const { error } = await supabase
    .from("projects")
    .update({
      current_phase: currentPhase || null,
      current_phase_target_date: currentPhaseTargetDate || null,
      scope_included: scopeIncluded || null,
      scope_excluded: scopeExcluded || null,
      next_action: nextAction || null,
      next_action_date: nextActionDate || null,
    })
    .eq("id", id);
  revalidatePath(`/projetos/${id}`);
  if (error) redirect(`/projetos/${id}?erro=${encodeURIComponent(error.message)}`);
}

export async function setMilestonePublished(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const projectId = String(formData.get("project_id") ?? "");
  const publish = formData.get("publish") === "true";
  if (!id) return;

  const supabase = await createClient();
  const { error } = await supabase
    .from("project_milestones")
    .update({
      published: publish,
      published_at: publish ? new Date().toISOString() : null,
    })
    .eq("id", id);
  revalidatePath(`/projetos/${projectId}`);
  if (error) redirect(`/projetos/${projectId}?erro=${encodeURIComponent(error.message)}`);
}

export async function deleteMilestone(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const projectId = String(formData.get("project_id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  const { error } = await supabase
    .from("project_milestones")
    .delete()
    .eq("id", id);
  revalidatePath(`/projetos/${projectId}`);
  if (error) redirect(`/projetos/${projectId}?erro=${encodeURIComponent(error.message)}`);
}

const IMAGE_TYPES = /^image\//;
const VIDEO_TYPES = /^video\//;

export async function addAsset(formData: FormData) {
  const projectId = String(formData.get("project_id") ?? "");
  const milestoneId = String(formData.get("milestone_id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const externalUrl = String(formData.get("external_url") ?? "").trim();
  const files = formData
    .getAll("file")
    .filter((f): f is File => f instanceof File && f.size > 0);
  if (!projectId) return;
  if (files.length === 0 && !externalUrl) return; // nada pra anexar

  const supabase = await createClient();

  const rows: {
    project_id: string;
    milestone_id: string | null;
    type: string;
    title: string | null;
    storage_path: string | null;
    external_url: string | null;
  }[] = [];

  for (const file of files) {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(-80);
    const storagePath = `${projectId}/${randomUUID()}-${safeName}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: upErr } = await supabase.storage
      .from(PORTAL_BUCKET)
      .upload(storagePath, buffer, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });
    if (upErr) {
      redirect(
        `/projetos/${projectId}?erro=${encodeURIComponent(`Falha no upload de ${file.name}: ${upErr.message}`)}`
      );
    }

    const type = IMAGE_TYPES.test(file.type)
      ? "imagem"
      : VIDEO_TYPES.test(file.type)
        ? "video"
        : "documento";

    rows.push({
      project_id: projectId,
      milestone_id: milestoneId || null,
      type,
      title: title || file.name,
      storage_path: storagePath,
      external_url: null,
    });
  }

  if (files.length === 0 && externalUrl) {
    rows.push({
      project_id: projectId,
      milestone_id: milestoneId || null,
      type: "link",
      title: title || externalUrl,
      storage_path: null,
      external_url: externalUrl,
    });
  }

  const { error: insErr } = await supabase.from("project_assets").insert(rows);
  revalidatePath(`/projetos/${projectId}`);
  if (insErr) redirect(`/projetos/${projectId}?erro=${encodeURIComponent(insErr.message)}`);
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
  const { error } = await supabase.from("project_assets").delete().eq("id", id);
  revalidatePath(`/projetos/${projectId}`);
  if (error) redirect(`/projetos/${projectId}?erro=${encodeURIComponent(error.message)}`);
}
