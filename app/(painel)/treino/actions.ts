"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { todayISO } from "@/lib/format";

export async function createPlano(formData: FormData) {
  const nome = String(formData.get("nome") ?? "").trim();
  const freq = Number(formData.get("frequencia") ?? 0);
  if (!nome) return;

  const supabase = await createClient();
  // um plano ativo por vez
  await supabase.from("treino_planos").update({ ativo: false }).eq("ativo", true);
  await supabase.from("treino_planos").insert({
    nome,
    ativo: true,
    frequencia_semanal_alvo: freq > 0 ? freq : null,
  });
  revalidatePath("/treino");
}

export async function createDia(formData: FormData) {
  const planoId = String(formData.get("plano_id") ?? "");
  const nome = String(formData.get("nome") ?? "").trim();
  const ordem = Number(formData.get("ordem") ?? 0);
  if (!planoId || !nome) return;

  const supabase = await createClient();
  await supabase.from("treino_dias").insert({
    plano_id: planoId,
    nome,
    ordem: Number.isFinite(ordem) ? ordem : 0,
  });
  revalidatePath("/treino");
}

export async function addFichaItem(formData: FormData) {
  const diaId = String(formData.get("dia_id") ?? "");
  const exercicioId = String(formData.get("exercicio_id") ?? "");
  const series = Number(formData.get("series_alvo") ?? 3);
  const repsMin = Number(formData.get("reps_alvo_min") ?? 0);
  const repsMax = Number(formData.get("reps_alvo_max") ?? 0);
  const carga = Number(String(formData.get("carga_alvo") ?? "").replace(",", "."));
  const ordem = Number(formData.get("ordem") ?? 0);
  if (!diaId || !exercicioId) return;

  const supabase = await createClient();
  await supabase.from("treino_ficha_itens").insert({
    dia_id: diaId,
    exercicio_id: exercicioId,
    ordem: Number.isFinite(ordem) ? ordem : 0,
    series_alvo: series > 0 ? series : 3,
    reps_alvo_min: repsMin > 0 ? repsMin : null,
    reps_alvo_max: repsMax > 0 ? repsMax : null,
    carga_alvo: Number.isFinite(carga) && carga > 0 ? carga : null,
  });
  revalidatePath("/treino");
}

/* Progressão versionada: nunca sobrescreve — cria item novo apontando pro
   antigo via substituiu_item_id e desativa o antigo. */
export async function substituirFichaItem(formData: FormData) {
  const itemId = String(formData.get("item_id") ?? "");
  const series = Number(formData.get("series_alvo") ?? 0);
  const repsMin = Number(formData.get("reps_alvo_min") ?? 0);
  const repsMax = Number(formData.get("reps_alvo_max") ?? 0);
  const carga = Number(String(formData.get("carga_alvo") ?? "").replace(",", "."));
  if (!itemId) return;

  const supabase = await createClient();
  const { data: antigo } = await supabase
    .from("treino_ficha_itens")
    .select("*")
    .eq("id", itemId)
    .maybeSingle();
  if (!antigo) return;

  await supabase.from("treino_ficha_itens").insert({
    dia_id: antigo.dia_id,
    exercicio_id: antigo.exercicio_id,
    ordem: antigo.ordem,
    series_alvo: series > 0 ? series : antigo.series_alvo,
    reps_alvo_min: repsMin > 0 ? repsMin : antigo.reps_alvo_min,
    reps_alvo_max: repsMax > 0 ? repsMax : antigo.reps_alvo_max,
    carga_alvo:
      Number.isFinite(carga) && carga > 0 ? carga : antigo.carga_alvo,
    substituiu_item_id: itemId,
  });
  await supabase
    .from("treino_ficha_itens")
    .update({ ativo: false })
    .eq("id", itemId);
  revalidatePath("/treino");
}

export async function removerFichaItem(formData: FormData) {
  const itemId = String(formData.get("item_id") ?? "");
  if (!itemId) return;

  const supabase = await createClient();
  // soft delete: preserva histórico de progressão
  await supabase
    .from("treino_ficha_itens")
    .update({ ativo: false })
    .eq("id", itemId);
  revalidatePath("/treino");
}

export async function createSessao(formData: FormData) {
  const data = String(formData.get("data") ?? "") || todayISO();
  const diaId = String(formData.get("dia_id") ?? "");
  const obs = String(formData.get("observacoes") ?? "").trim();

  const supabase = await createClient();
  const { data: sessao, error } = await supabase
    .from("treino_sessoes")
    .insert({
      data,
      dia_id: diaId || null,
      observacoes: obs || null,
    })
    .select("id")
    .single();
  if (error || !sessao) return;

  revalidatePath("/treino");
  redirect(`/treino/sessao/${sessao.id}`);
}

export async function deleteSessao(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  await supabase.from("treino_sessoes").delete().eq("id", id);
  revalidatePath("/treino");
  redirect("/treino");
}

export async function registrarSerie(formData: FormData) {
  const sessaoId = String(formData.get("sessao_id") ?? "");
  const exercicioId = String(formData.get("exercicio_id") ?? "");
  const reps = Number(formData.get("reps") ?? 0);
  const carga = Number(String(formData.get("carga") ?? "0").replace(",", "."));
  const rpe = Number(String(formData.get("rpe") ?? "").replace(",", "."));
  if (!sessaoId || !exercicioId || reps <= 0 || !Number.isFinite(carga)) return;

  const supabase = await createClient();
  const { count } = await supabase
    .from("treino_series_registradas")
    .select("id", { count: "exact", head: true })
    .eq("sessao_id", sessaoId)
    .eq("exercicio_id", exercicioId);

  await supabase.from("treino_series_registradas").insert({
    sessao_id: sessaoId,
    exercicio_id: exercicioId,
    serie_num: (count ?? 0) + 1,
    reps,
    carga,
    rpe: Number.isFinite(rpe) && rpe > 0 ? rpe : null,
  });
  revalidatePath(`/treino/sessao/${sessaoId}`);
}

export async function deleteSerie(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const sessaoId = String(formData.get("sessao_id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  await supabase.from("treino_series_registradas").delete().eq("id", id);
  revalidatePath(`/treino/sessao/${sessaoId}`);
}

export async function registrarPeso(formData: FormData) {
  const data = String(formData.get("data") ?? "") || todayISO();
  const peso = Number(String(formData.get("peso") ?? "").replace(",", "."));
  const gordura = Number(
    String(formData.get("percentual_gordura") ?? "").replace(",", ".")
  );
  if (!Number.isFinite(peso) || peso <= 0) return;

  const supabase = await createClient();
  await supabase.from("body_metrics").insert({
    data,
    peso,
    percentual_gordura:
      Number.isFinite(gordura) && gordura > 0 ? gordura : null,
  });
  revalidatePath("/treino");
}
