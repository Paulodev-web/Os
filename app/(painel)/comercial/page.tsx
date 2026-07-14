import { Plus, Check, Trash2, Pencil, FileText } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import type { Lead, LeadStage, Proposal } from "@/lib/database.types";
import {
  Card,
  PageHeader,
  Badge,
  EmptyState,
  Stat,
  inputCls,
  labelCls,
  btnPrimary,
  btnSecondary,
} from "@/components/ui";
import { LEAD_STAGE_LABEL } from "@/lib/labels";
import { brl, dateBR, isOverdue } from "@/lib/format";
import {
  createLead,
  moveLeadStage,
  updateLead,
  deleteLead,
  createProposal,
  updateProposalStatus,
  deleteProposal,
} from "./actions";

export const dynamic = "force-dynamic";

const STAGES: LeadStage[] = [
  "novo",
  "diagnostico_agendado",
  "proposta_enviada",
  "follow_up",
  "fechado",
  "perdido",
];

const PROPOSAL_STATUS_LABEL: Record<string, string> = {
  rascunho: "Rascunho",
  enviada: "Enviada",
  aceita: "Aceita",
  recusada: "Recusada",
};

const PROPOSAL_TONE = {
  rascunho: "neutral",
  enviada: "info",
  aceita: "green",
  recusada: "danger",
} as const;

function LeadCard({ lead }: { lead: Lead }) {
  const overdue = isOverdue(lead.next_action_date);
  return (
    <Card className="p-3">
      <p className="font-semibold leading-snug">{lead.name}</p>
      {lead.segment && <p className="text-xs text-muted">{lead.segment}</p>}

      {lead.next_action && (
        <p
          className={`mt-2 text-xs leading-snug ${overdue ? "font-semibold text-danger" : "text-muted"}`}
        >
          → {lead.next_action}
          {lead.next_action_date && (
            <span className="ml-1 whitespace-nowrap">
              ({overdue ? "atrasado · " : ""}
              {dateBR(lead.next_action_date)})
            </span>
          )}
        </p>
      )}

      {/* mover de estágio */}
      <form action={moveLeadStage} className="mt-3 flex items-center gap-1.5">
        <input type="hidden" name="id" value={lead.id} />
        <select
          name="stage"
          defaultValue={lead.stage}
          className={`${inputCls} !px-2 !py-1 !text-xs`}
        >
          {STAGES.map((s) => (
            <option key={s} value={s}>
              {LEAD_STAGE_LABEL[s]}
            </option>
          ))}
        </select>
        <button
          type="submit"
          aria-label="Mover de estágio"
          className="flex h-7 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-white transition hover:bg-primary-dark"
        >
          <Check size={14} />
        </button>
      </form>

      {/* editar próxima ação / notas */}
      <details className="mt-2">
        <summary className="cursor-pointer text-xs font-semibold text-muted hover:text-primary">
          <Pencil size={11} className="mr-1 inline" />
          editar
        </summary>
        <form action={updateLead} className="mt-2 space-y-2">
          <input type="hidden" name="id" value={lead.id} />
          <input
            name="next_action"
            defaultValue={lead.next_action ?? ""}
            placeholder="Próxima ação"
            className={`${inputCls} !px-2 !py-1 !text-xs`}
          />
          <input
            name="next_action_date"
            type="date"
            defaultValue={lead.next_action_date ?? ""}
            className={`${inputCls} !px-2 !py-1 !text-xs`}
          />
          <textarea
            name="notes"
            rows={2}
            defaultValue={lead.notes ?? ""}
            placeholder="Notas"
            className={`${inputCls} !px-2 !py-1 !text-xs`}
          />
          <div className="flex items-center justify-between">
            <button
              type="submit"
              className="rounded-lg bg-primary px-2.5 py-1 text-xs font-semibold text-white hover:bg-primary-dark"
            >
              Salvar
            </button>
            <button
              type="submit"
              formAction={deleteLead}
              aria-label="Excluir lead"
              className="rounded-lg p-1 text-muted/50 hover:bg-danger-soft hover:text-danger"
            >
              <Trash2 size={13} />
            </button>
          </div>
        </form>
      </details>
    </Card>
  );
}

export default async function ComercialPage() {
  const supabase = await createClient();

  const [{ data: leadsData, error }, { data: proposalsData }] =
    await Promise.all([
      supabase
        .from("leads")
        .select("*")
        .order("updated_at", { ascending: false }),
      supabase
        .from("proposals")
        .select("*, leads(name), clients(name)")
        .order("created_at", { ascending: false }),
    ]);

  if (error) throw new Error(`Erro ao carregar leads: ${error.message}`);

  const leads = (leadsData ?? []) as Lead[];
  const proposals = (proposalsData ?? []) as unknown as (Proposal & {
    leads: { name: string } | null;
    clients: { name: string } | null;
  })[];

  const byStage = new Map<LeadStage, Lead[]>(STAGES.map((s) => [s, []]));
  for (const l of leads) byStage.get(l.stage)?.push(l);

  const pipelineValue = proposals
    .filter((p) => p.status === "enviada")
    .reduce((sum, p) => sum + Number(p.value), 0);
  const wonValue = proposals
    .filter((p) => p.status === "aceita")
    .reduce((sum, p) => sum + Number(p.value), 0);
  const activeLeads = leads.filter(
    (l) => l.stage !== "fechado" && l.stage !== "perdido"
  ).length;

  return (
    <>
      <PageHeader
        title="Comercial"
        subtitle="Pipeline de leads e propostas — mover de estágio persiste na hora"
      />

      <div className="mb-6 grid grid-cols-3 gap-3">
        <Stat label="Leads ativos" value={activeLeads} />
        <Stat label="Propostas na rua" value={brl(pipelineValue)} />
        <Stat label="Fechado (aceitas)" value={brl(wonValue)} tone="positive" />
      </div>

      {/* Novo lead */}
      <Card className="mb-6 p-4">
        <form
          action={createLead}
          className="grid grid-cols-2 gap-3 md:grid-cols-12"
        >
          <div className="col-span-2 md:col-span-3">
            <label className={labelCls} htmlFor="nl-name">
              Novo lead
            </label>
            <input
              id="nl-name"
              name="name"
              required
              placeholder="Nome da empresa"
              className={inputCls}
            />
          </div>
          <div className="md:col-span-2">
            <label className={labelCls} htmlFor="nl-seg">
              Segmento
            </label>
            <input
              id="nl-seg"
              name="segment"
              placeholder="ex: móveis"
              className={inputCls}
            />
          </div>
          <div className="md:col-span-2">
            <label className={labelCls} htmlFor="nl-contact">
              Contato
            </label>
            <input
              id="nl-contact"
              name="contact"
              placeholder="WhatsApp/email"
              className={inputCls}
            />
          </div>
          <div className="md:col-span-3">
            <label className={labelCls} htmlFor="nl-next">
              Próxima ação
            </label>
            <input
              id="nl-next"
              name="next_action"
              placeholder="ex: agendar diagnóstico"
              className={inputCls}
            />
          </div>
          <div className="md:col-span-2">
            <label className={labelCls} htmlFor="nl-date">
              Quando
            </label>
            <input
              id="nl-date"
              name="next_action_date"
              type="date"
              className={inputCls}
            />
          </div>
          <div className="col-span-2 flex items-end justify-end md:col-span-12">
            <button type="submit" className={btnPrimary}>
              <Plus size={16} /> Adicionar lead
            </button>
          </div>
        </form>
      </Card>

      {/* Kanban */}
      {leads.length === 0 ? (
        <EmptyState
          title="Pipeline vazio"
          hint="Adicione o primeiro lead no formulário acima."
        />
      ) : (
        <div className="-mx-1 overflow-x-auto pb-2">
          <div className="flex min-w-max gap-3 px-1">
            {STAGES.map((stage) => {
              const col = byStage.get(stage) ?? [];
              const dimmed = stage === "fechado" || stage === "perdido";
              return (
                <div
                  key={stage}
                  className={`w-60 shrink-0 rounded-xl p-2 ${dimmed ? "bg-background" : "bg-graphite-soft/5"} border border-border/70`}
                >
                  <div className="mb-2 flex items-center justify-between px-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                      {LEAD_STAGE_LABEL[stage]}
                    </p>
                    <Badge
                      tone={
                        stage === "fechado"
                          ? "green"
                          : stage === "perdido"
                            ? "danger"
                            : "neutral"
                      }
                    >
                      {col.length}
                    </Badge>
                  </div>
                  <div className={`space-y-2 ${dimmed ? "opacity-70" : ""}`}>
                    {col.map((lead) => (
                      <LeadCard key={lead.id} lead={lead} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Propostas */}
      <section className="mt-10">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted">
          <FileText size={15} className="text-primary" /> Propostas
        </h2>

        <Card className="mb-4 p-4">
          <form
            action={createProposal}
            className="grid grid-cols-2 gap-3 md:grid-cols-12"
          >
            <div className="col-span-2 md:col-span-4">
              <label className={labelCls} htmlFor="np-title">
                Nova proposta
              </label>
              <input
                id="np-title"
                name="title"
                required
                placeholder="ex: Site institucional + blog"
                className={inputCls}
              />
            </div>
            <div className="md:col-span-2">
              <label className={labelCls} htmlFor="np-value">
                Valor (R$)
              </label>
              <input
                id="np-value"
                name="value"
                required
                inputMode="decimal"
                placeholder="4500"
                className={inputCls}
              />
            </div>
            <div className="md:col-span-3">
              <label className={labelCls} htmlFor="np-lead">
                Lead
              </label>
              <select id="np-lead" name="lead_id" className={inputCls}>
                <option value="">— sem lead</option>
                {leads.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className={labelCls} htmlFor="np-status">
                Status
              </label>
              <select
                id="np-status"
                name="status"
                defaultValue="enviada"
                className={inputCls}
              >
                {Object.entries(PROPOSAL_STATUS_LABEL).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-span-2 flex items-end md:col-span-1">
              <button type="submit" className={`${btnSecondary} w-full`}>
                <Plus size={15} />
              </button>
            </div>
          </form>
        </Card>

        {proposals.length === 0 ? (
          <EmptyState title="Nenhuma proposta registrada" />
        ) : (
          <ul className="space-y-2">
            {proposals.map((p) => (
              <li key={p.id}>
                <Card className="flex flex-wrap items-center gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">
                      {p.doc_url ? (
                        <a
                          href={p.doc_url}
                          target="_blank"
                          rel="noreferrer"
                          className="hover:text-primary hover:underline"
                        >
                          {p.title}
                        </a>
                      ) : (
                        p.title
                      )}
                    </p>
                    <p className="text-xs text-muted">
                      {p.clients?.name ?? p.leads?.name ?? "sem vínculo"}
                      {p.sent_at ? ` · enviada em ${dateBR(p.sent_at)}` : ""}
                    </p>
                  </div>
                  <p className="text-base font-black tabular-nums">
                    {brl(Number(p.value))}
                  </p>
                  <Badge tone={PROPOSAL_TONE[p.status]}>
                    {PROPOSAL_STATUS_LABEL[p.status]}
                  </Badge>
                  <form
                    action={updateProposalStatus}
                    className="flex items-center gap-1.5"
                  >
                    <input type="hidden" name="id" value={p.id} />
                    <select
                      name="status"
                      defaultValue={p.status}
                      className={`${inputCls} !w-auto !px-2 !py-1 !text-xs`}
                    >
                      {Object.entries(PROPOSAL_STATUS_LABEL).map(([v, l]) => (
                        <option key={v} value={v}>
                          {l}
                        </option>
                      ))}
                    </select>
                    <button
                      type="submit"
                      aria-label="Atualizar status"
                      className="flex h-7 w-8 items-center justify-center rounded-lg bg-primary text-white hover:bg-primary-dark"
                    >
                      <Check size={14} />
                    </button>
                    <button
                      type="submit"
                      formAction={deleteProposal}
                      aria-label="Excluir proposta"
                      className="rounded-lg p-1.5 text-muted/40 hover:bg-danger-soft hover:text-danger"
                    >
                      <Trash2 size={14} />
                    </button>
                  </form>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
