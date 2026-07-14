import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import type {
  Exercicio,
  FichaItem,
  SerieRegistrada,
  TreinoSessao,
} from "@/lib/database.types";
import {
  Card,
  PageHeader,
  Badge,
  inputCls,
  labelCls,
  btnGhost,
  btnSecondary,
} from "@/components/ui";
import { dateBR, num } from "@/lib/format";
import { deleteSerie, deleteSessao, registrarSerie } from "../../actions";

export const dynamic = "force-dynamic";

export default async function SessaoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: sessaoData } = await supabase
    .from("treino_sessoes")
    .select("*, treino_dias(nome)")
    .eq("id", id)
    .maybeSingle();
  if (!sessaoData) notFound();
  const sessao = sessaoData as unknown as TreinoSessao & {
    treino_dias: { nome: string } | null;
  };

  const [{ data: seriesData }, { data: exerciciosData }] = await Promise.all([
    supabase
      .from("treino_series_registradas")
      .select("*")
      .eq("sessao_id", id)
      .order("created_at"),
    supabase.from("exercicios").select("*").order("nome"),
  ]);

  const series = (seriesData ?? []) as SerieRegistrada[];
  const exercicios = (exerciciosData ?? []) as Exercicio[];
  const exercicioById = new Map(exercicios.map((e) => [e.id, e]));

  // ficha do dia (se a sessão está ligada a um dia do plano)
  let ficha: FichaItem[] = [];
  if (sessao.dia_id) {
    const { data: fichaData } = await supabase
      .from("treino_ficha_itens")
      .select("*")
      .eq("dia_id", sessao.dia_id)
      .eq("ativo", true)
      .order("ordem");
    ficha = (fichaData ?? []) as FichaItem[];
  }

  // última carga por exercício em sessões anteriores (referência de progressão)
  const { data: historicoData } = await supabase
    .from("treino_series_registradas")
    .select("exercicio_id, reps, carga, created_at")
    .neq("sessao_id", id)
    .order("created_at", { ascending: false })
    .limit(300);
  const ultimaCarga = new Map<string, { reps: number; carga: number }>();
  for (const h of (historicoData ?? []) as {
    exercicio_id: string;
    reps: number;
    carga: number;
  }[]) {
    if (!ultimaCarga.has(h.exercicio_id)) {
      ultimaCarga.set(h.exercicio_id, { reps: h.reps, carga: h.carga });
    }
  }

  // exercícios exibidos: ficha do dia + qualquer um já registrado fora dela
  const idsExibidos = new Set(ficha.map((f) => f.exercicio_id));
  const extras = [...new Set(series.map((s) => s.exercicio_id))].filter(
    (eid) => !idsExibidos.has(eid)
  );
  const fichaPorExercicio = new Map(ficha.map((f) => [f.exercicio_id, f]));
  const exibidos = [...ficha.map((f) => f.exercicio_id), ...extras];

  const seriesPorExercicio = new Map<string, SerieRegistrada[]>();
  for (const s of series) {
    seriesPorExercicio.set(s.exercicio_id, [
      ...(seriesPorExercicio.get(s.exercicio_id) ?? []),
      s,
    ]);
  }

  return (
    <>
      <Link
        href="/treino"
        className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-primary"
      >
        <ArrowLeft size={14} /> Treino
      </Link>

      <PageHeader
        title={`Sessão de ${dateBR(sessao.data)}`}
        subtitle={
          <>
            {sessao.treino_dias?.nome ?? "treino livre"} ·{" "}
            {series.length} série{series.length === 1 ? "" : "s"} registrada
            {series.length === 1 ? "" : "s"}
            {sessao.observacoes ? ` · ${sessao.observacoes}` : ""}
          </>
        }
        action={
          <form action={deleteSessao}>
            <input type="hidden" name="id" value={sessao.id} />
            <button
              type="submit"
              className={`${btnGhost} hover:!bg-danger-soft hover:!text-danger`}
            >
              <Trash2 size={14} /> Excluir sessão
            </button>
          </form>
        }
      />

      {exibidos.length === 0 && (
        <Card className="mb-4 p-4 text-sm text-muted">
          Treino livre: adicione um exercício abaixo pra começar a registrar.
        </Card>
      )}

      <div className="space-y-4">
        {exibidos.map((eid) => {
          const ex = exercicioById.get(eid);
          if (!ex) return null;
          const alvo = fichaPorExercicio.get(eid);
          const feitas = seriesPorExercicio.get(eid) ?? [];
          const ultima = ultimaCarga.get(eid);
          return (
            <Card key={eid} className="p-4">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="min-w-0 flex-1 font-semibold">{ex.nome}</h3>
                {alvo && (
                  <Badge>
                    alvo {alvo.series_alvo}×
                    {alvo.reps_alvo_min && alvo.reps_alvo_max
                      ? `${alvo.reps_alvo_min}–${alvo.reps_alvo_max}`
                      : (alvo.reps_alvo_min ?? alvo.reps_alvo_max ?? "?")}
                    {alvo.carga_alvo
                      ? ` · ${num(Number(alvo.carga_alvo), 1)} kg`
                      : ""}
                  </Badge>
                )}
                {ultima && (
                  <Badge tone="info">
                    última: {num(Number(ultima.carga), 1)} kg × {ultima.reps}
                  </Badge>
                )}
              </div>

              {feitas.length > 0 && (
                <ul className="mt-3 space-y-1">
                  {feitas.map((s) => (
                    <li
                      key={s.id}
                      className="flex items-center gap-3 rounded-lg bg-background px-3 py-1.5 text-sm"
                    >
                      <span className="w-8 font-black text-muted">
                        #{s.serie_num}
                      </span>
                      <span className="font-semibold tabular-nums">
                        {num(Number(s.carga), 1)} kg × {s.reps}
                      </span>
                      {s.rpe && (
                        <span className="text-xs text-muted">
                          RPE {num(Number(s.rpe), 1)}
                        </span>
                      )}
                      <form action={deleteSerie} className="ml-auto">
                        <input type="hidden" name="id" value={s.id} />
                        <input
                          type="hidden"
                          name="sessao_id"
                          value={sessao.id}
                        />
                        <button
                          type="submit"
                          aria-label="Excluir série"
                          className="rounded p-1 text-muted/40 hover:bg-danger-soft hover:text-danger"
                        >
                          <Trash2 size={13} />
                        </button>
                      </form>
                    </li>
                  ))}
                </ul>
              )}

              <form
                action={registrarSerie}
                className="mt-3 flex flex-wrap items-end gap-2"
              >
                <input type="hidden" name="sessao_id" value={sessao.id} />
                <input type="hidden" name="exercicio_id" value={eid} />
                <div>
                  <label className={labelCls}>Carga (kg)</label>
                  <input
                    name="carga"
                    required
                    inputMode="decimal"
                    defaultValue={
                      feitas.length > 0
                        ? String(feitas[feitas.length - 1].carga)
                        : ultima
                          ? String(ultima.carga)
                          : ""
                    }
                    className={`${inputCls} !w-24 !px-2 !py-1.5 !text-sm`}
                  />
                </div>
                <div>
                  <label className={labelCls}>Reps</label>
                  <input
                    name="reps"
                    required
                    type="number"
                    min={1}
                    className={`${inputCls} !w-20 !px-2 !py-1.5 !text-sm`}
                  />
                </div>
                <div>
                  <label className={labelCls}>RPE</label>
                  <input
                    name="rpe"
                    inputMode="decimal"
                    placeholder="—"
                    className={`${inputCls} !w-16 !px-2 !py-1.5 !text-sm`}
                  />
                </div>
                <button
                  type="submit"
                  className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white hover:bg-primary-dark"
                >
                  <Plus size={14} className="inline" /> Série
                </button>
              </form>
            </Card>
          );
        })}
      </div>

      {/* adicionar exercício fora da ficha */}
      <Card className="mt-4 p-4">
        <form
          action={registrarSerie}
          className="flex flex-wrap items-end gap-2"
        >
          <input type="hidden" name="sessao_id" value={sessao.id} />
          <div className="min-w-48 flex-1">
            <label className={labelCls} htmlFor="ae-ex">
              Registrar exercício fora da ficha
            </label>
            <select id="ae-ex" name="exercicio_id" className={inputCls}>
              {exercicios.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nome}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Carga (kg)</label>
            <input
              name="carga"
              required
              inputMode="decimal"
              className={`${inputCls} !w-24`}
            />
          </div>
          <div>
            <label className={labelCls}>Reps</label>
            <input
              name="reps"
              required
              type="number"
              min={1}
              className={`${inputCls} !w-20`}
            />
          </div>
          <button type="submit" className={btnSecondary}>
            <Plus size={15} /> 1ª série
          </button>
        </form>
      </Card>
    </>
  );
}
