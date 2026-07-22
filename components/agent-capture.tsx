"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, ImagePlus, X, AlertTriangle, Trash2 } from "lucide-react";

interface Acao {
  tool: string;
  args: unknown;
  resultado: unknown;
}

/** Comprime imagem no client (canvas, máx ~1600px) pra caber no teto do
    Route Handler (~4MB) antes de mandar pro agente. */
async function comprimirImagem(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const max = 1600;
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.82)
    );
    if (!blob) return file;
    return new File([blob], file.name.replace(/\.\w+$/, ".jpg"), {
      type: "image/jpeg",
    });
  } catch {
    return file;
  }
}

function isDelete(tool: string): boolean {
  return tool.startsWith("delete_") || tool === "forget_memory";
}

export function AgentCapture() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [texto, setTexto] = useState("");
  const [imagem, setImagem] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reply, setReply] = useState<string | null>(null);
  const [acoes, setAcoes] = useState<Acao[]>([]);

  function pickImage(file: File | undefined) {
    if (!file) return;
    if (preview) URL.revokeObjectURL(preview);
    setImagem(file);
    setPreview(URL.createObjectURL(file));
  }

  function clearImage() {
    if (preview) URL.revokeObjectURL(preview);
    setImagem(null);
    setPreview("");
    if (fileRef.current) fileRef.current.value = "";
  }

  async function enviar() {
    const t = texto.trim();
    if ((!t && !imagem) || loading) return;
    setLoading(true);
    setError(null);
    setReply(null);
    setAcoes([]);
    try {
      const fd = new FormData();
      fd.set("texto", t);
      if (imagem) {
        const comp = await comprimirImagem(imagem);
        fd.set("imagem", comp);
      }
      const res = await fetch("/api/agent", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Falha ao processar.");
      setReply(data.reply ?? "");
      setAcoes(Array.isArray(data.acoes) ? data.acoes : []);
      setTexto("");
      clearImage();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao processar.");
    } finally {
      setLoading(false);
    }
  }

  const exclusoes = acoes.filter((a) => isDelete(a.tool));
  const demais = acoes.filter((a) => !isDelete(a.tool));

  return (
    <div className="mb-6">
      <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-3 shadow-card focus-within:border-primary">
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              void enviar();
            }
          }}
          rows={2}
          placeholder="Fale com o agente… (ex: 'cria uma tarefa pra ligar pro Marcos amanhã' · 'chegou um lead: Padaria Bom Pão, quer site' · 'lembra que prefiro reunião de manhã')"
          className="w-full resize-y bg-transparent text-sm outline-none placeholder:text-muted/60"
        />
        {preview && (
          <div className="relative w-fit">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview}
              alt="anexo"
              className="max-h-32 rounded-lg border border-border"
            />
            <button
              type="button"
              onClick={clearImage}
              aria-label="Remover imagem"
              className="absolute right-1 top-1 rounded-full bg-graphite/80 p-1 text-white"
            >
              <X size={12} />
            </button>
          </div>
        )}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold text-muted transition hover:bg-background hover:text-foreground"
          >
            <ImagePlus size={15} /> Anexar imagem
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => pickImage(e.target.files?.[0])}
          />
          <button
            type="button"
            onClick={() => void enviar()}
            disabled={loading || (!texto.trim() && !imagem)}
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-white transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Sparkles size={15} />
            {loading ? "Pensando…" : "Enviar"}
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-2 flex items-start gap-2 rounded-lg bg-danger-soft px-3 py-2 text-xs font-semibold text-danger">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      {reply && (
        <div className="mt-3 rounded-xl border border-primary/25 bg-surface p-4 shadow-card">
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{reply}</p>

          {exclusoes.length > 0 && (
            <div className="mt-3 rounded-lg border border-danger/30 bg-danger-soft/50 p-2.5">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-danger">
                <Trash2 size={12} /> Exclusões executadas
              </p>
              <ul className="mt-1 space-y-0.5">
                {exclusoes.map((a, i) => (
                  <li key={i} className="text-xs text-danger/90">
                    {a.tool}
                    {typeof a.args === "object" && a.args
                      ? ` (${JSON.stringify(a.args)})`
                      : ""}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {demais.length > 0 && (
            <details className="mt-2">
              <summary className="cursor-pointer text-xs font-semibold text-muted hover:text-primary">
                {demais.length} ação(ões) executada(s)
              </summary>
              <ul className="mt-1 space-y-0.5">
                {demais.map((a, i) => (
                  <li key={i} className="text-xs text-muted">
                    {a.tool}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
