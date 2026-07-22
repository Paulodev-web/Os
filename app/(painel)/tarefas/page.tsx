import Link from "next/link";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import type { Space, TaskWithSpace } from "@/lib/database.types";
import {
  Card,
  PageHeader,
  EmptyState,
  inputCls,
  labelCls,
  btnPrimary,
} from "@/components/ui";
import { TaskRow } from "@/components/tarefas/task-row";
import {
  PERIODO_LABEL,
  periodoRange,
  periodoValido,
  type Periodo,
} from "@/lib/format";
import { createTask, deleteTask, toggleTask, updateTask } from "./actions";

export const dynamic = "force-dynamic";

const PRIORITY_ORDER = { alta: 0, media: 1, baixa: 2 } as const;

const SPACE_LABEL: Record<string, string> = {
  devpaulo: "devpaulo",
  iservice: "iService",
  pessoal: "Pessoal",
};

const PERIODOS: Periodo[] = ["dia", "semana", "mes", "ano"];

export default async function TarefasPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string }>;
}) {
  const { periodo: periodoParam } = await searchParams;
  const periodo = periodoValido(periodoParam);
  const { inicio, fim } = periodoRange(periodo);

  const supabase = await createClient();

  const [{ data: tasksData, error }, { data: spacesData }] = await Promise.all([
    supabase.from("tasks").select("*, spaces(slug, name)"),
    supabase.from("spaces").select("*").order("slug"),
  ]);

  if (error) throw new Error(`Erro ao carregar tarefas: ${error.message}`);

  const spaces = (spacesData ?? []) as Space[];
  const todas = ((tasksData ?? []) as unknown as TaskWithSpace[]).sort(
    (a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1;
      const p = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
      if (p !== 0) return p;
      return (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999");
    }
  );

  // Tarefa entra na janela se o prazo cai em [inicio, fim] OU se não tem prazo
  // (sem-data sempre visível — evita sumir tarefa por falta de data).
  const tasks = todas.filter((t) => {
    if (!t.due_date) return true;
    const d = t.due_date.slice(0, 10);
    return d >= inicio && d <= fim;
  });

  const pending = tasks.filter((t) => !t.done);
  const done = tasks.filter((t) => t.done);

  return (
    <>
      <PageHeader
        title="Tarefas"
        subtitle={`${pending.length} pendente${pending.length === 1 ? "" : "s"} · ${done.length} concluída${done.length === 1 ? "" : "s"} · ${PERIODO_LABEL[periodo].toLowerCase()}`}
      />

      {/* Filtro por período */}
      <div className="mb-4 inline-flex rounded-lg border border-border bg-surface p-1">
        {PERIODOS.map((p) => (
          <Link
            key={p}
            href={`/tarefas?periodo=${p}`}
            className={`rounded-md px-3 py-1.5 text-sm font-semibold transition ${
              p === periodo
                ? "bg-primary text-white"
                : "text-muted hover:text-foreground"
            }`}
          >
            {PERIODO_LABEL[p]}
          </Link>
        ))}
      </div>

      {/* Nova tarefa */}
      <Card className="mb-6 p-4">
        <form
          action={createTask}
          className="grid grid-cols-2 gap-3 md:grid-cols-12"
        >
          <div className="col-span-2 md:col-span-4">
            <label className={labelCls} htmlFor="nt-title">
              Nova tarefa
            </label>
            <input
              id="nt-title"
              name="title"
              required
              placeholder="O que precisa ser feito?"
              className={inputCls}
            />
          </div>
          <div className="md:col-span-2">
            <label className={labelCls} htmlFor="nt-space">
              Espaço
            </label>
            <select id="nt-space" name="space_id" className={inputCls}>
              {spaces.map((s) => (
                <option key={s.id} value={s.id}>
                  {SPACE_LABEL[s.slug] ?? s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className={labelCls} htmlFor="nt-cat">
              Categoria
            </label>
            <select id="nt-cat" name="category" className={inputCls}>
              <option value="entrega">entrega</option>
              <option value="financeiro">financeiro</option>
              <option value="marketing">marketing</option>
              <option value="comercial">comercial</option>
              <option value="operacional">operacional</option>
              <option value="relacionamento">relacionamento</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label className={labelCls} htmlFor="nt-pri">
              Prioridade
            </label>
            <select
              id="nt-pri"
              name="priority"
              defaultValue="media"
              className={inputCls}
            >
              <option value="alta">alta</option>
              <option value="media">média</option>
              <option value="baixa">baixa</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label className={labelCls} htmlFor="nt-due">
              Prazo
            </label>
            <input id="nt-due" name="due_date" type="date" className={inputCls} />
          </div>
          <div className="col-span-2 flex items-end md:col-span-12 md:justify-end">
            <button type="submit" className={btnPrimary}>
              <Plus size={16} /> Adicionar
            </button>
          </div>
        </form>
      </Card>

      {tasks.length === 0 ? (
        <EmptyState
          title="Nenhuma tarefa nesse período"
          hint="Troque o filtro acima ou crie uma tarefa nova. Tarefas sem prazo aparecem em qualquer período."
        />
      ) : (
        <ul className="space-y-2">
          {tasks.map((task) => (
            <li key={task.id}>
              <TaskRow
                task={task}
                onToggle={toggleTask}
                onUpdate={updateTask}
                onDelete={deleteTask}
              />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
