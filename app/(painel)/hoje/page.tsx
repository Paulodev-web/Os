import Link from "next/link";
import {
  Sparkles,
  CalendarClock,
  AlertTriangle,
  Check,
  X,
  RefreshCw,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import type {
  Alert,
  DailyBriefing,
  Meeting,
  TaskWithSpace,
} from "@/lib/database.types";
import {
  Card,
  PageHeader,
  Badge,
  Stat,
  btnSecondary,
} from "@/components/ui";
import { SPACE_LABEL, MEETING_TYPE_LABEL } from "@/lib/labels";
import { dateBR, todayISO } from "@/lib/format";
import { AgentCapture } from "@/components/agent-capture";
import { AgentMemoryList } from "@/components/agent-memory-list";
import { toggleTask } from "../tarefas/actions";
import { gerarBriefingAgora, updateAlertStatus, deleteMemory } from "./actions";

export const dynamic = "force-dynamic";

const SEVERITY_TONE = {
  info: "info",
  atencao: "warn",
  critico: "danger",
} as const;

const PRIORITY_TONE = {
  alta: "danger",
  media: "warn",
  baixa: "neutral",
} as const;

function horaSP(ts: string): string {
  return new Date(ts).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}

export default async function HojePage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  const { erro } = await searchParams;
  const supabase = await createClient();
  const hoje = todayISO();

  const [
    { data: briefingData },
    { data: tasksData },
    { data: meetingsData },
    { data: alertsData },
    { data: memoriesData },
  ] = await Promise.all([
    supabase
      .from("daily_briefings")
      .select("*")
      .eq("date", hoje)
      .maybeSingle(),
    supabase
      .from("tasks")
      .select("*, spaces(slug, name)")
      .eq("done", false)
      .lte("due_date", hoje)
      .order("due_date"),
    supabase
      .from("meetings")
      .select("*")
      .eq("status", "agendada")
      .gte("scheduled_at", `${hoje}T00:00:00-03:00`)
      .lte("scheduled_at", `${hoje}T23:59:59-03:00`)
      .order("scheduled_at"),
    supabase
      .from("alerts")
      .select("*")
      .eq("status", "aberto")
      .order("created_at", { ascending: false }),
    supabase
      .from("agent_memories")
      .select("id, content, created_at")
      .order("created_at", { ascending: false }),
  ]);

  const briefing = briefingData as DailyBriefing | null;
  const memories = (memoriesData ?? []) as {
    id: string;
    content: string;
    created_at: string;
  }[];
  const doDia = ((tasksData ?? []) as unknown as TaskWithSpace[]).sort(
    (a, b) => {
      const p = { alta: 0, media: 1, baixa: 2 };
      return p[a.priority] - p[b.priority];
    }
  );
  const atrasadas = doDia.filter((t) => (t.due_date ?? "") < hoje);
  const deHoje = doDia.filter((t) => t.due_date === hoje);
  const reunioes = (meetingsData ?? []) as Meeting[];
  const alerts = (alertsData ?? []) as Alert[];

  const dataLonga = new Date(`${hoje}T12:00:00-03:00`).toLocaleDateString(
    "pt-BR",
    {
      weekday: "long",
      day: "numeric",
      month: "long",
      timeZone: "America/Sao_Paulo",
    }
  );

  return (
    <>
      <PageHeader
        title="Hoje"
        subtitle={dataLonga}
        action={
          <form action={gerarBriefingAgora}>
            <button type="submit" className={btnSecondary}>
              <RefreshCw size={14} />
              {briefing ? "Atualizar briefing" : "Gerar briefing"}
            </button>
          </form>
        }
      />

      {erro && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-danger/30 bg-danger-soft px-4 py-3 text-sm font-semibold text-danger">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          {erro}
        </div>
      )}

      {/* Agente central — captura + ação em qualquer módulo */}
      <AgentCapture />
      <AgentMemoryList memories={memories} onDelete={deleteMemory} />

      {/* Briefing do dia */}
      {briefing ? (
        <Card className="mb-6 border-primary/25 p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted">
              <Sparkles size={15} className="text-primary" /> Briefing do dia
            </h2>
            <Badge tone={briefing.generated_by === "ia" ? "green" : "neutral"}>
              {briefing.generated_by === "ia" ? "IA" : "automático"}
            </Badge>
          </div>
          <p className="mt-3 leading-relaxed">{briefing.narrative}</p>
        </Card>
      ) : (
        <Card className="mb-6 border-dashed p-5 text-sm text-muted">
          Sem briefing pra hoje ainda. O cron gera todo dia às 6h — ou clique
          em “Gerar briefing”.
        </Card>
      )}

      {/* Números do dia */}
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat
          label="Pra hoje"
          value={deHoje.length}
        />
        <Stat
          label="Atrasadas"
          value={atrasadas.length}
          tone={atrasadas.length > 0 ? "negative" : "default"}
        />
        <Stat label="Reuniões hoje" value={reunioes.length} />
        <Stat
          label="Alertas abertos"
          value={alerts.length}
          tone={alerts.length > 0 ? "negative" : "positive"}
        />
      </div>

      {/* Alertas */}
      {alerts.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">
            Alertas
          </h2>
          <ul className="space-y-2">
            {alerts.map((a) => (
              <li key={a.id}>
                <Card className="flex flex-wrap items-center gap-3 p-3">
                  <AlertTriangle
                    size={16}
                    className={
                      a.severity === "critico"
                        ? "shrink-0 text-danger"
                        : a.severity === "atencao"
                          ? "shrink-0 text-warn"
                          : "shrink-0 text-info"
                    }
                  />
                  <p className="min-w-0 flex-1 text-sm font-semibold">
                    {a.message}
                  </p>
                  <Badge tone={SEVERITY_TONE[a.severity]}>{a.severity}</Badge>
                  <div className="flex items-center gap-1">
                    <form action={updateAlertStatus}>
                      <input type="hidden" name="id" value={a.id} />
                      <input type="hidden" name="status" value="resolvido" />
                      <button
                        type="submit"
                        title="Resolvido"
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-muted hover:bg-primary-soft hover:text-primary-dark"
                      >
                        <Check size={15} />
                      </button>
                    </form>
                    <form action={updateAlertStatus}>
                      <input type="hidden" name="id" value={a.id} />
                      <input type="hidden" name="status" value="dispensado" />
                      <button
                        type="submit"
                        title="Dispensar"
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-muted hover:bg-background"
                      >
                        <X size={15} />
                      </button>
                    </form>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Tarefas do dia */}
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
              Tarefas (hoje + atrasadas)
            </h2>
            <Link
              href="/tarefas"
              className="text-xs font-semibold text-primary hover:underline"
            >
              ver todas
            </Link>
          </div>
          {doDia.length === 0 ? (
            <Card className="p-4 text-sm text-muted">
              Nada vencendo hoje. Dia limpo.
            </Card>
          ) : (
            <ul className="space-y-2">
              {doDia.map((t) => {
                const overdue = (t.due_date ?? "") < hoje;
                return (
                  <li key={t.id}>
                    <Card className="flex items-center gap-3 p-3">
                      <form action={toggleTask}>
                        <input type="hidden" name="id" value={t.id} />
                        <input type="hidden" name="done" value="false" />
                        <button
                          type="submit"
                          aria-label="Concluir tarefa"
                          className="flex h-5 w-5 items-center justify-center rounded-md border border-border transition hover:border-primary"
                        />
                      </form>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">
                          {t.title}
                        </p>
                        <p className="text-xs text-muted">
                          <span
                            className={
                              overdue ? "font-semibold text-danger" : ""
                            }
                          >
                            {overdue ? "atrasada · " : ""}
                            {dateBR(t.due_date)}
                          </span>
                          {t.spaces
                            ? ` · ${SPACE_LABEL[t.spaces.slug] ?? t.spaces.slug}`
                            : ""}
                        </p>
                      </div>
                      <Badge tone={PRIORITY_TONE[t.priority]}>
                        {t.priority}
                      </Badge>
                    </Card>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Reuniões de hoje */}
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
              Reuniões de hoje
            </h2>
            <Link
              href="/reunioes"
              className="text-xs font-semibold text-primary hover:underline"
            >
              ver todas
            </Link>
          </div>
          {reunioes.length === 0 ? (
            <Card className="p-4 text-sm text-muted">
              Nenhuma reunião hoje.
            </Card>
          ) : (
            <ul className="space-y-2">
              {reunioes.map((m) => (
                <li key={m.id}>
                  <Link href={`/reunioes/${m.id}`}>
                    <Card className="flex items-center gap-3 p-3 transition hover:border-primary/40">
                      <span className="flex items-center gap-1 rounded-lg bg-primary-soft px-2 py-1 text-xs font-black tabular-nums text-primary-dark">
                        <CalendarClock size={12} />
                        {horaSP(m.scheduled_at)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">
                          {m.title}
                        </p>
                        <p className="text-xs text-muted">
                          {MEETING_TYPE_LABEL[m.type] ?? m.type}
                          {m.prep ? " · prep pronto" : " · sem prep"}
                        </p>
                      </div>
                      {m.prep ? (
                        <Badge tone="green">
                          <Sparkles size={11} /> prep
                        </Badge>
                      ) : (
                        <Badge>sem prep</Badge>
                      )}
                    </Card>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
