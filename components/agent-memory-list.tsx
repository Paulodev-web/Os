import { Brain, Trash2 } from "lucide-react";
import { Card } from "@/components/ui";
import { dateBR } from "@/lib/format";

interface Memory {
  id: string;
  content: string;
  created_at: string;
}

/** Memória do agente — gestão manual, além do que ele guarda/apaga sozinho
    via as tools. Renderizado no Hub, abaixo da captura. */
export function AgentMemoryList({
  memories,
  onDelete,
}: {
  memories: Memory[];
  onDelete: (formData: FormData) => void;
}) {
  if (memories.length === 0) return null;

  return (
    <Card className="mb-6 p-4">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted">
        <Brain size={15} className="text-primary" /> Memória do agente
      </h2>
      <ul className="space-y-1.5">
        {memories.map((m) => (
          <li
            key={m.id}
            className="flex items-start gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm"
          >
            <span className="min-w-0 flex-1">{m.content}</span>
            <span className="hidden shrink-0 text-xs text-muted sm:inline">
              {dateBR(m.created_at)}
            </span>
            <form action={onDelete}>
              <input type="hidden" name="id" value={m.id} />
              <button
                type="submit"
                aria-label="Esquecer"
                className="rounded p-0.5 text-muted/40 hover:text-danger"
              >
                <Trash2 size={13} />
              </button>
            </form>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-muted">
        O agente consulta isso automaticamente antes de responder. Peça
        &quot;guarda que…&quot; no campo acima pra adicionar.
      </p>
    </Card>
  );
}
