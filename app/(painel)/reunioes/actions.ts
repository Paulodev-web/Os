"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { geminiJSON, SYSTEM_DEVPAULO } from "@/lib/gemini";
import {
  contextoDaEntidade,
  descreveReuniao,
  gerarPrepReuniao,
} from "@/lib/prep";
import { todayISO } from "@/lib/format";
import type {
  Meeting,
  StructuredNotes,
  TaskCategory,
} from "@/lib/database.types";

const CATEGORIAS: TaskCategory[] = [
  "entrega",
  "financeiro",
  "marketing",
  "comercial",
  "operacional",
  "relacionamento",
];

/* ===== CRUD ===== */

export async function createMeeting(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const type = String(formData.get("type") ?? "outro");
  const spaceId = String(formData.get("space_id") ?? "");
  const scheduled = String(formData.get("scheduled_at") ?? "");
  const related = String(formData.get("related") ?? "");
  if (!title || !spaceId || !scheduled) return;

  // datetime-local vem sem fuso; Paulo opera em America/Sao_Paulo (UTC-3 fixo)
  const scheduledAt = `${scheduled}:00-03:00`;

  let relatedType: string | null = null;
  let relatedId: string | null = null;
  const [rt, rid] = related.split(":");
  if (rid && ["project", "lead", "client"].includes(rt)) {
    relatedType = rt;
    relatedId = rid;
  }

  const supabase = await createClient();
  await supabase.from("meetings").insert({
    title,
    type,
    space_id: spaceId,
    scheduled_at: scheduledAt,
    related_entity_type: relatedType,
    related_entity_id: relatedId,
  });
  revalidatePath("/reunioes");
  revalidatePath("/hoje");
}

export async function updateMeeting(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const type = String(formData.get("type") ?? "");
  const scheduled = String(formData.get("scheduled_at") ?? "");
  if (!id || !title || !scheduled) return;

  // datetime-local vem sem fuso; Paulo opera em America/Sao_Paulo (UTC-3 fixo)
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("meetings")
    .update({ title, type, scheduled_at: `${scheduled}:00-03:00` })
    .eq("id", id)
    .select("id");
  revalidatePath(`/reunioes/${id}`);
  revalidatePath("/reunioes");
  revalidatePath("/hoje");
  if (error) redirect(`/reunioes/${id}?erro=${encodeURIComponent(error.message)}`);
  if (!data?.length)
    redirect(
      `/reunioes/${id}?erro=${encodeURIComponent("Nada foi atualizado — provável falta de permissão (RLS).")}`
    );
}

export async function updateMeetingStatus(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!id || !["agendada", "realizada", "cancelada"].includes(status)) return;

  const supabase = await createClient();
  await supabase.from("meetings").update({ status }).eq("id", id);
  revalidatePath("/reunioes");
  revalidatePath(`/reunioes/${id}`);
}

export async function deleteMeeting(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  await supabase.from("meetings").delete().eq("id", id);
  revalidatePath("/reunioes");
  redirect("/reunioes");
}

export async function saveRawNotes(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const rawNotes = String(formData.get("raw_notes") ?? "");
  if (!id) return;

  const supabase = await createClient();
  await supabase
    .from("meetings")
    .update({ raw_notes: rawNotes.trim() || null })
    .eq("id", id);
  revalidatePath(`/reunioes/${id}`);
}

/* ===== Gerar prep (estado 2) — lógica em lib/prep.ts ===== */

export async function gerarPrep(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  const { data } = await supabase
    .from("meetings")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!data) return;
  const meeting = data as Meeting;

  let erro: string | null = null;
  try {
    await gerarPrepReuniao(supabase, meeting);
  } catch (e) {
    erro = e instanceof Error ? e.message : "Falha ao gerar o prep.";
  }

  revalidatePath(`/reunioes/${id}`);
  if (erro) redirect(`/reunioes/${id}?erro=${encodeURIComponent(erro)}`);
}

/* ===== Estruturar com IA (estado 3) ===== */

export async function estruturarReuniao(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  const { data } = await supabase
    .from("meetings")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!data) return;
  const meeting = data as Meeting;

  // aceita notas recém-digitadas no mesmo submit (campo do form tem prioridade)
  const notasForm = String(formData.get("raw_notes") ?? "").trim();
  const rawNotes = notasForm || meeting.raw_notes?.trim() || "";
  if (!rawNotes) {
    redirect(
      `/reunioes/${id}?erro=${encodeURIComponent("Escreva as anotações da reunião antes de estruturar.")}`
    );
  }
  if (notasForm && notasForm !== meeting.raw_notes) {
    await supabase
      .from("meetings")
      .update({ raw_notes: notasForm })
      .eq("id", id);
  }

  const vinculadaAProjeto = meeting.related_entity_type === "project";

  let erro: string | null = null;
  try {
    const contexto = await contextoDaEntidade(supabase, meeting);
    const notes = await geminiJSON<StructuredNotes>({
      system: SYSTEM_DEVPAULO,
      maxTokens: 2500,
      prompt: `Hoje é ${todayISO()}. Estruture as anotações brutas da reunião abaixo.

REUNIÃO:
${descreveReuniao(meeting)}

CONTEXTO:
${contexto}

ANOTAÇÕES BRUTAS DO PAULO:
"""
${rawNotes}
"""

Responda APENAS com JSON neste formato exato (sem markdown):
{
  "resumo": "2 a 4 frases resumindo a reunião",
  "decisoes": ["decisões tomadas; lista vazia se nenhuma"],
  "proximos_passos": ["próximos passos combinados; lista vazia se nenhum"],
  "tarefas_extraidas": [
    { "titulo": "verbo no infinitivo + objeto", "categoria": "entrega|financeiro|marketing|comercial|operacional|relacionamento", "prazo": "YYYY-MM-DD ou null" }
  ],
  "sugestao_marco": ${
    vinculadaAProjeto
      ? `{ "titulo": "…", "descricao": "…" } ou null — sugira um marco APENAS se a reunião indica uma etapa concluída que vale comunicar ao cliente no portal. Título e descrição voltados ao cliente, sem jargão interno.`
      : `null (reunião não vinculada a projeto — sempre null)`
  }
}

Regras:
- tarefas_extraidas: apenas ações claras e acionáveis para o Paulo; nada genérico.
- prazo: apenas se mencionado ou dedutível das anotações; caso contrário null.`,
    });

    if (
      typeof notes?.resumo !== "string" ||
      !Array.isArray(notes.decisoes) ||
      !Array.isArray(notes.proximos_passos) ||
      !Array.isArray(notes.tarefas_extraidas)
    ) {
      throw new Error("A IA devolveu notas em formato inesperado.");
    }

    // saneamento: categoria fora do enum → operacional; prazo inválido → null
    const tarefas = notes.tarefas_extraidas
      .filter((t) => t && typeof t.titulo === "string" && t.titulo.trim())
      .map((t) => ({
        titulo: t.titulo.trim(),
        categoria: CATEGORIAS.includes(t.categoria) ? t.categoria : "operacional",
        prazo:
          typeof t.prazo === "string" && /^\d{4}-\d{2}-\d{2}$/.test(t.prazo)
            ? t.prazo
            : null,
      })) as StructuredNotes["tarefas_extraidas"];

    const sugestao =
      vinculadaAProjeto &&
      notes.sugestao_marco &&
      typeof notes.sugestao_marco.titulo === "string"
        ? {
            titulo: notes.sugestao_marco.titulo,
            descricao: String(notes.sugestao_marco.descricao ?? ""),
          }
        : null;

    const structured: StructuredNotes = {
      resumo: notes.resumo,
      decisoes: notes.decisoes.filter((d) => typeof d === "string"),
      proximos_passos: notes.proximos_passos.filter(
        (p) => typeof p === "string"
      ),
      tarefas_extraidas: tarefas,
      sugestao_marco: sugestao,
    };

    // re-estruturar: remove tarefas de IA ainda abertas desta reunião (evita duplicar)
    await supabase
      .from("tasks")
      .delete()
      .eq("related_entity_type", "meeting")
      .eq("related_entity_id", id)
      .eq("source", "ia")
      .eq("done", false);

    if (tarefas.length > 0) {
      await supabase.from("tasks").insert(
        tarefas.map((t) => ({
          title: t.titulo,
          category: t.categoria,
          priority: "media",
          due_date: t.prazo,
          space_id: meeting.space_id,
          source: "ia",
          related_entity_type: "meeting",
          related_entity_id: id,
        }))
      );
    }

    await supabase
      .from("meetings")
      .update({ structured_notes: structured, status: "realizada" })
      .eq("id", id);
  } catch (e) {
    erro = e instanceof Error ? e.message : "Falha ao estruturar a reunião.";
  }

  revalidatePath(`/reunioes/${id}`);
  revalidatePath("/tarefas");
  revalidatePath("/hoje");
  if (erro) redirect(`/reunioes/${id}?erro=${encodeURIComponent(erro)}`);
}

/* ===== Criar marco a partir da sugestão da IA ===== */

export async function criarMarcoSugerido(formData: FormData) {
  const meetingId = String(formData.get("meeting_id") ?? "");
  if (!meetingId) return;

  const supabase = await createClient();
  const { data } = await supabase
    .from("meetings")
    .select("*")
    .eq("id", meetingId)
    .maybeSingle();
  if (!data) return;
  const meeting = data as Meeting;

  const sugestao = meeting.structured_notes?.sugestao_marco;
  if (
    !sugestao ||
    meeting.related_entity_type !== "project" ||
    !meeting.related_entity_id
  )
    return;

  // idempotente: não duplica se já existe marco criado a partir desta reunião
  const { data: existente } = await supabase
    .from("project_milestones")
    .select("id")
    .eq("created_from_meeting_id", meetingId)
    .maybeSingle();
  if (existente) return;

  await supabase.from("project_milestones").insert({
    project_id: meeting.related_entity_id,
    title: sugestao.titulo,
    description: sugestao.descricao || null,
    created_from_meeting_id: meetingId,
    // nasce rascunho — publicar no portal é sempre decisão manual do Paulo
  });

  revalidatePath(`/reunioes/${meetingId}`);
  revalidatePath(`/projetos/${meeting.related_entity_id}`);
}
