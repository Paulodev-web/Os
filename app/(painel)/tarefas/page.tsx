import { Plus, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import type { Space, TaskWithSpace } from "@/lib/database.types";
import {
  Card,
  PageHeader,
  Badge,
  EmptyState,
  inputCls,
  labelCls,
  btnPrimary,
} from "@/components/ui";
import { dateBR, isOverdue } from "@/lib/format";
import { createTask, deleteTask, toggleTask } from "./actions";

export const dynamic = "force-dynamic";

const PRIORITY_ORDER = { alta: 0, media: 1, baixa: 2 } as const;

const PRIORITY_TONE = {
  alta: "danger",
  media: "warn",
  baixa: "neutral",
} as const;

const SPACE_LABEL: Record<string, string> = {
  devpaulo: "devpaulo",
  iservice: "iService",
  pessoal: "Pessoal",
};

export default async function TarefasPage() {
  const supabase = await createClient();

  const [{ data: tasksData, error }, { data: spacesData }] = await Promise.all([
    supabase.from("tasks").select("*, spaces(slug, name)"),
    supabase.from("spaces").select("*").order("slug"),
  ]);

  if (error) throw new Error(`Erro ao carregar tarefas: ${error.message}`);

  const spaces = (spacesData ?? []) as Space[];
  const tasks = ((tasksData ?? []) as unknown as TaskWithSpace[]).sort(
    (a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1;
      const p = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
      if (p !== 0) return p;
      return (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999");
    }
  );

  const pending = tasks.filter((t) => !t.done);
  const done = tasks.filter((t) => t.done);

  return (
    <>
      <PageHeader
        title="Tarefas"
        subtitle={`${pending.length} pendente${pending.length === 1 ? "" : "s"} · ${done.length} concluída${done.length === 1 ? "" : "s"}`}
      />

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
          title="Nenhuma tarefa por aqui"
          hint="Crie a primeira tarefa no formulário acima."
        />
      ) : (
        <ul className="space-y-2">
          {tasks.map((task) => {
            const overdue = isOverdue(task.due_date) && !task.done;
            return (
              <li key={task.id}>
                <Card
                  className={`group flex items-start gap-3 p-4 ${task.done ? "opacity-55" : ""}`}
                >
                  <form action={toggleTask} className="pt-0.5">
                    <input type="hidden" name="id" value={task.id} />
                    <input
                      type="hidden"
                      name="done"
                      value={String(task.done)}
                    />
                    <button
                      type="submit"
                      aria-label={
                        task.done ? "Reabrir tarefa" : "Concluir tarefa"
                      }
                      className={`flex h-5 w-5 items-center justify-center rounded-md border text-xs font-bold transition ${
                        task.done
                          ? "border-primary bg-primary text-white"
                          : "border-border hover:border-primary"
                      }`}
                    >
                      {task.done ? "✓" : ""}
                    </button>
                  </form>

                  <div className="min-w-0 flex-1">
                    <p
                      className={`font-semibold ${task.done ? "line-through" : ""}`}
                    >
                      {task.title}
                    </p>
                    {task.note && (
                      <p className="mt-0.5 text-sm text-muted">{task.note}</p>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <Badge tone={PRIORITY_TONE[task.priority]}>
                        {task.priority}
                      </Badge>
                      <Badge>{task.category}</Badge>
                      {task.spaces && (
                        <Badge tone="graphite">
                          {SPACE_LABEL[task.spaces.slug] ?? task.spaces.slug}
                        </Badge>
                      )}
                      {task.legacy_client_slug && (
                        <Badge tone="green">{task.legacy_client_slug}</Badge>
                      )}
                      <span
                        className={`ml-1 text-xs ${overdue ? "font-semibold text-danger" : "text-muted"}`}
                      >
                        {overdue ? "atrasada · " : ""}
                        {dateBR(task.due_date)}
                      </span>
                    </div>
                  </div>

                  <form action={deleteTask}>
                    <input type="hidden" name="id" value={task.id} />
                    <button
                      type="submit"
                      aria-label="Excluir tarefa"
                      className="rounded-lg p-1.5 text-muted/40 opacity-0 transition group-hover:opacity-100 hover:bg-danger-soft hover:text-danger"
                    >
                      <Trash2 size={15} />
                    </button>
                  </form>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
