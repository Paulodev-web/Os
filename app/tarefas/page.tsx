import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { TaskWithSpace } from "@/lib/database.types";

export const dynamic = "force-dynamic";

const PRIORITY_ORDER = { alta: 0, media: 1, baixa: 2 } as const;

const PRIORITY_STYLE: Record<string, string> = {
  alta: "bg-red-500/10 text-red-400 border-red-500/30",
  media: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  baixa: "bg-zinc-500/10 text-zinc-400 border-zinc-500/30",
};

async function toggleTask(formData: FormData) {
  "use server";
  const id = formData.get("id");
  const done = formData.get("done") === "true";
  if (typeof id !== "string") return;

  const supabase = await createClient();
  await supabase.from("tasks").update({ done: !done }).eq("id", id);
  revalidatePath("/tarefas");
}

async function logout() {
  "use server";
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

function formatDue(due: string | null): { label: string; overdue: boolean } {
  if (!due) return { label: "sem prazo", overdue: false };
  const today = new Date().toISOString().slice(0, 10);
  const [y, m, d] = due.split("-");
  return { label: `${d}/${m}/${y}`, overdue: due < today };
}

export default async function TarefasPage() {
  const { supabase } = await requireUser();

  const { data, error } = await supabase
    .from("tasks")
    .select("*, spaces(slug, name)")
    .order("done", { ascending: true })
    .order("due_date", { ascending: true, nullsFirst: false });

  if (error) {
    throw new Error(`Erro ao carregar tarefas: ${error.message}`);
  }

  const tasks = ((data ?? []) as unknown as TaskWithSpace[]).sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    const p = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    if (p !== 0) return p;
    return (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999");
  });

  const pending = tasks.filter((t) => !t.done);
  const doneList = tasks.filter((t) => t.done);

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-4 py-10">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Tarefas</h1>
          <p className="mt-1 text-sm text-zinc-400">
            {pending.length} pendente{pending.length === 1 ? "" : "s"} ·{" "}
            {doneList.length} concluída{doneList.length === 1 ? "" : "s"}
          </p>
        </div>
        <form action={logout}>
          <button
            type="submit"
            className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-400 transition hover:border-zinc-500 hover:text-zinc-200"
          >
            Sair
          </button>
        </form>
      </header>

      <ul className="space-y-2">
        {tasks.map((task) => {
          const due = formatDue(task.due_date);
          return (
            <li
              key={task.id}
              className={`rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 ${
                task.done ? "opacity-50" : ""
              }`}
            >
              <div className="flex items-start gap-3">
                <form action={toggleTask} className="pt-0.5">
                  <input type="hidden" name="id" value={task.id} />
                  <input type="hidden" name="done" value={String(task.done)} />
                  <button
                    type="submit"
                    aria-label={
                      task.done ? "Reabrir tarefa" : "Concluir tarefa"
                    }
                    className={`flex h-5 w-5 items-center justify-center rounded-md border text-xs transition ${
                      task.done
                        ? "border-emerald-500/50 bg-emerald-500/20 text-emerald-400"
                        : "border-zinc-600 hover:border-zinc-400"
                    }`}
                  >
                    {task.done ? "✓" : ""}
                  </button>
                </form>

                <div className="min-w-0 flex-1">
                  <p
                    className={`font-medium ${
                      task.done ? "line-through" : ""
                    }`}
                  >
                    {task.title}
                  </p>
                  {task.note && (
                    <p className="mt-1 text-sm text-zinc-400">{task.note}</p>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                    <span
                      className={`rounded-full border px-2 py-0.5 ${
                        PRIORITY_STYLE[task.priority]
                      }`}
                    >
                      {task.priority}
                    </span>
                    <span className="rounded-full border border-zinc-700 px-2 py-0.5 text-zinc-400">
                      {task.category}
                    </span>
                    {task.legacy_client_slug && (
                      <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-sky-400">
                        {task.legacy_client_slug}
                      </span>
                    )}
                    <span
                      className={
                        due.overdue && !task.done
                          ? "font-medium text-red-400"
                          : "text-zinc-500"
                      }
                    >
                      {due.overdue && !task.done ? "atrasada · " : ""}
                      {due.label}
                    </span>
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {tasks.length === 0 && (
        <p className="mt-12 text-center text-zinc-500">
          Nenhuma tarefa por aqui.
        </p>
      )}
    </main>
  );
}
