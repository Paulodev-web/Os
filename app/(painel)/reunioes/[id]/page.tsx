import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Sparkles,
  FileText,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Flag,
  ListChecks,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { claudeConfigurado } from "@/lib/claude";
import type { Meeting, Task } from "@/lib/database.types";
import {
  Card,
  PageHeader,
  Badge,
  inputCls,
  labelCls,
  btnPrimary,
  btnSecondary,
  btnGhost,
} from "@/components/ui";
import { MEETING_TYPE_LABEL, MEETING_STATUS_LABEL } from "@/lib/labels";
import { dateTimeBR, dateBR } from "@/lib/format";
import {
  deleteMeeting,
  updateMeetingStatus,
  gerarPrep,
  estruturarReuniao,
  criarMarcoSugerido,
  saveRawNotes,
} from "../actions";

export const dynamic = "force-dynamic";

const STATUS_TONE = {
  agendada: "info",
  realizada: "green",
  cancelada: "neutral",
} as const;

async function relatedLabel(
  supabase: Awaited<ReturnType<typeof createClient>>,
  meeting: Meeting
): Promise<{ label: string; href: string } | null> {
  const { related_entity_type: type, related_entity_id: id } = meeting;
  if (!type || !id) return null;

  if (type === "project") {
    const { data } = await supabase
      .from("projects")
      .select("name")
      .eq("id", id)
      .maybeSingle();
    return data ? { label: `Projeto: ${data.name}`, href: `/projetos/${id}` } : null;
  }
  if (type === "lead") {
    const { data } = await supabase
      .from("leads")
      .select("name")
      .eq("id", id)
      .maybeSingle();
    return data ? { label: `Lead: ${data.name}`, href: "/comercial" } : null;
  }
  const { data } = await supabase
    .from("clients")
    .select("name, slug")
    .eq("id", id)
    .maybeSingle();
  return data
    ? { label: `Cliente: ${data.name}`, href: `/clientes/${data.slug}` }
    : null;
}

export default async function ReuniaoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ erro?: string }>;
}) {
  const { id } = await params;
  const { erro } = await searchParams;
  const supabase = await createClient();

  const { data } = await supabase
    .from("meetings")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();
  const meeting = data as Meeting;

  const [related, { data: iaTasksData }, { data: marcoData }] =
    await Promise.all([
      relatedLabel(supabase, meeting),
      supabase
        .from("tasks")
        .select("*")
        .eq("related_entity_type", "meeting")
        .eq("related_entity_id", id)
        .order("created_at"),
      supabase
        .from("project_milestones")
        .select("id, title, published")
        .eq("created_from_meeting_id", id)
        .maybeSingle(),
    ]);

  const iaTasks = (iaTasksData ?? []) as Task[];
  const marcoCriado = marcoData as {
    id: string;
    title: string;
    published: boolean;
  } | null;
  const iaOn = claudeConfigurado();
  const notes = meeting.structured_notes;

  return (
    <>
      <Link
        href="/reunioes"
        className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-primary"
      >
        <ArrowLeft size={14} /> Reuniões
      </Link>

      {erro && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-danger/30 bg-danger-soft px-4 py-3 text-sm font-semibold text-danger">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          {erro}
        </div>
      )}

      <PageHeader
        title={meeting.title}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            {dateTimeBR(meeting.scheduled_at)} ·{" "}
            {MEETING_TYPE_LABEL[meeting.type] ?? meeting.type}
            <Badge tone={STATUS_TONE[meeting.status]}>
              {MEETING_STATUS_LABEL[meeting.status] ?? meeting.status}
            </Badge>
            {related && (
              <Link href={related.href}>
                <Badge tone="graphite" className="hover:opacity-80">
                  {related.label}
                </Badge>
              </Link>
            )}
          </span>
        }
        action={
          <div className="flex items-center gap-1">
            {meeting.status !== "cancelada" ? (
              <form action={updateMeetingStatus}>
                <input type="hidden" name="id" value={meeting.id} />
                <input type="hidden" name="status" value="cancelada" />
                <button type="submit" className={btnGhost}>
                  Cancelar reunião
                </button>
              </form>
            ) : (
              <form action={updateMeetingStatus}>
                <input type="hidden" name="id" value={meeting.id} />
                <input type="hidden" name="status" value="agendada" />
                <button type="submit" className={btnGhost}>
                  Reagendar
                </button>
              </form>
            )}
            <form action={deleteMeeting}>
              <input type="hidden" name="id" value={meeting.id} />
              <button
                type="submit"
                aria-label="Excluir reunião"
                className={`${btnGhost} hover:!bg-danger-soft hover:!text-danger`}
              >
                <Trash2 size={15} />
              </button>
            </form>
          </div>
        }
      />

      <p className="mb-5 text-xs text-muted">
        Prep e ata são internos — nada desta página aparece no portal do
        cliente.
      </p>

      {/* ===== Prep ===== */}
      <Card className="mb-5 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted">
            <Sparkles size={15} className="text-primary" /> Prep da reunião
          </h2>
          <form action={gerarPrep}>
            <input type="hidden" name="id" value={meeting.id} />
            <button
              type="submit"
              disabled={!iaOn}
              className={meeting.prep ? btnGhost : btnSecondary}
            >
              <Sparkles size={14} />
              {meeting.prep ? "Regerar prep" : "Gerar prep com IA"}
            </button>
          </form>
        </div>

        {!iaOn && (
          <p className="mt-3 rounded-lg bg-warn-soft px-3 py-2 text-xs font-semibold text-warn">
            IA não configurada — adicione ANTHROPIC_API_KEY nas variáveis de
            ambiente para gerar prep e ata.
          </p>
        )}

        {meeting.prep ? (
          <div className="mt-4 space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                Objetivo
              </p>
              <p className="mt-1 font-semibold">{meeting.prep.objetivo}</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                  Contexto
                </p>
                <ul className="mt-1 space-y-1 text-sm">
                  {meeting.prep.contexto.map((c, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-primary">•</span> {c}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                  Perguntas pra fazer
                </p>
                <ul className="mt-1 space-y-1 text-sm">
                  {meeting.prep.perguntas.map((p, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="font-bold text-primary">?</span> {p}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            {meeting.prep.alertas.length > 0 && (
              <div className="rounded-lg bg-warn-soft/60 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-warn">
                  Pontos de atenção
                </p>
                <ul className="mt-1 space-y-1 text-sm">
                  {meeting.prep.alertas.map((a, i) => (
                    <li key={i} className="flex gap-2">
                      <AlertTriangle
                        size={14}
                        className="mt-0.5 shrink-0 text-warn"
                      />
                      {a}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <p className="text-xs text-muted">
              Gerado {dateTimeBR(meeting.prep_generated_at)}
            </p>
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted">
            Sem prep ainda. A IA usa o vínculo da reunião (projeto, lead ou
            cliente) pra montar objetivo, contexto, perguntas e alertas.
          </p>
        )}
      </Card>

      {/* ===== Pós-reunião ===== */}
      <Card className="mb-5 p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted">
          <FileText size={15} className="text-primary" /> Pós-reunião
        </h2>
        <form action={estruturarReuniao} className="mt-3">
          <input type="hidden" name="id" value={meeting.id} />
          <label className={labelCls} htmlFor="rn-notes">
            Anotações brutas (escreva do seu jeito — a IA organiza)
          </label>
          <textarea
            id="rn-notes"
            name="raw_notes"
            rows={7}
            defaultValue={meeting.raw_notes ?? ""}
            placeholder={
              "ex: cliente aprovou layout, pediu ajuste no orçamento até sexta, ficou de mandar acesso do domínio…"
            }
            className={`${inputCls} resize-y font-mono text-[13px] leading-relaxed`}
          />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button type="submit" disabled={!iaOn} className={btnPrimary}>
              <Sparkles size={15} /> Estruturar com IA
            </button>
            <button
              type="submit"
              formAction={saveRawNotes}
              className={btnSecondary}
            >
              Salvar anotações
            </button>
            <span className="text-xs text-muted">
              Estruturar gera a ata (resumo, decisões, próximos passos), cria
              tarefas e marca a reunião como realizada.
            </span>
          </div>
        </form>
      </Card>

      {/* ===== Ata estruturada ===== */}
      {notes && (
        <Card className="mb-5 border-primary/30 p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted">
            <CheckCircle2 size={15} className="text-primary" /> Ata estruturada
            (IA)
          </h2>

          <p className="mt-3 text-sm leading-relaxed">{notes.resumo}</p>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {notes.decisoes.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                  Decisões
                </p>
                <ul className="mt-1 space-y-1 text-sm">
                  {notes.decisoes.map((d, i) => (
                    <li key={i} className="flex gap-2">
                      <CheckCircle2
                        size={14}
                        className="mt-0.5 shrink-0 text-primary"
                      />
                      {d}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {notes.proximos_passos.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                  Próximos passos
                </p>
                <ul className="mt-1 space-y-1 text-sm">
                  {notes.proximos_passos.map((p, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-primary">→</span> {p}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {iaTasks.length > 0 && (
            <div className="mt-4">
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
                <ListChecks size={14} /> Tarefas criadas
              </p>
              <ul className="mt-2 space-y-1.5">
                {iaTasks.map((t) => (
                  <li
                    key={t.id}
                    className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  >
                    <span
                      className={`font-semibold ${t.done ? "line-through opacity-60" : ""}`}
                    >
                      {t.title}
                    </span>
                    <Badge>{t.category}</Badge>
                    {t.due_date && (
                      <span className="text-xs text-muted">
                        {dateBR(t.due_date)}
                      </span>
                    )}
                    <Badge tone="info" className="ml-auto">
                      IA
                    </Badge>
                  </li>
                ))}
              </ul>
              <p className="mt-1.5 text-xs text-muted">
                Gerencie em{" "}
                <Link
                  href="/tarefas"
                  className="font-semibold text-primary hover:underline"
                >
                  Tarefas
                </Link>
                .
              </p>
            </div>
          )}

          {/* Sugestão de marco */}
          {notes.sugestao_marco && (
            <div className="mt-4 rounded-xl border border-primary/30 bg-primary-soft/40 p-4">
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-primary-dark">
                <Flag size={14} /> Sugestão de marco pro portal
              </p>
              <p className="mt-2 font-semibold">
                {notes.sugestao_marco.titulo}
              </p>
              {notes.sugestao_marco.descricao && (
                <p className="mt-1 text-sm text-muted">
                  {notes.sugestao_marco.descricao}
                </p>
              )}
              {marcoCriado ? (
                <p className="mt-3 text-sm font-semibold text-primary-dark">
                  ✓ Marco criado{" "}
                  {marcoCriado.published ? "e publicado" : "(rascunho)"} —{" "}
                  <Link
                    href={`/projetos/${meeting.related_entity_id}`}
                    className="underline"
                  >
                    ver no projeto
                  </Link>
                </p>
              ) : (
                <form action={criarMarcoSugerido} className="mt-3">
                  <input type="hidden" name="meeting_id" value={meeting.id} />
                  <button type="submit" className={btnSecondary}>
                    <Flag size={14} /> Criar marco no projeto (rascunho)
                  </button>
                </form>
              )}
              <p className="mt-2 text-xs text-muted">
                O marco nasce como rascunho — publicar no portal é sempre
                decisão sua.
              </p>
            </div>
          )}
        </Card>
      )}
    </>
  );
}
