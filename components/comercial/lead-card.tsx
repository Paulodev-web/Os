import { Check, Trash2, Pencil, Plus } from "lucide-react";
import type { Lead, LeadStage, Proposal } from "@/lib/database.types";
import { Card, Badge, inputCls } from "@/components/ui";
import { LEAD_STAGE_LABEL } from "@/lib/labels";
import { brl, dateBR, isOverdue } from "@/lib/format";
import {
  moveLeadStage,
  updateLead,
  deleteLead,
  createProposal,
  updateProposalStatus,
  deleteProposal,
} from "@/app/(painel)/comercial/actions";

const STAGES: LeadStage[] = [
  "novo",
  "diagnostico_agendado",
  "proposta_enviada",
  "follow_up",
  "fechado",
  "perdido",
];

export const PROPOSAL_STATUS_LABEL: Record<string, string> = {
  rascunho: "Rascunho",
  enviada: "Enviada",
  aceita: "Aceita",
  recusada: "Recusada",
};

export const PROPOSAL_TONE = {
  rascunho: "neutral",
  enviada: "info",
  aceita: "green",
  recusada: "danger",
} as const;

function ProposalRow({ proposal }: { proposal: Proposal }) {
  return (
    <li className="flex flex-wrap items-center gap-1.5 rounded-lg border border-border bg-background px-2 py-1 text-xs">
      <span className="min-w-0 flex-1 truncate font-semibold">
        {proposal.doc_url ? (
          <a
            href={proposal.doc_url}
            target="_blank"
            rel="noreferrer"
            className="hover:text-primary hover:underline"
          >
            {proposal.title}
          </a>
        ) : (
          proposal.title
        )}
      </span>
      <span className="font-black tabular-nums">
        {brl(Number(proposal.value))}
      </span>
      <form action={updateProposalStatus} className="flex items-center gap-1">
        <input type="hidden" name="id" value={proposal.id} />
        <select
          name="status"
          defaultValue={proposal.status}
          className="rounded border border-border bg-white px-1 py-0.5 text-[11px]"
        >
          {Object.entries(PROPOSAL_STATUS_LABEL).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <button
          type="submit"
          aria-label="Atualizar status da proposta"
          className="rounded p-0.5 text-muted/50 hover:text-primary"
        >
          <Check size={11} />
        </button>
        <button
          type="submit"
          formAction={deleteProposal}
          aria-label="Excluir proposta"
          className="rounded p-0.5 text-muted/40 hover:text-danger"
        >
          <Trash2 size={11} />
        </button>
      </form>
    </li>
  );
}

export function LeadCard({
  lead,
  proposals,
}: {
  lead: Lead;
  proposals: Proposal[];
}) {
  const overdue = isOverdue(lead.next_action_date);
  const totalValue = proposals.reduce((sum, p) => sum + Number(p.value), 0);

  return (
    <Card className="p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 flex-1 font-semibold leading-snug">
          {lead.name}
        </p>
        {proposals.length > 0 && (
          <Badge tone="neutral" className="shrink-0 whitespace-nowrap">
            {brl(totalValue)}
          </Badge>
        )}
      </div>
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

      {/* propostas vinculadas a este lead — antes viviam soltas numa lista separada */}
      {proposals.length > 0 && (
        <ul className="mt-2 space-y-1">
          {proposals.map((p) => (
            <ProposalRow key={p.id} proposal={p} />
          ))}
        </ul>
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

      {/* nova proposta + editar lead */}
      <details className="mt-2">
        <summary className="cursor-pointer text-xs font-semibold text-muted hover:text-primary">
          <Pencil size={11} className="mr-1 inline" />
          editar / nova proposta
        </summary>

        <form
          action={createProposal}
          className="mt-2 flex items-end gap-1.5 border-b border-border pb-2"
        >
          <input type="hidden" name="lead_id" value={lead.id} />
          <input
            name="title"
            required
            placeholder="Nova proposta — título"
            className={`${inputCls} !px-2 !py-1 !text-xs`}
          />
          <input
            name="value"
            required
            inputMode="decimal"
            placeholder="R$"
            className={`${inputCls} !w-20 !px-2 !py-1 !text-xs`}
          />
          <button
            type="submit"
            aria-label="Adicionar proposta"
            className="flex h-7 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-white hover:bg-primary-dark"
          >
            <Plus size={14} />
          </button>
        </form>

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
