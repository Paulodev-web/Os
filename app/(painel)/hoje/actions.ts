"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { executarBriefingDiario } from "@/lib/briefing";
import { claudeConfigurado, claudeJSON, SYSTEM_DEVPAULO } from "@/lib/claude";
import { todayISO } from "@/lib/format";
import type { TaskCategory, TaskPriority } from "@/lib/database.types";

export async function gerarBriefingAgora() {
  const supabase = await createClient();

  let erro: string | null = null;
  try {
    await executarBriefingDiario(supabase);
  } catch (e) {
    erro = e instanceof Error ? e.message : "Falha ao gerar o briefing.";
  }

  revalidatePath("/hoje");
  if (erro) redirect(`/hoje?erro=${encodeURIComponent(erro)}`);
}

/* Captura rápida: Paulo joga um texto solto, a IA classifica e roteia
   (tarefa no espaço/categoria certos, ou lead novo no comercial).
   Sem IA, vira tarefa operacional na devpaulo — nunca se perde. */

const CATEGORIAS: TaskCategory[] = [
  "entrega",
  "financeiro",
  "marketing",
  "comercial",
  "operacional",
  "relacionamento",
];
const PRIORIDADES: TaskPriority[] = ["alta", "media", "baixa"];

interface Captura {
  tipo: "tarefa" | "lead";
  titulo: string;
  categoria: TaskCategory;
  prioridade: TaskPriority;
  prazo: string | null;
  espaco: "devpaulo" | "iservice" | "pessoal";
}

export async function capturaRapida(formData: FormData) {
  const texto = String(formData.get("texto") ?? "").trim();
  if (!texto) return;

  const supabase = await createClient();
  const { data: spacesData } = await supabase.from("spaces").select("id, slug");
  const spaces = new Map(
    ((spacesData ?? []) as { id: string; slug: string }[]).map((s) => [
      s.slug,
      s.id,
    ])
  );
  const devpauloId = spaces.get("devpaulo");
  if (!devpauloId) return;

  let capturado = false;
  if (claudeConfigurado()) {
    try {
      const c = await claudeJSON<Captura>({
        system: SYSTEM_DEVPAULO,
        maxTokens: 300,
        prompt: `Hoje é ${todayISO()}. Classifique a captura rápida do Paulo abaixo.

TEXTO:
"""
${texto}
"""

Responda APENAS com JSON neste formato exato (sem markdown):
{
  "tipo": "tarefa" ou "lead",
  "titulo": "título curto e acionável",
  "categoria": "entrega|financeiro|marketing|comercial|operacional|relacionamento",
  "prioridade": "alta|media|baixa",
  "prazo": "YYYY-MM-DD ou null (só se o texto indicar prazo)",
  "espaco": "devpaulo|iservice|pessoal"
}

Regras:
- "lead" SÓ se o texto é claramente uma empresa nova pra prospectar; na dúvida, "tarefa".
- espaço: assuntos de treino/dieta/vida → pessoal; startup iService → iservice; resto → devpaulo.`,
      });

      if (c.tipo === "lead" && typeof c.titulo === "string" && c.titulo) {
        await supabase.from("leads").insert({
          name: c.titulo,
          notes: texto,
          stage: "novo",
        });
        capturado = true;
      } else if (typeof c.titulo === "string" && c.titulo) {
        await supabase.from("tasks").insert({
          title: c.titulo,
          category: CATEGORIAS.includes(c.categoria)
            ? c.categoria
            : "operacional",
          priority: PRIORIDADES.includes(c.prioridade)
            ? c.prioridade
            : "media",
          due_date:
            typeof c.prazo === "string" && /^\d{4}-\d{2}-\d{2}$/.test(c.prazo)
              ? c.prazo
              : null,
          space_id: spaces.get(c.espaco) ?? devpauloId,
          source: "ia",
          note: c.titulo.trim() !== texto ? texto : null,
        });
        capturado = true;
      }
    } catch {
      // cai no fallback abaixo
    }
  }

  if (!capturado) {
    await supabase.from("tasks").insert({
      title: texto.slice(0, 140),
      category: "operacional",
      priority: "media",
      space_id: devpauloId,
      source: "manual",
      note: texto.length > 140 ? texto : null,
    });
  }

  revalidatePath("/hoje");
  revalidatePath("/tarefas");
  revalidatePath("/comercial");
}

export async function updateAlertStatus(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!id || !["resolvido", "dispensado"].includes(status)) return;

  const supabase = await createClient();
  await supabase.from("alerts").update({ status }).eq("id", id);
  revalidatePath("/hoje");
}
