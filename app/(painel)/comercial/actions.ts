"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const STAGES = [
  "novo",
  "diagnostico_agendado",
  "proposta_enviada",
  "follow_up",
  "fechado",
  "perdido",
];

export async function createLead(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const segment = String(formData.get("segment") ?? "").trim();
  const contact = String(formData.get("contact") ?? "").trim();
  const nextAction = String(formData.get("next_action") ?? "").trim();
  const nextActionDate = String(formData.get("next_action_date") ?? "");
  const notes = String(formData.get("notes") ?? "").trim();
  if (!name) return;

  const supabase = await createClient();
  await supabase.from("leads").insert({
    name,
    segment: segment || null,
    contact: contact || null,
    next_action: nextAction || null,
    next_action_date: nextActionDate || null,
    notes: notes || null,
  });
  revalidatePath("/comercial");
}

export async function moveLeadStage(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const stage = String(formData.get("stage") ?? "");
  if (!id || !STAGES.includes(stage)) return;

  const supabase = await createClient();
  await supabase
    .from("leads")
    .update({ stage, updated_at: new Date().toISOString() })
    .eq("id", id);
  revalidatePath("/comercial");
  revalidatePath("/hoje");
}

export async function updateLead(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const nextAction = String(formData.get("next_action") ?? "").trim();
  const nextActionDate = String(formData.get("next_action_date") ?? "");
  const notes = String(formData.get("notes") ?? "").trim();
  if (!id) return;

  const supabase = await createClient();
  await supabase
    .from("leads")
    .update({
      next_action: nextAction || null,
      next_action_date: nextActionDate || null,
      notes: notes || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  revalidatePath("/comercial");
  revalidatePath("/hoje");
}

export async function deleteLead(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  await supabase.from("leads").delete().eq("id", id);
  revalidatePath("/comercial");
}

export async function createProposal(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const value = Number(String(formData.get("value") ?? "0").replace(",", "."));
  const leadId = String(formData.get("lead_id") ?? "");
  const status = String(formData.get("status") ?? "rascunho");
  const docUrl = String(formData.get("doc_url") ?? "").trim();
  if (!title || !Number.isFinite(value) || value < 0) return;

  const supabase = await createClient();
  await supabase.from("proposals").insert({
    title,
    value,
    lead_id: leadId || null,
    status,
    sent_at: status === "enviada" ? new Date().toISOString() : null,
    doc_url: docUrl || null,
  });
  revalidatePath("/comercial");
}

export async function updateProposal(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const value = Number(String(formData.get("value") ?? "0").replace(",", "."));
  const notes = String(formData.get("notes") ?? "").trim();
  const docUrl = String(formData.get("doc_url") ?? "").trim();
  if (!id || !title || !Number.isFinite(value) || value < 0) return;

  const supabase = await createClient();
  const { error } = await supabase
    .from("proposals")
    .update({ title, value, notes: notes || null, doc_url: docUrl || null })
    .eq("id", id);
  revalidatePath("/comercial");
  if (error) redirect(`/comercial?erro=${encodeURIComponent(error.message)}`);
}

export async function updateProposalStatus(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!id || !["rascunho", "enviada", "aceita", "recusada"].includes(status))
    return;

  const supabase = await createClient();
  const patch: Record<string, unknown> = { status };
  if (status === "enviada") patch.sent_at = new Date().toISOString();
  await supabase.from("proposals").update(patch).eq("id", id);
  revalidatePath("/comercial");
}

export async function deleteProposal(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  await supabase.from("proposals").delete().eq("id", id);
  revalidatePath("/comercial");
}
