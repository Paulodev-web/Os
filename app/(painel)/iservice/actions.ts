"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/* ===== Roadmap ===== */

const FASES = ["naming", "mvp", "beta", "lancamento"];
const CICLO_STATUS: Record<string, string> = {
  pendente: "em_andamento",
  em_andamento: "concluido",
  concluido: "pendente",
};

export async function createRoadmapItem(formData: FormData) {
  const phase = String(formData.get("phase") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const targetDate = String(formData.get("target_date") ?? "");
  const ordem = Number(formData.get("ordem") ?? 0);
  if (!FASES.includes(phase) || !title) return;

  const supabase = await createClient();
  await supabase.from("roadmap_items").insert({
    phase,
    title,
    target_date: targetDate || null,
    ordem: Number.isFinite(ordem) ? ordem : 0,
  });
  revalidatePath("/iservice");
}

export async function cycleRoadmapStatus(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const atual = String(formData.get("status") ?? "");
  const proximo = CICLO_STATUS[atual];
  if (!id || !proximo) return;

  const supabase = await createClient();
  await supabase.from("roadmap_items").update({ status: proximo }).eq("id", id);
  revalidatePath("/iservice");
}

export async function deleteRoadmapItem(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  await supabase.from("roadmap_items").delete().eq("id", id);
  revalidatePath("/iservice");
}

/* ===== Decisões ===== */

export async function createDecision(formData: FormData) {
  const topic = String(formData.get("topic") ?? "").trim();
  const context = String(formData.get("context") ?? "").trim();
  if (!topic) return;

  const supabase = await createClient();
  await supabase.from("startup_decisions").insert({
    topic,
    context: context || null,
    options: [],
  });
  revalidatePath("/iservice");
}

export async function addOption(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const nome = String(formData.get("nome") ?? "").trim();
  const pros = String(formData.get("pros") ?? "").trim();
  const contras = String(formData.get("contras") ?? "").trim();
  if (!id || !nome) return;

  const supabase = await createClient();
  const { data } = await supabase
    .from("startup_decisions")
    .select("options")
    .eq("id", id)
    .maybeSingle();
  if (!data) return;

  const options = [
    ...((data.options ?? []) as { nome: string }[]),
    { nome, ...(pros ? { pros } : {}), ...(contras ? { contras } : {}) },
  ];
  await supabase.from("startup_decisions").update({ options }).eq("id", id);
  revalidatePath("/iservice");
}

export async function decidir(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const opcao = String(formData.get("decided_option") ?? "").trim();
  if (!id || !opcao) return;

  const supabase = await createClient();
  await supabase
    .from("startup_decisions")
    .update({
      status: "decidida",
      decided_option: opcao,
      decided_at: new Date().toISOString(),
    })
    .eq("id", id);
  revalidatePath("/iservice");
}

export async function reabrirDecisao(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  await supabase
    .from("startup_decisions")
    .update({ status: "aberta", decided_option: null, decided_at: null })
    .eq("id", id);
  revalidatePath("/iservice");
}

export async function arquivarDecisao(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  await supabase
    .from("startup_decisions")
    .update({ status: "arquivada" })
    .eq("id", id);
  revalidatePath("/iservice");
}
