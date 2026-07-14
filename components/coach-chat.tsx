"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Sparkles, AlertTriangle } from "lucide-react";

type ChatMessage = { role: "user" | "assistant"; content: string };

const SUGESTOES = [
  "Quanto de proteína eu comi hoje?",
  "Qual foi minha última carga em cada exercício?",
  "Qual treino é hoje?",
  "Posso trocar o jantar por 150g de arroz e frango?",
];

export function CoachChat({ iaOn }: { iaOn: boolean }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function enviar(texto: string) {
    const pergunta = texto.trim();
    if (!pergunta || loading) return;
    setError(null);
    setInput("");
    const historico: ChatMessage[] = [
      ...messages,
      { role: "user", content: pergunta },
    ];
    setMessages(historico);
    setLoading(true);
    try {
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: historico }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Falha ao responder.");
      setMessages([...historico, { role: "assistant", content: data.reply }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao responder.");
      // devolve a pergunta pro campo pra não perder o texto
      setMessages(messages);
      setInput(pergunta);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-[calc(100vh-14rem)] min-h-96 flex-col rounded-xl border border-border bg-surface shadow-card">
      {/* Mensagens */}
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
            <Sparkles size={28} className="text-primary" />
            <p className="max-w-sm text-sm text-muted">
              Pergunte sobre seu treino e sua dieta — as respostas usam o que
              você registrou de verdade, não chute.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {SUGESTOES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => enviar(s)}
                  disabled={!iaOn || loading}
                  className="rounded-full border border-border bg-background px-3 py-1.5 text-xs font-semibold text-muted transition hover:border-primary/40 hover:text-primary-dark disabled:opacity-50"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                m.role === "user"
                  ? "rounded-br-md bg-graphite text-white"
                  : "rounded-bl-md border border-border bg-background"
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 rounded-2xl rounded-bl-md border border-border bg-background px-4 py-2.5 text-sm text-muted">
              <span className="inline-flex gap-1">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:0ms]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:150ms]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:300ms]" />
              </span>
              consultando seus dados…
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Erros / IA off */}
      {(error || !iaOn) && (
        <div className="mx-4 mb-2 flex items-start gap-2 rounded-lg bg-warn-soft px-3 py-2 text-xs font-semibold text-warn">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          {!iaOn
            ? "IA não configurada — adicione ANTHROPIC_API_KEY nas variáveis de ambiente."
            : error}
        </div>
      )}

      {/* Input */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          enviar(input);
        }}
        className="flex items-center gap-2 border-t border-border p-3"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            iaOn ? "ex: quanto de proteína falta hoje?" : "IA não configurada"
          }
          disabled={!iaOn || loading}
          className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!iaOn || loading || !input.trim()}
          aria-label="Enviar"
          className="flex h-9 w-10 items-center justify-center rounded-lg bg-primary text-white transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}
