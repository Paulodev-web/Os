import { Plus, Trash2, Target } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import type { Alimento, DietaMeta, DietaRegistro } from "@/lib/database.types";
import {
  Card,
  PageHeader,
  EmptyState,
  inputCls,
  labelCls,
  btnPrimary,
  btnSecondary,
} from "@/components/ui";
import { num, todayISO } from "@/lib/format";
import {
  deleteItemRegistro,
  deleteRegistro,
  registrarItem,
  salvarMeta,
} from "./actions";

export const dynamic = "force-dynamic";

const REFEICOES_SUGERIDAS = [
  "Café da manhã",
  "Almoço",
  "Lanche",
  "Jantar",
  "Ceia",
];

interface ItemComAlimento {
  id: string;
  registro_id: string;
  quantidade_g: number;
  alimentos: Alimento;
}

function macros(item: ItemComAlimento) {
  const f = Number(item.quantidade_g) / 100;
  return {
    kcal: Number(item.alimentos.kcal_100g) * f,
    prot: Number(item.alimentos.proteina_100g) * f,
    carb: Number(item.alimentos.carbo_100g) * f,
    gord: Number(item.alimentos.gordura_100g) * f,
  };
}

function Barra({
  label,
  atual,
  alvo,
  unidade,
}: {
  label: string;
  atual: number;
  alvo: number | null;
  unidade: string;
}) {
  const pct = alvo && alvo > 0 ? Math.min(100, (atual / alvo) * 100) : 0;
  const estourou = alvo !== null && alvo > 0 && atual > alvo;
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">
          {label}
        </p>
        <p className="text-sm font-black tabular-nums">
          {num(atual)}
          <span className="font-normal text-muted">
            {alvo ? ` / ${num(alvo)}` : ""} {unidade}
          </span>
        </p>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-background">
        <div
          className={`h-full rounded-full transition-all ${estourou ? "bg-warn" : "bg-primary"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default async function DietaPage() {
  const supabase = await createClient();
  const hoje = todayISO();

  const [{ data: metaData }, { data: alimentosData }, { data: registrosData }] =
    await Promise.all([
      supabase
        .from("dieta_metas")
        .select("*")
        .lte("vigente_desde", hoje)
        .order("vigente_desde", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase.from("alimentos").select("*").order("nome"),
      supabase
        .from("dieta_registros")
        .select("*, dieta_registro_itens(*, alimentos(*))")
        .eq("data", hoje)
        .order("created_at"),
    ]);

  const meta = metaData as DietaMeta | null;
  const alimentos = (alimentosData ?? []) as Alimento[];
  const registros = (registrosData ?? []) as unknown as (DietaRegistro & {
    dieta_registro_itens: ItemComAlimento[];
  })[];

  const totais = registros
    .flatMap((r) => r.dieta_registro_itens)
    .reduce(
      (acc, item) => {
        const m = macros(item);
        return {
          kcal: acc.kcal + m.kcal,
          prot: acc.prot + m.prot,
          carb: acc.carb + m.carb,
          gord: acc.gord + m.gord,
        };
      },
      { kcal: 0, prot: 0, carb: 0, gord: 0 }
    );

  return (
    <>
      <PageHeader
        title="Dieta"
        subtitle={`Registro de hoje vs meta vigente${meta ? ` (desde ${meta.vigente_desde.split("-").reverse().join("/")})` : ""}`}
      />

      {/* Progresso do dia */}
      <Card className="mb-6 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted">
            <Target size={15} className="text-primary" /> Hoje vs meta
          </h2>
          <details>
            <summary className="cursor-pointer text-xs font-semibold text-primary hover:underline">
              {meta ? "ajustar meta" : "definir meta"}
            </summary>
            <form
              action={salvarMeta}
              className="mt-2 flex flex-wrap items-end gap-2 rounded-lg border border-border bg-background p-3"
            >
              <div>
                <label className={labelCls}>kcal</label>
                <input
                  name="kcal_alvo"
                  type="number"
                  required
                  min={1}
                  defaultValue={meta?.kcal_alvo ?? 2500}
                  className={`${inputCls} !w-24 !px-2 !py-1 !text-xs`}
                />
              </div>
              <div>
                <label className={labelCls}>Proteína (g)</label>
                <input
                  name="proteina_alvo"
                  type="number"
                  required
                  min={0}
                  defaultValue={meta?.proteina_alvo ?? 180}
                  className={`${inputCls} !w-20 !px-2 !py-1 !text-xs`}
                />
              </div>
              <div>
                <label className={labelCls}>Carbo (g)</label>
                <input
                  name="carbo_alvo"
                  type="number"
                  required
                  min={0}
                  defaultValue={meta?.carbo_alvo ?? 280}
                  className={`${inputCls} !w-20 !px-2 !py-1 !text-xs`}
                />
              </div>
              <div>
                <label className={labelCls}>Gordura (g)</label>
                <input
                  name="gordura_alvo"
                  type="number"
                  required
                  min={0}
                  defaultValue={meta?.gordura_alvo ?? 70}
                  className={`${inputCls} !w-20 !px-2 !py-1 !text-xs`}
                />
              </div>
              <button
                type="submit"
                className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-dark"
              >
                Salvar (vale a partir de hoje)
              </button>
            </form>
          </details>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Barra
            label="Calorias"
            atual={totais.kcal}
            alvo={meta ? Number(meta.kcal_alvo) : null}
            unidade="kcal"
          />
          <Barra
            label="Proteína"
            atual={totais.prot}
            alvo={meta ? Number(meta.proteina_alvo) : null}
            unidade="g"
          />
          <Barra
            label="Carboidrato"
            atual={totais.carb}
            alvo={meta ? Number(meta.carbo_alvo) : null}
            unidade="g"
          />
          <Barra
            label="Gordura"
            atual={totais.gord}
            alvo={meta ? Number(meta.gordura_alvo) : null}
            unidade="g"
          />
        </div>
        {!meta && (
          <p className="mt-3 text-xs text-muted">
            Sem meta definida — as barras ficam completas quando você definir
            os alvos.
          </p>
        )}
      </Card>

      {/* Registrar */}
      <Card className="mb-6 p-4">
        <form
          action={registrarItem}
          className="grid grid-cols-2 gap-3 md:grid-cols-12"
        >
          <div className="md:col-span-3">
            <label className={labelCls} htmlFor="ri-ref">
              Refeição
            </label>
            <input
              id="ri-ref"
              name="refeicao_nome"
              required
              list="refeicoes"
              placeholder="ex: Almoço"
              className={inputCls}
            />
            <datalist id="refeicoes">
              {REFEICOES_SUGERIDAS.map((r) => (
                <option key={r} value={r} />
              ))}
            </datalist>
          </div>
          <div className="col-span-2 md:col-span-4">
            <label className={labelCls} htmlFor="ri-alimento">
              Alimento
            </label>
            <select id="ri-alimento" name="alimento_id" className={inputCls}>
              {alimentos.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nome} ({num(Number(a.kcal_100g))} kcal/100g)
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className={labelCls} htmlFor="ri-qtd">
              Quantidade (g)
            </label>
            <input
              id="ri-qtd"
              name="quantidade_g"
              required
              inputMode="decimal"
              placeholder="150"
              className={inputCls}
            />
          </div>
          <input type="hidden" name="data" value={hoje} />
          <div className="col-span-2 flex items-end md:col-span-3">
            <button type="submit" className={`${btnPrimary} w-full`}>
              <Plus size={16} /> Registrar
            </button>
          </div>
        </form>
      </Card>

      {/* Refeições de hoje */}
      {registros.length === 0 ? (
        <EmptyState
          title="Nada registrado hoje"
          hint="Registre a primeira refeição acima — o coach usa esses dados de verdade."
        />
      ) : (
        <div className="space-y-3">
          {registros.map((r) => {
            const itens = r.dieta_registro_itens;
            const totalRef = itens.reduce((s, i) => s + macros(i).kcal, 0);
            return (
              <Card key={r.id} className="p-4">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-semibold">{r.refeicao_nome}</h3>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-black tabular-nums">
                      {num(totalRef)} kcal
                    </span>
                    <form action={deleteRegistro}>
                      <input type="hidden" name="id" value={r.id} />
                      <button
                        type="submit"
                        aria-label="Excluir refeição"
                        className="rounded p-1 text-muted/40 hover:bg-danger-soft hover:text-danger"
                      >
                        <Trash2 size={14} />
                      </button>
                    </form>
                  </div>
                </div>
                <ul className="mt-2 divide-y divide-border">
                  {itens.map((i) => {
                    const m = macros(i);
                    return (
                      <li
                        key={i.id}
                        className="flex items-center gap-3 py-1.5 text-sm"
                      >
                        <span className="min-w-0 flex-1 font-semibold">
                          {i.alimentos.nome}
                        </span>
                        <span className="tabular-nums text-muted">
                          {num(Number(i.quantidade_g))}g
                        </span>
                        <span className="w-40 text-right text-xs tabular-nums text-muted">
                          {num(m.kcal)} kcal · P{num(m.prot)} C{num(m.carb)} G
                          {num(m.gord)}
                        </span>
                        <form action={deleteItemRegistro}>
                          <input type="hidden" name="id" value={i.id} />
                          <button
                            type="submit"
                            aria-label="Excluir item"
                            className="rounded p-1 text-muted/40 hover:bg-danger-soft hover:text-danger"
                          >
                            <Trash2 size={12} />
                          </button>
                        </form>
                      </li>
                    );
                  })}
                </ul>

                {/* adicionar item nesta refeição */}
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs font-semibold text-primary hover:underline">
                    + adicionar alimento
                  </summary>
                  <form
                    action={registrarItem}
                    className="mt-2 flex flex-wrap items-end gap-2"
                  >
                    <input type="hidden" name="data" value={hoje} />
                    <input
                      type="hidden"
                      name="refeicao_nome"
                      value={r.refeicao_nome}
                    />
                    <select
                      name="alimento_id"
                      className={`${inputCls} !w-auto flex-1 !py-1.5 !text-xs`}
                    >
                      {alimentos.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.nome}
                        </option>
                      ))}
                    </select>
                    <input
                      name="quantidade_g"
                      required
                      inputMode="decimal"
                      placeholder="g"
                      className={`${inputCls} !w-20 !px-2 !py-1.5 !text-xs`}
                    />
                    <button type="submit" className={btnSecondary}>
                      <Plus size={13} />
                    </button>
                  </form>
                </details>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
