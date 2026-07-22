import type { SupabaseClient } from "@supabase/supabase-js";
import { geminiJSON, SYSTEM_DEVPAULO } from "@/lib/gemini";
import { todayISO } from "@/lib/format";
import type { Meeting, MeetingPrep } from "@/lib/database.types";

/* Geração de prep de reunião — usada pelo botão manual (sessão do Paulo)
   e pelo cron diário (service_role), que prepara as reuniões do dia. */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = SupabaseClient<any, any, any>;

export async function contextoDaEntidade(
  db: Db,
  meeting: Meeting
): Promise<string> {
  const { related_entity_type: type, related_entity_id: id } = meeting;
  if (!type || !id) return "Reunião sem vínculo com projeto, lead ou cliente.";

  if (type === "project") {
    const { data: p } = await db
      .from("projects")
      .select("name, status, description, clients(name, segment, notes)")
      .eq("id", id)
      .maybeSingle();
    if (!p) return "Projeto vinculado não encontrado.";
    const proj = p as unknown as {
      name: string;
      status: string;
      description: string | null;
      clients: { name: string; segment: string | null; notes: string | null };
    };
    const { data: marcos } = await db
      .from("project_milestones")
      .select("title, published")
      .eq("project_id", id)
      .order("created_at", { ascending: false })
      .limit(8);
    const marcosTxt = ((marcos ?? []) as { title: string; published: boolean }[])
      .map((m) => `  - ${m.title} (${m.published ? "publicado" : "rascunho"})`)
      .join("\n");
    return [
      `PROJETO VINCULADO: ${proj.name} (status: ${proj.status})`,
      proj.description ? `Descrição: ${proj.description}` : null,
      `Cliente: ${proj.clients.name}${proj.clients.segment ? ` — ${proj.clients.segment}` : ""}`,
      proj.clients.notes ? `Notas do cliente: ${proj.clients.notes}` : null,
      marcosTxt ? `Marcos recentes:\n${marcosTxt}` : "Sem marcos ainda.",
    ]
      .filter(Boolean)
      .join("\n");
  }

  if (type === "lead") {
    const { data: lead } = await db
      .from("leads")
      .select("name, segment, stage, next_action, next_action_date, notes")
      .eq("id", id)
      .maybeSingle();
    if (!lead) return "Lead vinculado não encontrado.";
    return [
      `LEAD VINCULADO: ${lead.name}${lead.segment ? ` — ${lead.segment}` : ""}`,
      `Etapa do funil: ${lead.stage}`,
      lead.next_action
        ? `Próxima ação combinada: ${lead.next_action}${lead.next_action_date ? ` (${lead.next_action_date})` : ""}`
        : null,
      lead.notes ? `Notas: ${lead.notes}` : null,
    ]
      .filter(Boolean)
      .join("\n");
  }

  // client
  const { data: cli } = await db
    .from("clients")
    .select("name, segment, notes")
    .eq("id", id)
    .maybeSingle();
  if (!cli) return "Cliente vinculado não encontrado.";
  const { data: projs } = await db
    .from("projects")
    .select("name, status")
    .eq("client_id", id);
  const lista = (projs ?? []) as { name: string; status: string }[];
  return [
    `CLIENTE VINCULADO: ${cli.name}${cli.segment ? ` — ${cli.segment}` : ""}`,
    cli.notes ? `Notas: ${cli.notes}` : null,
    lista.length
      ? `Projetos: ${lista.map((p) => `${p.name} (${p.status})`).join(", ")}`
      : null,
  ]
    .filter(Boolean)
    .join("\n");
}

export function descreveReuniao(meeting: Meeting): string {
  return [
    `Título: ${meeting.title}`,
    `Tipo: ${meeting.type}`,
    `Data/hora: ${meeting.scheduled_at}`,
  ].join("\n");
}

/** Gera e salva o prep de uma reunião. Lança erro se a IA falhar. */
export async function gerarPrepReuniao(db: Db, meeting: Meeting): Promise<void> {
  const contexto = await contextoDaEntidade(db, meeting);
  const prep = await geminiJSON<MeetingPrep>({
    system: SYSTEM_DEVPAULO,
    maxTokens: 1500,
    prompt: `Hoje é ${todayISO()}. Prepare o Paulo para a reunião abaixo.

REUNIÃO:
${descreveReuniao(meeting)}

CONTEXTO:
${contexto}

Responda APENAS com JSON neste formato exato (sem markdown):
{
  "objetivo": "o objetivo da reunião em uma frase",
  "contexto": ["3 a 5 pontos que o Paulo precisa ter na cabeça"],
  "perguntas": ["3 a 6 perguntas estratégicas para fazer"],
  "alertas": ["riscos ou pontos de atenção; lista vazia se nenhum"]
}

Regras:
- Posicionamento devpaulo: diagnóstico primeiro, médias empresas, sem buzzwords.
- Perguntas devem destravar decisão ou revelar o problema real, não preencher pauta.`,
  });

  if (
    typeof prep?.objetivo !== "string" ||
    !Array.isArray(prep.contexto) ||
    !Array.isArray(prep.perguntas) ||
    !Array.isArray(prep.alertas)
  ) {
    throw new Error("A IA devolveu um prep em formato inesperado.");
  }

  await db
    .from("meetings")
    .update({ prep, prep_generated_at: new Date().toISOString() })
    .eq("id", meeting.id);
}

/** Prep automático do cron: prepara as reuniões agendadas de hoje sem prep. */
export async function prepararReunioesDoDia(db: Db): Promise<number> {
  const hoje = todayISO();
  const { data } = await db
    .from("meetings")
    .select("*")
    .eq("status", "agendada")
    .is("prep", null)
    .gte("scheduled_at", `${hoje}T00:00:00-03:00`)
    .lte("scheduled_at", `${hoje}T23:59:59-03:00`)
    .order("scheduled_at")
    .limit(3); // margem pro maxDuration do cron

  let geradas = 0;
  for (const m of (data ?? []) as Meeting[]) {
    try {
      await gerarPrepReuniao(db, m);
      geradas++;
    } catch {
      // reunião fica sem prep automático; o botão manual continua disponível
    }
  }
  return geradas;
}
