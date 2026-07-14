import Link from "next/link";
import { Plus, Play, Pencil, Trash2, Scale, Dumbbell } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import type {
  Exercicio,
  FichaItem,
  TreinoDia,
  TreinoPlano,
  TreinoSessao,
} from "@/lib/database.types";
import {
  Card,
  PageHeader,
  Badge,
  EmptyState,
  inputCls,
  labelCls,
  btnPrimary,
  btnSecondary,
} from "@/components/ui";
import { dateBR, num, todayISO } from "@/lib/format";
import {
  addFichaItem,
  createDia,
  createPlano,
  createSessao,
  registrarPeso,
  removerFichaItem,
  substituirFichaItem,
} from "./actions";

export const dynamic = "force-dynamic";

export default async function TreinoPage() {
  const supabase = await createClient();

  const [
    { data: planoData },
    { data: exerciciosData },
    { data: sessoesData },
    { data: metricsData },
  ] = await Promise.all([
    supabase
      .from("treino_planos")
      .select("*")
      .eq("ativo", true)
      .maybeSingle(),
    supabase.from("exercicios").select("*").order("nome"),
    supabase
      .from("treino_sessoes")
      .select("*, treino_dias(nome)")
      .order("data", { ascending: false })
      .limit(10),
    supabase
      .from("body_metrics")
      .select("*")
      .order("data", { ascending: false })
      .limit(5),
  ]);

  const plano = planoData as TreinoPlano | null;
  const exercicios = (exerciciosData ?? []) as Exercicio[];
  const sessoes = (sessoesData ?? []) as unknown as (TreinoSessao & {
    treino_dias: { nome: string } | null;
  })[];
  const metrics = (metricsData ?? []) as {
    id: string;
    data: string;
    peso: number;
    percentual_gordura: number | null;
  }[];

  let dias: TreinoDia[] = [];
  let itensPorDia = new Map<string, (FichaItem & { exercicios: Exercicio })[]>();
  if (plano) {
    const { data: diasData } = await supabase
      .from("treino_dias")
      .select("*")
      .eq("plano_id", plano.id)
      .order("ordem");
    dias = (diasData ?? []) as TreinoDia[];

    if (dias.length > 0) {
      const { data: itensData } = await supabase
        .from("treino_ficha_itens")
        .select("*, exercicios(*)")
        .in(
          "dia_id",
          dias.map((d) => d.id)
        )
        .eq("ativo", true)
        .order("ordem");
      const itens = (itensData ?? []) as unknown as (FichaItem & {
        exercicios: Exercicio;
      })[];
      itensPorDia = new Map();
      for (const i of itens) {
        itensPorDia.set(i.dia_id, [...(itensPorDia.get(i.dia_id) ?? []), i]);
      }
    }
  }

  const exercicioOptions = exercicios.map((e) => (
    <option key={e.id} value={e.id}>
      {e.nome}
    </option>
  ));

  return (
    <>
      <PageHeader
        title="Treino"
        subtitle={
          plano
            ? `Plano ativo: ${plano.nome}${plano.frequencia_semanal_alvo ? ` · alvo ${plano.frequencia_semanal_alvo}x/semana` : ""}`
            : "Nenhum plano ativo — crie um abaixo"
        }
      />

      {/* Iniciar sessão */}
      <Card className="mb-6 p-4">
        <form
          action={createSessao}
          className="grid grid-cols-2 gap-3 md:grid-cols-12"
        >
          <div className="md:col-span-3">
            <label className={labelCls} htmlFor="ns-data">
              Registrar treino
            </label>
            <input
              id="ns-data"
              name="data"
              type="date"
              defaultValue={todayISO()}
              className={inputCls}
            />
          </div>
          <div className="md:col-span-3">
            <label className={labelCls} htmlFor="ns-dia">
              Dia do plano
            </label>
            <select id="ns-dia" name="dia_id" className={inputCls}>
              <option value="">— treino livre</option>
              {dias.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.nome}
                </option>
              ))}
            </select>
          </div>
          <div className="col-span-2 md:col-span-4">
            <label className={labelCls} htmlFor="ns-obs">
              Observações
            </label>
            <input
              id="ns-obs"
              name="observacoes"
              placeholder="opcional"
              className={inputCls}
            />
          </div>
          <div className="flex items-end md:col-span-2">
            <button type="submit" className={`${btnPrimary} w-full`}>
              <Play size={15} /> Iniciar
            </button>
          </div>
        </form>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {/* Plano / ficha */}
          {!plano ? (
            <Card className="p-5">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted">
                <Dumbbell size={15} className="text-primary" /> Criar plano de
                treino
              </h2>
              <form action={createPlano} className="flex flex-wrap gap-3">
                <input
                  name="nome"
                  required
                  placeholder="ex: ABC hipertrofia"
                  className={`${inputCls} !w-56`}
                />
                <input
                  name="frequencia"
                  type="number"
                  min={1}
                  max={7}
                  placeholder="x/semana"
                  className={`${inputCls} !w-28`}
                />
                <button type="submit" className={btnPrimary}>
                  <Plus size={15} /> Criar
                </button>
              </form>
            </Card>
          ) : (
            <>
              {dias.length === 0 && (
                <EmptyState
                  title="Plano sem dias ainda"
                  hint="Adicione o primeiro dia (ex: A — Peito/Tríceps) abaixo."
                />
              )}
              <div className="space-y-4">
                {dias.map((dia) => {
                  const itens = itensPorDia.get(dia.id) ?? [];
                  return (
                    <Card key={dia.id} className="p-4">
                      <h3 className="font-black tracking-tight">{dia.nome}</h3>
                      {itens.length === 0 ? (
                        <p className="mt-2 text-sm text-muted">
                          Sem exercícios na ficha.
                        </p>
                      ) : (
                        <ul className="mt-3 divide-y divide-border">
                          {itens.map((item) => (
                            <li key={item.id} className="py-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="min-w-0 flex-1 text-sm font-semibold">
                                  {item.exercicios.nome}
                                </p>
                                <span className="text-sm tabular-nums text-muted">
                                  {item.series_alvo}×
                                  {item.reps_alvo_min && item.reps_alvo_max
                                    ? `${item.reps_alvo_min}–${item.reps_alvo_max}`
                                    : (item.reps_alvo_min ??
                                      item.reps_alvo_max ??
                                      "?")}
                                  {item.carga_alvo
                                    ? ` · ${num(Number(item.carga_alvo), 1)} kg`
                                    : ""}
                                </span>
                                <details className="relative">
                                  <summary className="cursor-pointer rounded-lg p-1 text-muted hover:bg-background hover:text-foreground">
                                    <Pencil size={13} />
                                  </summary>
                                  <form
                                    action={substituirFichaItem}
                                    className="mt-2 flex flex-wrap items-end gap-2 rounded-lg border border-border bg-background p-2"
                                  >
                                    <input
                                      type="hidden"
                                      name="item_id"
                                      value={item.id}
                                    />
                                    <div>
                                      <label className={labelCls}>Séries</label>
                                      <input
                                        name="series_alvo"
                                        type="number"
                                        min={1}
                                        defaultValue={item.series_alvo}
                                        className={`${inputCls} !w-16 !px-2 !py-1 !text-xs`}
                                      />
                                    </div>
                                    <div>
                                      <label className={labelCls}>
                                        Reps min
                                      </label>
                                      <input
                                        name="reps_alvo_min"
                                        type="number"
                                        min={1}
                                        defaultValue={item.reps_alvo_min ?? ""}
                                        className={`${inputCls} !w-16 !px-2 !py-1 !text-xs`}
                                      />
                                    </div>
                                    <div>
                                      <label className={labelCls}>
                                        Reps max
                                      </label>
                                      <input
                                        name="reps_alvo_max"
                                        type="number"
                                        min={1}
                                        defaultValue={item.reps_alvo_max ?? ""}
                                        className={`${inputCls} !w-16 !px-2 !py-1 !text-xs`}
                                      />
                                    </div>
                                    <div>
                                      <label className={labelCls}>
                                        Carga (kg)
                                      </label>
                                      <input
                                        name="carga_alvo"
                                        defaultValue={
                                          item.carga_alvo
                                            ? String(item.carga_alvo)
                                            : ""
                                        }
                                        className={`${inputCls} !w-20 !px-2 !py-1 !text-xs`}
                                      />
                                    </div>
                                    <button
                                      type="submit"
                                      className="rounded-lg bg-primary px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-primary-dark"
                                    >
                                      Salvar nova versão
                                    </button>
                                    <button
                                      type="submit"
                                      formAction={removerFichaItem}
                                      className="rounded-lg p-1.5 text-muted/60 hover:bg-danger-soft hover:text-danger"
                                      aria-label="Remover da ficha"
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  </form>
                                </details>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}

                      {/* adicionar exercício */}
                      <details className="mt-3">
                        <summary className="cursor-pointer text-xs font-semibold text-primary hover:underline">
                          + adicionar exercício
                        </summary>
                        <form
                          action={addFichaItem}
                          className="mt-2 flex flex-wrap items-end gap-2"
                        >
                          <input type="hidden" name="dia_id" value={dia.id} />
                          <div className="min-w-44 flex-1">
                            <label className={labelCls}>Exercício</label>
                            <select
                              name="exercicio_id"
                              required
                              className={`${inputCls} !py-1.5 !text-xs`}
                            >
                              {exercicioOptions}
                            </select>
                          </div>
                          <div>
                            <label className={labelCls}>Séries</label>
                            <input
                              name="series_alvo"
                              type="number"
                              min={1}
                              defaultValue={3}
                              className={`${inputCls} !w-16 !px-2 !py-1.5 !text-xs`}
                            />
                          </div>
                          <div>
                            <label className={labelCls}>Reps min</label>
                            <input
                              name="reps_alvo_min"
                              type="number"
                              min={1}
                              defaultValue={8}
                              className={`${inputCls} !w-16 !px-2 !py-1.5 !text-xs`}
                            />
                          </div>
                          <div>
                            <label className={labelCls}>Reps max</label>
                            <input
                              name="reps_alvo_max"
                              type="number"
                              min={1}
                              defaultValue={12}
                              className={`${inputCls} !w-16 !px-2 !py-1.5 !text-xs`}
                            />
                          </div>
                          <div>
                            <label className={labelCls}>Carga (kg)</label>
                            <input
                              name="carga_alvo"
                              placeholder="—"
                              className={`${inputCls} !w-20 !px-2 !py-1.5 !text-xs`}
                            />
                          </div>
                          <div>
                            <label className={labelCls}>Ordem</label>
                            <input
                              name="ordem"
                              type="number"
                              defaultValue={itens.length + 1}
                              className={`${inputCls} !w-16 !px-2 !py-1.5 !text-xs`}
                            />
                          </div>
                          <button type="submit" className={btnSecondary}>
                            <Plus size={14} />
                          </button>
                        </form>
                      </details>
                    </Card>
                  );
                })}
              </div>

              {/* novo dia */}
              <Card className="mt-4 p-4">
                <form
                  action={createDia}
                  className="flex flex-wrap items-end gap-3"
                >
                  <input type="hidden" name="plano_id" value={plano.id} />
                  <div className="min-w-52 flex-1">
                    <label className={labelCls} htmlFor="nd-nome">
                      Novo dia do plano
                    </label>
                    <input
                      id="nd-nome"
                      name="nome"
                      required
                      placeholder="ex: A — Peito/Tríceps"
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls} htmlFor="nd-ordem">
                      Ordem
                    </label>
                    <input
                      id="nd-ordem"
                      name="ordem"
                      type="number"
                      defaultValue={dias.length + 1}
                      className={`${inputCls} !w-20`}
                    />
                  </div>
                  <button type="submit" className={btnSecondary}>
                    <Plus size={15} /> Adicionar dia
                  </button>
                </form>
              </Card>
            </>
          )}
        </div>

        {/* Coluna lateral: histórico + peso */}
        <div className="space-y-6">
          <section>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">
              Últimas sessões
            </h2>
            {sessoes.length === 0 ? (
              <Card className="p-4 text-sm text-muted">
                Nenhuma sessão registrada.
              </Card>
            ) : (
              <ul className="space-y-2">
                {sessoes.map((s) => (
                  <li key={s.id}>
                    <Link href={`/treino/sessao/${s.id}`}>
                      <Card className="flex items-center justify-between gap-2 p-3 transition hover:border-primary/40">
                        <div>
                          <p className="text-sm font-semibold">
                            {dateBR(s.data)}
                          </p>
                          <p className="text-xs text-muted">
                            {s.treino_dias?.nome ?? "treino livre"}
                          </p>
                        </div>
                        <Badge tone="green">ver</Badge>
                      </Card>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-muted">
              <Scale size={14} /> Peso corporal
            </h2>
            <Card className="p-3">
              <form
                action={registrarPeso}
                className="flex flex-wrap items-end gap-2"
              >
                <div>
                  <label className={labelCls}>Data</label>
                  <input
                    name="data"
                    type="date"
                    defaultValue={todayISO()}
                    className={`${inputCls} !px-2 !py-1 !text-xs`}
                  />
                </div>
                <div>
                  <label className={labelCls}>Peso (kg)</label>
                  <input
                    name="peso"
                    required
                    inputMode="decimal"
                    placeholder="82,5"
                    className={`${inputCls} !w-20 !px-2 !py-1 !text-xs`}
                  />
                </div>
                <div>
                  <label className={labelCls}>% gordura</label>
                  <input
                    name="percentual_gordura"
                    inputMode="decimal"
                    placeholder="—"
                    className={`${inputCls} !w-16 !px-2 !py-1 !text-xs`}
                  />
                </div>
                <button
                  type="submit"
                  className="rounded-lg bg-primary px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-primary-dark"
                >
                  Salvar
                </button>
              </form>
              {metrics.length > 0 && (
                <ul className="mt-3 space-y-1 border-t border-border pt-2 text-xs text-muted">
                  {metrics.map((m) => (
                    <li key={m.id} className="flex justify-between">
                      <span>{dateBR(m.data)}</span>
                      <span className="font-semibold tabular-nums text-foreground">
                        {num(Number(m.peso), 1)} kg
                        {m.percentual_gordura
                          ? ` · ${num(Number(m.percentual_gordura), 1)}%`
                          : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </section>
        </div>
      </div>
    </>
  );
}
