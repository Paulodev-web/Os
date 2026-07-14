import { createClient } from "@/lib/supabase/server";
import type { FinanceEntry } from "@/lib/database.types";
import { PageHeader, Stat } from "@/components/ui";
import {
  EntriesList,
  EntryForm,
  MonthNav,
  mesValido,
  rangeDoMes,
  somaResumo,
} from "@/components/finance";
import { brl } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function FinanceiroDevpauloPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  const { mes: mesParam } = await searchParams;
  const mes = mesValido(mesParam);
  const { inicio, fim } = rangeDoMes(mes);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("finance_entries")
    .select("*")
    .eq("origin", "devpaulo")
    .gte("date", inicio)
    .lt("date", fim)
    .order("date", { ascending: false });

  if (error) throw new Error(`Erro ao carregar financeiro: ${error.message}`);
  const entries = (data ?? []) as FinanceEntry[];
  const resumo = somaResumo(entries);

  return (
    <>
      <PageHeader
        title="Financeiro — devpaulo"
        subtitle="Caixa do estúdio (transferências pro pessoal aparecem como saída)"
        action={<MonthNav basePath="/financeiro" mes={mes} />}
      />

      <div className="mb-6 grid grid-cols-3 gap-3">
        <Stat label="Entradas" value={brl(resumo.entradas)} tone="positive" />
        <Stat label="Saídas" value={brl(resumo.saidas)} tone="negative" />
        <Stat
          label="Saldo do mês"
          value={brl(resumo.saldo)}
          tone={resumo.saldo >= 0 ? "positive" : "negative"}
        />
      </div>

      <EntryForm origins={["devpaulo"]} defaultOrigin="devpaulo" />
      <EntriesList entries={entries} />
    </>
  );
}
