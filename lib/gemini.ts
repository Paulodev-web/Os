import {
  GoogleGenAI,
  type Content,
  type Part,
  type FunctionDeclaration,
} from "@google/genai";

/* Wrapper único da API Gemini. Toda feature de IA do painel passa por aqui.
   Thinking desligado de verdade (thinkingBudget: 0) — só a família 2.5 aceita
   isso; a 3.x tem piso. Por isso o default é gemini-2.5-flash. */

export const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";

export function geminiConfigurado(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

export class GeminiIndisponivelError extends Error {
  constructor() {
    super(
      "IA não configurada: adicione GEMINI_API_KEY nas variáveis de ambiente."
    );
    this.name = "GeminiIndisponivelError";
  }
}

function client(): GoogleGenAI {
  if (!geminiConfigurado()) throw new GeminiIndisponivelError();
  return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
}

/** Chama a API e devolve o texto da resposta. */
export async function geminiText(opts: {
  system: string;
  prompt: string;
  maxTokens?: number;
}): Promise<string> {
  const res = await client().models.generateContent({
    model: GEMINI_MODEL,
    contents: opts.prompt,
    config: {
      systemInstruction: opts.system,
      maxOutputTokens: opts.maxTokens ?? 2000,
      thinkingConfig: { thinkingBudget: 0 },
    },
  });
  const text = res.text?.trim();
  if (!text) throw new Error("A IA não devolveu texto.");
  return text;
}

/** Chama a API esperando JSON puro (tolera cerca de ```json e texto solto). */
export async function geminiJSON<T>(opts: {
  system: string;
  prompt: string;
  maxTokens?: number;
}): Promise<T> {
  const res = await client().models.generateContent({
    model: GEMINI_MODEL,
    contents: opts.prompt,
    config: {
      systemInstruction: opts.system,
      maxOutputTokens: opts.maxTokens ?? 2000,
      thinkingConfig: { thinkingBudget: 0 },
      responseMimeType: "application/json",
    },
  });
  const raw = res.text ?? "";
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new Error("A IA não devolveu JSON válido.");
  }
  return JSON.parse(raw.slice(start, end + 1)) as T;
}

/** Multi-turno (usado pelo Coach). "assistant" → "model" (nomenclatura Gemini). */
export async function geminiChat(opts: {
  system: string;
  messages: { role: "user" | "assistant"; content: string }[];
  maxTokens?: number;
}): Promise<string> {
  const contents: Content[] = opts.messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
  const res = await client().models.generateContent({
    model: GEMINI_MODEL,
    contents,
    config: {
      systemInstruction: opts.system,
      maxOutputTokens: opts.maxTokens ?? 1000,
      thinkingConfig: { thinkingBudget: 0 },
    },
  });
  return (res.text ?? "").trim();
}

/* ===== Agente central (Frente 3.1) — loop manual de function calling ===== */

export interface GeminiTool {
  name: string;
  description: string;
  parametersJsonSchema: Record<string, unknown>;
  execute: (args: Record<string, unknown>) => Promise<unknown>;
}

export interface AgentAcao {
  tool: string;
  args: unknown;
  resultado: unknown;
}

export async function geminiAgent(opts: {
  system: string;
  userText: string;
  images?: { mimeType: string; data: string }[]; // base64
  tools: GeminiTool[];
  maxTurns?: number;
}): Promise<{ text: string; acoes: AgentAcao[] }> {
  const ai = client();

  const parts: Part[] = [{ text: opts.userText }];
  for (const img of opts.images ?? []) {
    parts.push({ inlineData: { mimeType: img.mimeType, data: img.data } });
  }
  let contents: Content[] = [{ role: "user", parts }];

  const acoes: AgentAcao[] = [];
  const declarations: FunctionDeclaration[] = opts.tools.map((t) => ({
    name: t.name,
    description: t.description,
    parametersJsonSchema: t.parametersJsonSchema,
  }));
  const config = {
    systemInstruction: opts.system,
    thinkingConfig: { thinkingBudget: 0 },
    tools: [{ functionDeclarations: declarations }],
  };

  const maxTurns = opts.maxTurns ?? 6;
  for (let turn = 0; turn < maxTurns; turn++) {
    const res = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents,
      config,
    });

    const calls = res.functionCalls ?? [];
    if (calls.length === 0) {
      return { text: (res.text ?? "").trim(), acoes };
    }

    contents = [
      ...contents,
      { role: "model", parts: calls.map((c) => ({ functionCall: c })) },
    ];

    const responses: Part[] = [];
    for (const c of calls) {
      const tool = opts.tools.find((t) => t.name === c.name);
      let resultado: unknown;
      try {
        resultado = tool
          ? await tool.execute(c.args ?? {})
          : { erro: "ferramenta desconhecida" };
      } catch (e) {
        resultado = {
          erro: e instanceof Error ? e.message : "erro ao executar a ferramenta",
        };
      }
      acoes.push({ tool: c.name ?? "?", args: c.args, resultado });
      responses.push({
        functionResponse: {
          name: c.name,
          response: { result: resultado },
        },
      });
    }
    contents = [...contents, { role: "user", parts: responses }];
  }

  return {
    text: "Não consegui concluir dentro do limite de passos — tente de novo com um pedido mais específico.",
    acoes,
  };
}

export const SYSTEM_DEVPAULO = `Você é o copiloto operacional do Paulo Ricardo, fundador da devpaulo.com.br — estúdio solo de diagnóstico e desenvolvimento de software sob medida para médias empresas. Tom: direto, confiante, estratégico, sem buzzwords. Escreva sempre em português do Brasil.`;
