import { ArrowLeftRight, AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import type { FinanceEntry } from "@/lib/database.types";
import {
  Card,
  PageHeader,
  Stat,
  inputCls,
  labelCls,
  btnSecondary,
} from "@/components/ui";
import {
  EntriesList,
  EntryForm,
  MonthNav,
  mesValido,
  rangeDoMes,
  somaResumo,
} from "@/components/finance";
import { brl, todayISO } from "@/lib/format";
import { createTransfer } from "../actions";

export const dynamic = "force-dynamic";

export default async function ConsolidadoPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; erro?: string }>;
}) {
  const { mes: mesParam, erro } = await searchParams;
  const mes = mesValido(mesParam);
  const { inicio, fim } = rangeDoMes(mes);

  const supabase = await createClient();
  // Regra de negócio: consolidado = devpaulo + pessoal. iService NUNCA entra.
  const { data, error } = await supabase
    .from("finance_entries")
    .select("*")
    .in("origin", ["devpaulo", "pessoal"])
    .gte("date", inicio)
    .lt("date", fim)
    .order("date", { ascending: false });

  if (error) throw new Error(`Erro ao carregar consolidado: ${error.message}`);
  const entries = (data ?? []) as FinanceEntry[];
  const resumo = somaResumo(entries, { excluirTransfer: true });
  const transferencias = entries.filter(
    (e) => e.transfer_group_id && e.type === "saida"
  );

  return (
    <>
      <PageHeader
        title="Consolidado — devpaulo + Pessoal"
        subtitle="Transferências internas andam em par e não contam como receita/despesa. iService fica fora daqui."
        action={<MonthNav basePath="/financeiro/consolidado" mes={mes} />}
      />

      {erro && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-danger/30 bg-danger-soft px-4 py-3 text-sm font-semibold text-danger">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          {erro}
        </div>
      )}

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Entradas" value={brl(resumo.entradas)} tone="positive" />
        <Stat label="Saídas" value={brl(resumo.saidas)} tone="negative" />
        <Stat
          label="Saldo do mês"
          value={brl(resumo.saldo)}
          tone={resumo.saldo >= 0 ? "positive" : "negative"}
        />
        <Stat
          label="Transferido no mês"
          value={brl(
            transferencias.reduce((s, e) => s + Number(e.amount), 0)
          )}
        />
      </div>

      {/* Transferência em par */}
      <Card className="mb-6 border-info/30 p-4">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted">
          <ArrowLeftRight size={15} className="text-info" /> Transferência
          devpaulo ↔ pessoal
        </h2>
        <form
          action={createTransfer}
          className="grid grid-cols-2 gap-3 md:grid-cols-12"
        >
          <div className="md:col-span-2">
            <label className={labelCls} htmlFor="tr-from">
              De
            </label>
            <select id="tr-from" name="from" className={inputCls}>
              <option value="devpaulo">devpaulo</option>
              <option value="pessoal">Pessoal</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label className={labelCls} htmlFor="tr-to">
              Para
            </label>
            <select
              id="tr-to"
              name="to"
              defaultValue="pessoal"
              className={inputCls}
            >
              <option value="devpaulo">devpaulo</option>
              <option value="pessoal">Pessoal</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label className={labelCls} htmlFor="tr-amount">
              Valor (R$)
            </label>
            <input
              id="tr-amount"
              name="amount"
              required
              inputMode="decimal"
              placeholder="3000"
              className={inputCls}
            />
          </div>
          <div className="md:col-span-2">
            <label className={labelCls} htmlFor="tr-date">
              Data
            </label>
            <input
              id="tr-date"
              name="date"
              type="date"
              defaultValue={todayISO()}
              className={inputCls}
            />
          </div>
          <div className="col-span-2 md:col-span-2">
            <label className={labelCls} htmlFor="tr-desc">
              Descrição
            </label>
            <input
              id="tr-desc"
              name="description"
              placeholder="ex: pró-labore"
              className={inputCls}
            />
          </div>
          <div className="col-span-2 flex items-end md:col-span-2">
            <button type="submit" className={`${btnSecondary} w-full`}>
              <ArrowLeftRight size={15} /> Transferir
            </button>
          </div>
        </form>
        <p className="mt-2 text-xs text-muted">
          Cria as duas pernas de uma vez (saída na origem + entrada no
          destino, mesmo grupo). Excluir uma perna remove o par inteiro.
        </p>
      </Card>

      <EntryForm origins={["devpaulo", "pessoal"]} defaultOrigin="pessoal" />
      <EntriesList entries={entries} showOrigin />
    </>
  );
}
