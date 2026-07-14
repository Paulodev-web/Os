import type { SupabaseClient } from "@supabase/supabase-js";
import { claudeConfigurado, claudeText, SYSTEM_DEVPAULO } from "@/lib/claude";
import { todayISO } from "@/lib/format";
import type { BriefingSummary, Lead, Task } from "@/lib/database.types";

/* Lógica do briefing diário — compartilhada entre o cron (service_role)
   e o botão "Gerar agora" do painel (sessão do Paulo). */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = SupabaseClient<any, any, any>;

const TZ = "America/Sao_Paulo";

function ontemISO(hoje: string): string {
  const d = new Date(`${hoje}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

function horaSP(ts: string): string {
  return new Date(ts).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TZ,
  });
}

async function montarResumo(db: Db): Promise<BriefingSummary> {
  const hoje = todayISO();
  const ontem = ontemISO(hoje);

  const [
    { count: atrasadas },
    { count: paraHoje },
    { data: reunioes },
    { data: leadsAtivos },
    { data: treinoOntem },
    { data: registrosOntem },
    { data: tarefaMaisAntiga },
  ] = await Promise.all([
    db
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("done", false)
      .lt("due_date", hoje),
    db
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("done", false)
      .eq("due_date", hoje),
    db
      .from("meetings")
      .select("title, scheduled_at")
      .eq("status", "agendada")
      .gte("scheduled_at", `${hoje}T00:00:00-03:00`)
      .lte("scheduled_at", `${hoje}T23:59:59-03:00`)
      .order("scheduled_at"),
    db
      .from("leads")
      .select("name, next_action, next_action_date")
      .not("stage", "in", "(fechado,perdido)"),
    db.from("treino_sessoes").select("id").eq("data", ontem).limit(1),
    db.from("dieta_registros").select("id").eq("data", ontem),
    db
      .from("tasks")
      .select("title, due_date")
      .eq("done", false)
      .lt("due_date", hoje)
      .order("due_date")
      .limit(1),
  ]);

  const leads = (leadsAtivos ?? []) as Pick<
    Lead,
    "name" | "next_action" | "next_action_date"
  >[];
  const semAcao = leads.filter((l) => !l.next_action).length;
  const followupsAtrasados = leads.filter(
    (l) => l.next_action_date && l.next_action_date < hoje
  );

  // kcal de ontem: itens dos registros → alimentos
  let dietaKcal: number | null = null;
  const registroIds = ((registrosOntem ?? []) as { id: string }[]).map(
    (r) => r.id
  );
  if (registroIds.length > 0) {
    const { data: itens } = await db
      .from("dieta_registro_itens")
      .select("quantidade_g, alimentos(kcal_100g)")
      .in("registro_id", registroIds);
    dietaKcal = Math.round(
      ((itens ?? []) as unknown as {
        quantidade_g: number;
        alimentos: { kcal_100g: number } | null;
      }[]).reduce(
        (sum, i) =>
          sum + (Number(i.quantidade_g) * Number(i.alimentos?.kcal_100g ?? 0)) / 100,
        0
      )
    );
  }

  let destaque: string | null = null;
  if (followupsAtrasados.length > 0) {
    destaque = `Follow-up atrasado: ${followupsAtrasados[0].name}${followupsAtrasados[0].next_action ? ` — ${followupsAtrasados[0].next_action}` : ""}`;
  } else if ((atrasadas ?? 0) > 0 && tarefaMaisAntiga?.[0]) {
    destaque = `Tarefa mais atrasada: ${(tarefaMaisAntiga[0] as Task).title}`;
  }

  return {
    tarefas_atrasadas: atrasadas ?? 0,
    tarefas_hoje: paraHoje ?? 0,
    reunioes_hoje: ((reunioes ?? []) as { title: string; scheduled_at: string }[]).map(
      (r) => ({ titulo: r.title, horario: horaSP(r.scheduled_at) })
    ),
    leads_sem_proxima_acao: semAcao,
    followups_atrasados: followupsAtrasados.length,
    treino_ontem: (treinoOntem ?? []).length > 0,
    dieta_ontem_kcal: dietaKcal,
    destaque,
  };
}

function narrativaFallback(s: BriefingSummary): string {
  const partes: string[] = [];
  if (s.reunioes_hoje.length > 0) {
    partes.push(
      `Hoje: ${s.reunioes_hoje.map((r) => `${r.titulo} às ${r.horario}`).join(", ")}.`
    );
  }
  partes.push(
    `${s.tarefas_hoje} tarefa${s.tarefas_hoje === 1 ? "" : "s"} pra hoje e ${s.tarefas_atrasadas} atrasada${s.tarefas_atrasadas === 1 ? "" : "s"}.`
  );
  if (s.followups_atrasados > 0) {
    partes.push(
      `${s.followups_atrasados} follow-up${s.followups_atrasados === 1 ? "" : "s"} atrasado${s.followups_atrasados === 1 ? "" : "s"} no comercial — resolve antes do meio-dia.`
    );
  }
  if (s.leads_sem_proxima_acao > 0) {
    partes.push(
      `${s.leads_sem_proxima_acao} lead${s.leads_sem_proxima_acao === 1 ? "" : "s"} sem próxima ação definida.`
    );
  }
  partes.push(
    s.treino_ontem
      ? "Treino de ontem registrado."
      : "Ontem não teve registro de treino."
  );
  if (s.destaque) partes.push(s.destaque + ".");
  return partes.join(" ");
}

async function narrativaIA(s: BriefingSummary): Promise<string> {
  const texto = await claudeText({
    system: SYSTEM_DEVPAULO,
    maxTokens: 400,
    prompt: `Hoje é ${todayISO()}. Escreva o briefing matinal do Paulo em 2 a 4 frases, tom direto de sócio estratégico, sem saudação genérica e sem buzzword. Aponte a prioridade nº 1 do dia. Dados do dia (JSON):

${JSON.stringify(s, null, 2)}

Responda apenas com o texto do briefing, sem markdown.`,
  });
  const limpo = texto.trim();
  if (!limpo) throw new Error("narrativa vazia");
  return limpo;
}

/* Alertas gerados por regra — dedupe por (type, related_entity_id) aberto,
   e auto-resolve quando a condição deixa de valer. */
const TIPOS_GERADOS = [
  "followup_atrasado",
  "lead_sem_acao",
  "proposta_parada",
  "tarefa_critica",
];

async function gerarAlertas(db: Db): Promise<number> {
  const hoje = todayISO();
  const seteDiasAtras = new Date(Date.now() - 7 * 86400_000).toISOString();

  const [
    { data: spacesData },
    { data: abertos },
    { data: leadsData },
    { data: propostasData },
    { data: tarefasData },
  ] = await Promise.all([
    db.from("spaces").select("id, slug"),
    db
      .from("alerts")
      .select("id, type, related_entity_id")
      .eq("status", "aberto")
      .in("type", TIPOS_GERADOS),
    db
      .from("leads")
      .select("id, name, next_action, next_action_date")
      .not("stage", "in", "(fechado,perdido)"),
    db
      .from("proposals")
      .select("id, title, sent_at, leads(name)")
      .eq("status", "enviada")
      .lt("sent_at", seteDiasAtras),
    db
      .from("tasks")
      .select("id, title, space_id, due_date")
      .eq("done", false)
      .eq("priority", "alta")
      .lt("due_date", hoje),
  ]);

  const spaces = new Map(
    ((spacesData ?? []) as { id: string; slug: string }[]).map((s) => [
      s.slug,
      s.id,
    ])
  );
  const devpauloId = spaces.get("devpaulo");
  if (!devpauloId) return 0;

  type NovoAlerta = {
    space_id: string;
    type: string;
    severity: string;
    message: string;
    related_entity_type: string | null;
    related_entity_id: string | null;
  };
  const desejados: NovoAlerta[] = [];

  for (const l of (leadsData ?? []) as {
    id: string;
    name: string;
    next_action: string | null;
    next_action_date: string | null;
  }[]) {
    if (l.next_action_date && l.next_action_date < hoje) {
      desejados.push({
        space_id: devpauloId,
        type: "followup_atrasado",
        severity: "atencao",
        message: `Follow-up atrasado: ${l.name}${l.next_action ? ` — ${l.next_action}` : ""}`,
        related_entity_type: "lead",
        related_entity_id: l.id,
      });
    } else if (!l.next_action) {
      desejados.push({
        space_id: devpauloId,
        type: "lead_sem_acao",
        severity: "atencao",
        message: `Lead sem próxima ação: ${l.name}`,
        related_entity_type: "lead",
        related_entity_id: l.id,
      });
    }
  }

  for (const p of (propostasData ?? []) as unknown as {
    id: string;
    title: string;
    leads: { name: string } | null;
  }[]) {
    desejados.push({
      space_id: devpauloId,
      type: "proposta_parada",
      severity: "atencao",
      message: `Proposta sem resposta há 7+ dias: ${p.title}${p.leads ? ` (${p.leads.name})` : ""} — hora do follow-up`,
      related_entity_type: "proposal",
      related_entity_id: p.id,
    });
  }

  for (const t of (tarefasData ?? []) as {
    id: string;
    title: string;
    space_id: string;
  }[]) {
    desejados.push({
      space_id: t.space_id,
      type: "tarefa_critica",
      severity: "critico",
      message: `Tarefa de prioridade alta atrasada: ${t.title}`,
      related_entity_type: "task",
      related_entity_id: t.id,
    });
  }

  const chave = (a: { type: string; related_entity_id: string | null }) =>
    `${a.type}:${a.related_entity_id ?? ""}`;
  const abertosList = (abertos ?? []) as {
    id: string;
    type: string;
    related_entity_id: string | null;
  }[];
  const jaAbertos = new Set(abertosList.map(chave));
  const desejadosSet = new Set(desejados.map(chave));

  const novos = desejados.filter((a) => !jaAbertos.has(chave(a)));
  if (novos.length > 0) await db.from("alerts").insert(novos);

  // condição sumiu → resolve sozinho
  const obsoletos = abertosList.filter((a) => !desejadosSet.has(chave(a)));
  if (obsoletos.length > 0) {
    await db
      .from("alerts")
      .update({ status: "resolvido" })
      .in(
        "id",
        obsoletos.map((a) => a.id)
      );
  }

  return novos.length;
}

export async function executarBriefingDiario(db: Db): Promise<{
  date: string;
  generated_by: "ia" | "fallback";
  novos_alertas: number;
}> {
  const summary = await montarResumo(db);

  let narrative: string;
  let generatedBy: "ia" | "fallback" = "fallback";
  if (claudeConfigurado()) {
    try {
      narrative = await narrativaIA(summary);
      generatedBy = "ia";
    } catch {
      narrative = narrativaFallback(summary);
    }
  } else {
    narrative = narrativaFallback(summary);
  }

  const date = todayISO();
  const { error } = await db
    .from("daily_briefings")
    .upsert(
      { date, summary, narrative, generated_by: generatedBy },
      { onConflict: "date" }
    );
  if (error) throw new Error(`Falha ao salvar briefing: ${error.message}`);

  const novosAlertas = await gerarAlertas(db);
  return { date, generated_by: generatedBy, novos_alertas: novosAlertas };
}
