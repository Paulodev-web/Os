import Link from "next/link";
import {
  Plus,
  Trash2,
  ArrowLeftRight,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import type { FinanceEntry, FinanceOrigin } from "@/lib/database.types";
import {
  Card,
  Badge,
  EmptyState,
  inputCls,
  labelCls,
  btnPrimary,
} from "@/components/ui";
import { brl, dateBR, todayISO } from "@/lib/format";
import { createEntry, deleteEntry } from "@/app/(painel)/financeiro/actions";

/* Blocos compartilhados das 3 telas de financeiro
   (devpaulo / consolidado / iService — esta última sempre isolada). */

export const CATEGORIAS_POR_ORIGEM: Record<FinanceOrigin, string[]> = {
  devpaulo: [
    "projeto",
    "recorrência",
    "infra",
    "ferramentas",
    "impostos",
    "pró-labore",
    "outros",
  ],
  pessoal: [
    "pró-labore",
    "mercado",
    "moradia",
    "transporte",
    "saúde",
    "academia",
    "lazer",
    "outros",
  ],
  iservice: ["aporte", "infra", "ferramentas", "marketing", "outros"],
};

export const ORIGIN_LABEL: Record<FinanceOrigin, string> = {
  devpaulo: "devpaulo",
  pessoal: "Pessoal",
  iservice: "iService",
};

/** mês atual em YYYY-MM (fuso de SP) */
export function mesAtual(): string {
  return todayISO().slice(0, 7);
}

export function mesValido(mes: string | undefined): string {
  return mes && /^\d{4}-(0[1-9]|1[0-2])$/.test(mes) ? mes : mesAtual();
}

/** [início, fim) do mês para filtro de data */
export function rangeDoMes(mes: string): { inicio: string; fim: string } {
  const [y, m] = mes.split("-").map(Number);
  const proximo =
    m === 12
      ? `${y + 1}-01-01`
      : `${y}-${String(m + 1).padStart(2, "0")}-01`;
  return { inicio: `${mes}-01`, fim: proximo };
}

export function mesLabel(mes: string): string {
  const [y, m] = mes.split("-").map(Number);
  const nomes = [
    "janeiro",
    "fevereiro",
    "março",
    "abril",
    "maio",
    "junho",
    "julho",
    "agosto",
    "setembro",
    "outubro",
    "novembro",
    "dezembro",
  ];
  return `${nomes[m - 1]} de ${y}`;
}

function mesVizinho(mes: string, delta: number): string {
  const [y, m] = mes.split("-").map(Number);
  const total = y * 12 + (m - 1) + delta;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return `${ny}-${String(nm).padStart(2, "0")}`;
}

export function MonthNav({ basePath, mes }: { basePath: string; mes: string }) {
  return (
    <div className="flex items-center gap-1 rounded-lg border border-border bg-surface px-1 py-1">
      <Link
        href={`${basePath}?mes=${mesVizinho(mes, -1)}`}
        aria-label="Mês anterior"
        className="rounded-md p-1.5 text-muted hover:bg-background hover:text-foreground"
      >
        <ChevronLeft size={15} />
      </Link>
      <span className="min-w-32 text-center text-sm font-semibold capitalize">
        {mesLabel(mes)}
      </span>
      <Link
        href={`${basePath}?mes=${mesVizinho(mes, 1)}`}
        aria-label="Próximo mês"
        className="rounded-md p-1.5 text-muted hover:bg-background hover:text-foreground"
      >
        <ChevronRight size={15} />
      </Link>
    </div>
  );
}

export function EntryForm({
  origins,
  defaultOrigin,
}: {
  origins: FinanceOrigin[];
  defaultOrigin: FinanceOrigin;
}) {
  const categorias = [...new Set(origins.flatMap((o) => CATEGORIAS_POR_ORIGEM[o]))];
  return (
    <Card className="mb-6 p-4">
      <form
        action={createEntry}
        className="grid grid-cols-2 gap-3 md:grid-cols-12"
      >
        {origins.length > 1 ? (
          <div className="md:col-span-2">
            <label className={labelCls} htmlFor="fe-origin">
              Origem
            </label>
            <select
              id="fe-origin"
              name="origin"
              defaultValue={defaultOrigin}
              className={inputCls}
            >
              {origins.map((o) => (
                <option key={o} value={o}>
                  {ORIGIN_LABEL[o]}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <input type="hidden" name="origin" value={origins[0]} />
        )}
        <div className="md:col-span-2">
          <label className={labelCls} htmlFor="fe-type">
            Tipo
          </label>
          <select id="fe-type" name="type" className={inputCls}>
            <option value="entrada">Entrada</option>
            <option value="saida">Saída</option>
          </select>
        </div>
        <div className="md:col-span-2">
          <label className={labelCls} htmlFor="fe-cat">
            Categoria
          </label>
          <input
            id="fe-cat"
            name="category"
            required
            list="fe-categorias"
            placeholder="ex: projeto"
            className={inputCls}
          />
          <datalist id="fe-categorias">
            {categorias.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>
        <div
          className={`col-span-2 ${origins.length > 1 ? "md:col-span-3" : "md:col-span-4"}`}
        >
          <label className={labelCls} htmlFor="fe-desc">
            Descrição
          </label>
          <input
            id="fe-desc"
            name="description"
            placeholder="opcional"
            className={inputCls}
          />
        </div>
        <div className="md:col-span-2">
          <label className={labelCls} htmlFor="fe-amount">
            Valor (R$)
          </label>
          <input
            id="fe-amount"
            name="amount"
            required
            inputMode="decimal"
            placeholder="1500"
            className={inputCls}
          />
        </div>
        <div className={origins.length > 1 ? "md:col-span-2" : "md:col-span-2"}>
          <label className={labelCls} htmlFor="fe-date">
            Data
          </label>
          <input
            id="fe-date"
            name="date"
            type="date"
            defaultValue={todayISO()}
            className={inputCls}
          />
        </div>
        <div
          className={`col-span-2 flex items-end ${origins.length > 1 ? "md:col-span-11 md:justify-end" : "md:col-span-12 md:justify-end"}`}
        >
          <button type="submit" className={btnPrimary}>
            <Plus size={16} /> Lançar
          </button>
        </div>
      </form>
    </Card>
  );
}

export function EntriesList({
  entries,
  showOrigin = false,
}: {
  entries: FinanceEntry[];
  showOrigin?: boolean;
}) {
  if (entries.length === 0) {
    return (
      <EmptyState
        title="Nenhum lançamento neste mês"
        hint="Use o formulário acima pra registrar entradas e saídas."
      />
    );
  }
  return (
    <ul className="space-y-2">
      {entries.map((e) => (
        <li key={e.id}>
          <Card className="flex flex-wrap items-center gap-3 p-3">
            <span
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-black ${
                e.type === "entrada"
                  ? "bg-primary-soft text-primary-dark"
                  : "bg-danger-soft text-danger"
              }`}
            >
              {e.type === "entrada" ? "+" : "−"}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">
                {e.description || e.category}
              </p>
              <p className="text-xs text-muted">
                {dateBR(e.date)} · {e.category}
              </p>
            </div>
            {e.transfer_group_id && (
              <Badge tone="info">
                <ArrowLeftRight size={11} /> transferência
              </Badge>
            )}
            {showOrigin && (
              <Badge tone={e.origin === "devpaulo" ? "green" : "graphite"}>
                {ORIGIN_LABEL[e.origin]}
              </Badge>
            )}
            <p
              className={`text-sm font-black tabular-nums ${
                e.type === "entrada" ? "text-primary-dark" : "text-danger"
              }`}
            >
              {e.type === "entrada" ? "+" : "−"}
              {brl(Number(e.amount))}
            </p>
            <form action={deleteEntry}>
              <input type="hidden" name="id" value={e.id} />
              <button
                type="submit"
                aria-label={
                  e.transfer_group_id
                    ? "Excluir transferência (par inteiro)"
                    : "Excluir lançamento"
                }
                title={
                  e.transfer_group_id
                    ? "Exclui as duas pernas da transferência"
                    : undefined
                }
                className="rounded p-1.5 text-muted/40 hover:bg-danger-soft hover:text-danger"
              >
                <Trash2 size={14} />
              </button>
            </form>
          </Card>
        </li>
      ))}
    </ul>
  );
}

export function somaResumo(
  entries: FinanceEntry[],
  opts: { excluirTransfer?: boolean } = {}
) {
  // Na visão consolidada as transferências internas se anulam (par) e não
  // são receita nem despesa — ficam fora do resumo. Na visão de uma origem
  // só, a perna é movimento real de caixa (ex: pró-labore saindo da devpaulo).
  const base = opts.excluirTransfer
    ? entries.filter((e) => !e.transfer_group_id)
    : entries;
  const entradas = base
    .filter((e) => e.type === "entrada")
    .reduce((s, e) => s + Number(e.amount), 0);
  const saidas = base
    .filter((e) => e.type === "saida")
    .reduce((s, e) => s + Number(e.amount), 0);
  return { entradas, saidas, saldo: entradas - saidas };
}
