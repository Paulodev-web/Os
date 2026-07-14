import Anthropic from "@anthropic-ai/sdk";

/* Wrapper único da API Claude. Toda feature de IA do painel passa por aqui
   e precisa degradar graciosamente quando a chave não está configurada. */

export const CLAUDE_MODEL = process.env.CLAUDE_MODEL ?? "claude-sonnet-5";

export function claudeConfigurado(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export class ClaudeIndisponivelError extends Error {
  constructor() {
    super(
      "IA não configurada: adicione ANTHROPIC_API_KEY nas variáveis de ambiente."
    );
    this.name = "ClaudeIndisponivelError";
  }
}

/** Chama a API e devolve o texto da resposta. */
export async function claudeText(opts: {
  system: string;
  prompt: string;
  maxTokens?: number;
}): Promise<string> {
  if (!claudeConfigurado()) throw new ClaudeIndisponivelError();

  const client = new Anthropic();
  const msg = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: opts.maxTokens ?? 2000,
    system: opts.system,
    messages: [{ role: "user", content: opts.prompt }],
  });

  return msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
}

/** Chama a API esperando JSON puro na resposta (tolera cerca de ```json). */
export async function claudeJSON<T>(opts: {
  system: string;
  prompt: string;
  maxTokens?: number;
}): Promise<T> {
  const raw = await claudeText(opts);
  // recorta do primeiro { ao último } — tolera cercas ```json e texto solto
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new Error("A IA não devolveu JSON válido.");
  }
  return JSON.parse(raw.slice(start, end + 1)) as T;
}

export const SYSTEM_DEVPAULO = `Você é o copiloto operacional do Paulo Ricardo, fundador da devpaulo.com.br — estúdio solo de diagnóstico e desenvolvimento de software sob medida para médias empresas. Tom: direto, confiante, estratégico, sem buzzwords. Escreva sempre em português do Brasil.`;
