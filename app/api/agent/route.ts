import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { geminiConfigurado, geminiAgent, SYSTEM_DEVPAULO } from "@/lib/gemini";
import { buildAgentTools } from "@/lib/agent-tools";
import { todayISO } from "@/lib/format";

/* Agente central — vive na captura rápida do Hub /hoje.
   Gemini (thinking off) + function calling com CRUD completo em todo módulo.
   Roda SEMPRE sob a sessão RLS do Paulo (nunca service role). */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_IMG_BYTES = 4 * 1024 * 1024;

const INSTRUCOES_AGENTE = `Você é o agente operacional do Paulo dentro do painel OS Pessoal. Você tem ferramentas pra consultar E alterar qualquer módulo (tarefas, reuniões, comercial, clientes, projetos, marcos, financeiro, agendamento, alertas, treino/dieta, iService) e uma memória própria.

Regras:
- Aja: quando o pedido implica criar/editar/excluir algo, use a ferramenta certa — não só descreva o que faria.
- Relate SEMPRE o que fez, em português, de forma clara. Se excluiu algo, comece essa parte com "🗑️ Excluí:" pra ficar inequívoco.
- Datas relativas ("amanhã", "sexta") vire YYYY-MM-DD com base em que hoje é ${todayISO()}.
- Se um pedido for ambíguo ou faltar um id, use as ferramentas get_/list_ pra descobrir antes de agir; se ainda assim faltar, pergunte.
- Memória: só chame remember_fact quando o Paulo pedir explicitamente pra guardar ("lembra disso", "guarda que...", "a partir de agora..."). Nunca memorize por conta própria.
- Fluxo comercial: se o texto/imagem descreve um lead novo (empresa, contato, necessidade), chame create_lead pra registrar no estágio 'novo' E sugira no texto uma mensagem de abertura pronta pro Paulo mandar pro lead.`;

async function fallbackTarefa(
  supabase: Awaited<ReturnType<typeof createClient>>,
  texto: string
): Promise<NextResponse> {
  const { data: space } = await supabase
    .from("spaces")
    .select("id")
    .eq("slug", "devpaulo")
    .maybeSingle();
  if (space?.id) {
    await supabase.from("tasks").insert({
      title: texto.slice(0, 140),
      category: "operacional",
      priority: "media",
      space_id: space.id,
      source: "manual",
      note: texto.length > 140 ? texto : null,
    });
  }
  return NextResponse.json({
    reply:
      "IA não configurada — salvei o texto como tarefa manual na devpaulo pra não perder. Configure GEMINI_API_KEY pra ativar o agente.",
    acoes: [{ tool: "create_task", args: { source: "manual" }, resultado: { ok: true } }],
  });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "não autenticado" }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "corpo inválido" }, { status: 400 });
  }

  const texto = String(form.get("texto") ?? "").trim();
  const imagem = form.get("imagem");
  if (!texto && !(imagem instanceof File)) {
    return NextResponse.json({ error: "mensagem vazia" }, { status: 400 });
  }

  // Fallback: sem IA, grava como tarefa manual (nunca perde a captura).
  if (!geminiConfigurado()) {
    return fallbackTarefa(supabase, texto || "(captura com imagem)");
  }

  // Imagem opcional → base64 (multimodal). Rejeita acima de ~4MB.
  const images: { mimeType: string; data: string }[] = [];
  if (imagem instanceof File && imagem.size > 0) {
    if (imagem.size > MAX_IMG_BYTES) {
      return NextResponse.json(
        { error: "Imagem muito grande (máx ~4MB). Reduza e tente de novo." },
        { status: 413 }
      );
    }
    const buf = Buffer.from(await imagem.arrayBuffer());
    images.push({
      mimeType: imagem.type || "image/png",
      data: buf.toString("base64"),
    });
  }

  // Memória: carregada SEMPRE e injetada no system (não é tool-gated).
  const { data: memoriesData } = await supabase
    .from("agent_memories")
    .select("content")
    .order("created_at", { ascending: false });
  const memorias = ((memoriesData ?? []) as { content: string }[])
    .map((m) => `- ${m.content}`)
    .join("\n");

  const system = `${SYSTEM_DEVPAULO}

${INSTRUCOES_AGENTE}${
    memorias
      ? `\n\nMEMÓRIA — fatos e preferências que o Paulo já pediu pra guardar. Considere isso antes de responder ou agir, sem precisar que ele repita:\n${memorias}`
      : ""
  }`;

  try {
    const { text, acoes } = await geminiAgent({
      system,
      userText: texto || "Analise a imagem anexada e aja conforme o contexto.",
      images,
      tools: buildAgentTools(supabase),
    });
    return NextResponse.json({ reply: text, acoes });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "erro desconhecido";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
