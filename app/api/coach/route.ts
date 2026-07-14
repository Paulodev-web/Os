import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { claudeConfigurado, CLAUDE_MODEL, SYSTEM_DEVPAULO } from "@/lib/claude";
import { todayISO, num } from "@/lib/format";

/* Coach de treino/dieta — o único chat do painel.
   Responde SEMPRE contra dados reais (metas, registros, séries, ficha). */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type ChatMessage = { role: "user" | "assistant"; content: string };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function montarContexto(supabase: any): Promise<string> {
  const hoje = todayISO();
  const ontem = (() => {
    const d = new Date(`${hoje}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() - 1);
    return d.toISOString().slice(0, 10);
  })();

  const [
    { data: meta },
    { data: registros },
    { data: alimentos },
    { data: plano },
    { data: sessoes },
    { data: series },
    { data: metrics },
  ] = await Promise.all([
    supabase
      .from("dieta_metas")
      .select("*")
      .lte("vigente_desde", hoje)
      .order("vigente_desde", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("dieta_registros")
      .select("data, refeicao_nome, dieta_registro_itens(quantidade_g, alimentos(nome, kcal_100g, proteina_100g, carbo_100g, gordura_100g))")
      .in("data", [hoje, ontem])
      .order("data"),
    supabase.from("alimentos").select("*").order("nome"),
    supabase
      .from("treino_planos")
      .select("*, treino_dias(id, nome, ordem, treino_ficha_itens(series_alvo, reps_alvo_min, reps_alvo_max, carga_alvo, ativo, exercicios(nome)))")
      .eq("ativo", true)
      .maybeSingle(),
    supabase
      .from("treino_sessoes")
      .select("data, observacoes, treino_dias(nome)")
      .order("data", { ascending: false })
      .limit(10),
    supabase
      .from("treino_series_registradas")
      .select("serie_num, reps, carga, rpe, created_at, exercicios(nome), treino_sessoes(data)")
      .order("created_at", { ascending: false })
      .limit(150),
    supabase
      .from("body_metrics")
      .select("data, peso, percentual_gordura")
      .order("data", { ascending: false })
      .limit(5),
  ]);

  const linhas: string[] = [`Hoje é ${hoje}.`];

  if (meta) {
    linhas.push(
      `META VIGENTE (desde ${meta.vigente_desde}): ${meta.kcal_alvo} kcal, ${meta.proteina_alvo}g proteína, ${meta.carbo_alvo}g carbo, ${meta.gordura_alvo}g gordura.`
    );
  } else {
    linhas.push("META: nenhuma meta de dieta definida ainda.");
  }

  // registros de hoje/ontem com macros calculados
  type Reg = {
    data: string;
    refeicao_nome: string;
    dieta_registro_itens: {
      quantidade_g: number;
      alimentos: {
        nome: string;
        kcal_100g: number;
        proteina_100g: number;
        carbo_100g: number;
        gordura_100g: number;
      } | null;
    }[];
  };
  const regs = (registros ?? []) as Reg[];
  for (const dia of [hoje, ontem]) {
    const doDia = regs.filter((r) => r.data === dia);
    const rotulo = dia === hoje ? "HOJE" : "ONTEM";
    if (doDia.length === 0) {
      linhas.push(`DIETA ${rotulo}: nada registrado.`);
      continue;
    }
    let kcal = 0,
      prot = 0,
      carb = 0,
      gord = 0;
    const refs: string[] = [];
    for (const r of doDia) {
      const itens = r.dieta_registro_itens
        .filter((i) => i.alimentos)
        .map((i) => {
          const f = Number(i.quantidade_g) / 100;
          kcal += Number(i.alimentos!.kcal_100g) * f;
          prot += Number(i.alimentos!.proteina_100g) * f;
          carb += Number(i.alimentos!.carbo_100g) * f;
          gord += Number(i.alimentos!.gordura_100g) * f;
          return `${i.alimentos!.nome} ${num(Number(i.quantidade_g))}g`;
        });
      refs.push(`  - ${r.refeicao_nome}: ${itens.join(", ")}`);
    }
    linhas.push(
      `DIETA ${rotulo} (total: ${num(kcal)} kcal, P ${num(prot)}g, C ${num(carb)}g, G ${num(gord)}g):\n${refs.join("\n")}`
    );
  }

  // plano ativo + ficha
  if (plano) {
    const dias = ((plano.treino_dias ?? []) as {
      nome: string;
      ordem: number;
      treino_ficha_itens: {
        series_alvo: number;
        reps_alvo_min: number | null;
        reps_alvo_max: number | null;
        carga_alvo: number | null;
        ativo: boolean;
        exercicios: { nome: string } | null;
      }[];
    }[])
      .sort((a, b) => a.ordem - b.ordem)
      .map((d) => {
        const itens = d.treino_ficha_itens
          .filter((i) => i.ativo && i.exercicios)
          .map(
            (i) =>
              `${i.exercicios!.nome} ${i.series_alvo}x${i.reps_alvo_min ?? "?"}-${i.reps_alvo_max ?? "?"}${i.carga_alvo ? ` @${i.carga_alvo}kg` : ""}`
          )
          .join("; ");
        return `  - ${d.nome}: ${itens || "(ficha vazia)"}`;
      });
    linhas.push(
      `PLANO DE TREINO ATIVO "${plano.nome}"${plano.frequencia_semanal_alvo ? ` (alvo ${plano.frequencia_semanal_alvo}x/semana)` : ""}:\n${dias.join("\n")}`
    );
  } else {
    linhas.push("TREINO: nenhum plano ativo.");
  }

  // últimas sessões
  const sess = (sessoes ?? []) as {
    data: string;
    observacoes: string | null;
    treino_dias: { nome: string } | null;
  }[];
  if (sess.length > 0) {
    linhas.push(
      `ÚLTIMAS SESSÕES:\n${sess.map((s) => `  - ${s.data}: ${s.treino_dias?.nome ?? "livre"}${s.observacoes ? ` (${s.observacoes})` : ""}`).join("\n")}`
    );
  }

  // histórico recente de séries (últimas 3 por exercício)
  const porExercicio = new Map<string, string[]>();
  for (const s of (series ?? []) as {
    serie_num: number;
    reps: number;
    carga: number;
    rpe: number | null;
    exercicios: { nome: string } | null;
    treino_sessoes: { data: string } | null;
  }[]) {
    if (!s.exercicios) continue;
    const nome = s.exercicios.nome;
    const lista = porExercicio.get(nome) ?? [];
    if (lista.length < 3) {
      lista.push(
        `${s.treino_sessoes?.data ?? "?"}: ${s.carga}kg x ${s.reps}${s.rpe ? ` RPE${s.rpe}` : ""}`
      );
      porExercicio.set(nome, lista);
    }
  }
  if (porExercicio.size > 0) {
    linhas.push(
      `SÉRIES RECENTES (mais nova primeiro):\n${[...porExercicio.entries()].map(([nome, ss]) => `  - ${nome}: ${ss.join(" | ")}`).join("\n")}`
    );
  }

  const bm = (metrics ?? []) as {
    data: string;
    peso: number;
    percentual_gordura: number | null;
  }[];
  if (bm.length > 0) {
    linhas.push(
      `PESO CORPORAL:\n${bm.map((m) => `  - ${m.data}: ${m.peso}kg${m.percentual_gordura ? ` (${m.percentual_gordura}% gordura)` : ""}`).join("\n")}`
    );
  }

  // tabela de alimentos disponível (para trocas e cálculos)
  const alims = (alimentos ?? []) as {
    nome: string;
    kcal_100g: number;
    proteina_100g: number;
    carbo_100g: number;
    gordura_100g: number;
  }[];
  linhas.push(
    `TABELA DE ALIMENTOS (por 100g — kcal/P/C/G):\n${alims.map((a) => `  - ${a.nome}: ${a.kcal_100g}/${a.proteina_100g}/${a.carbo_100g}/${a.gordura_100g}`).join("\n")}`
  );

  return linhas.join("\n\n");
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "não autenticado" }, { status: 401 });
  }

  if (!claudeConfigurado()) {
    return NextResponse.json(
      {
        error:
          "IA não configurada — adicione ANTHROPIC_API_KEY nas variáveis de ambiente.",
      },
      { status: 503 }
    );
  }

  let body: { messages?: ChatMessage[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "corpo inválido" }, { status: 400 });
  }

  const messages = (body.messages ?? [])
    .filter(
      (m) =>
        m &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string" &&
        m.content.trim()
    )
    .slice(-20);
  if (messages.length === 0 || messages[messages.length - 1].role !== "user") {
    return NextResponse.json({ error: "mensagem vazia" }, { status: 400 });
  }

  try {
    const contexto = await montarContexto(supabase);
    const client = new Anthropic();
    const msg = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 1000,
      system: `${SYSTEM_DEVPAULO}

Você está no papel de coach de treino e dieta do Paulo. Regras:
- Responda SEMPRE com base nos dados abaixo. Cite números reais (cargas, gramas, kcal).
- Se o dado não existe (ex: exercício nunca registrado), diga isso claramente — nunca invente.
- Cálculos de troca de alimento: use a tabela de alimentos e o que falta pra meta do dia.
- Seja direto e prático; responda em poucas frases, sem enrolação.

DADOS REAIS DO PAULO:
${contexto}`,
      messages,
    });

    const reply = msg.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();

    return NextResponse.json({ reply });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "erro desconhecido";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
