import {
  Plus,
  Trash2,
  Rocket,
  Scale,
  CheckCircle2,
  RotateCcw,
  Archive,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import type {
  RoadmapItem,
  RoadmapPhase,
  StartupDecision,
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
  btnGhost,
} from "@/components/ui";
import { ROADMAP_PHASE_LABEL } from "@/lib/labels";
import { dateBR, dateTimeBR } from "@/lib/format";
import {
  addOption,
  arquivarDecisao,
  createDecision,
  createRoadmapItem,
  cycleRoadmapStatus,
  decidir,
  deleteRoadmapItem,
  reabrirDecisao,
} from "./actions";

export const dynamic = "force-dynamic";

const FASES: RoadmapPhase[] = ["naming", "mvp", "beta", "lancamento"];

const STATUS_LABEL: Record<string, string> = {
  pendente: "pendente",
  em_andamento: "em andamento",
  concluido: "concluído",
};

const STATUS_TONE = {
  pendente: "neutral",
  em_andamento: "info",
  concluido: "green",
} as const;

export default async function IservicePage() {
  const supabase = await createClient();

  const [{ data: roadmapData, error }, { data: decisionsData }] =
    await Promise.all([
      supabase.from("roadmap_items").select("*").order("ordem"),
      supabase
        .from("startup_decisions")
        .select("*")
        .order("created_at", { ascending: false }),
    ]);

  if (error) throw new Error(`Erro ao carregar roadmap: ${error.message}`);

  const roadmap = (roadmapData ?? []) as RoadmapItem[];
  const decisions = (decisionsData ?? []) as StartupDecision[];
  const abertas = decisions.filter((d) => d.status === "aberta");
  const fechadas = decisions.filter((d) => d.status !== "aberta");

  const porFase = new Map<RoadmapPhase, RoadmapItem[]>(
    FASES.map((f) => [f, []])
  );
  for (const item of roadmap) porFase.get(item.phase)?.push(item);

  const concluidos = roadmap.filter((r) => r.status === "concluido").length;

  return (
    <>
      <PageHeader
        title="iService"
        subtitle={`Startup em validação · ${concluidos}/${roadmap.length} itens do roadmap concluídos`}
      />

      {/* Roadmap */}
      <section className="mb-10">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted">
          <Rocket size={15} className="text-primary" /> Roadmap
        </h2>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          {FASES.map((fase, i) => {
            const itens = porFase.get(fase) ?? [];
            return (
              <div
                key={fase}
                className="rounded-xl border border-border/70 bg-graphite-soft/5 p-2"
              >
                <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted">
                  {i + 1}. {ROADMAP_PHASE_LABEL[fase]}
                </p>
                <div className="space-y-2">
                  {itens.map((item) => (
                    <Card key={item.id} className="group p-3">
                      <p
                        className={`text-sm font-semibold leading-snug ${item.status === "concluido" ? "line-through opacity-60" : ""}`}
                      >
                        {item.title}
                      </p>
                      {item.target_date && (
                        <p className="mt-0.5 text-xs text-muted">
                          alvo: {dateBR(item.target_date)}
                        </p>
                      )}
                      <div className="mt-2 flex items-center justify-between">
                        <form action={cycleRoadmapStatus}>
                          <input type="hidden" name="id" value={item.id} />
                          <input
                            type="hidden"
                            name="status"
                            value={item.status}
                          />
                          <button
                            type="submit"
                            title="Clique pra avançar o status"
                            className="cursor-pointer"
                          >
                            <Badge tone={STATUS_TONE[item.status]}>
                              {STATUS_LABEL[item.status]}
                            </Badge>
                          </button>
                        </form>
                        <form action={deleteRoadmapItem}>
                          <input type="hidden" name="id" value={item.id} />
                          <button
                            type="submit"
                            aria-label="Excluir item"
                            className="rounded p-1 text-muted/30 opacity-0 transition group-hover:opacity-100 hover:bg-danger-soft hover:text-danger"
                          >
                            <Trash2 size={12} />
                          </button>
                        </form>
                      </div>
                    </Card>
                  ))}
                  {itens.length === 0 && (
                    <p className="px-1 pb-1 text-xs text-muted">sem itens</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* novo item */}
        <Card className="mt-3 p-3">
          <form
            action={createRoadmapItem}
            className="flex flex-wrap items-end gap-2"
          >
            <div className="min-w-52 flex-1">
              <label className={labelCls} htmlFor="ri-title">
                Novo item do roadmap
              </label>
              <input
                id="ri-title"
                name="title"
                required
                placeholder="ex: Landing de captação do beta"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls} htmlFor="ri-phase">
                Fase
              </label>
              <select id="ri-phase" name="phase" className={inputCls}>
                {FASES.map((f) => (
                  <option key={f} value={f}>
                    {ROADMAP_PHASE_LABEL[f]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls} htmlFor="ri-date">
                Data alvo
              </label>
              <input
                id="ri-date"
                name="target_date"
                type="date"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls} htmlFor="ri-ordem">
                Ordem
              </label>
              <input
                id="ri-ordem"
                name="ordem"
                type="number"
                defaultValue={9}
                className={`${inputCls} !w-20`}
              />
            </div>
            <button type="submit" className={btnSecondary}>
              <Plus size={15} /> Adicionar
            </button>
          </form>
        </Card>
      </section>

      {/* Decisões */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted">
          <Scale size={15} className="text-primary" /> Decisões
        </h2>

        {/* nova decisão */}
        <Card className="mb-4 p-4">
          <form
            action={createDecision}
            className="flex flex-wrap items-end gap-3"
          >
            <div className="min-w-48 flex-1">
              <label className={labelCls} htmlFor="nd-topic">
                Nova decisão em aberto
              </label>
              <input
                id="nd-topic"
                name="topic"
                required
                placeholder="ex: Modelo de cobrança do MVP"
                className={inputCls}
              />
            </div>
            <div className="min-w-64 flex-[2]">
              <label className={labelCls} htmlFor="nd-context">
                Contexto
              </label>
              <input
                id="nd-context"
                name="context"
                placeholder="por que essa decisão importa agora"
                className={inputCls}
              />
            </div>
            <button type="submit" className={btnPrimary}>
              <Plus size={15} /> Abrir
            </button>
          </form>
        </Card>

        {abertas.length === 0 && fechadas.length === 0 && (
          <EmptyState title="Nenhuma decisão registrada" />
        )}

        <div className="space-y-4">
          {abertas.map((d) => (
            <Card key={d.id} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="font-black tracking-tight">{d.topic}</h3>
                  {d.context && (
                    <p className="mt-1 text-sm text-muted">{d.context}</p>
                  )}
                </div>
                <Badge tone="warn">em aberto</Badge>
              </div>

              {d.options.length > 0 && (
                <form action={decidir} className="mt-4 space-y-2">
                  <input type="hidden" name="id" value={d.id} />
                  {d.options.map((o, i) => (
                    <label
                      key={i}
                      className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-background p-3 transition has-[:checked]:border-primary has-[:checked]:bg-primary-soft/40"
                    >
                      <input
                        type="radio"
                        name="decided_option"
                        value={o.nome}
                        className="mt-1 accent-[#01603b]"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="font-semibold">{o.nome}</span>
                        {o.pros && (
                          <span className="mt-0.5 block text-xs text-primary-dark">
                            + {o.pros}
                          </span>
                        )}
                        {o.contras && (
                          <span className="mt-0.5 block text-xs text-danger">
                            − {o.contras}
                          </span>
                        )}
                      </span>
                    </label>
                  ))}
                  <div className="flex items-center gap-2 pt-1">
                    <button type="submit" className={btnPrimary}>
                      <CheckCircle2 size={15} /> Decidir
                    </button>
                    <button
                      type="submit"
                      formAction={arquivarDecisao}
                      className={btnGhost}
                    >
                      <Archive size={14} /> Arquivar
                    </button>
                  </div>
                </form>
              )}

              {/* adicionar opção */}
              <details className="mt-3">
                <summary className="cursor-pointer text-xs font-semibold text-primary hover:underline">
                  + adicionar opção
                </summary>
                <form
                  action={addOption}
                  className="mt-2 flex flex-wrap items-end gap-2"
                >
                  <input type="hidden" name="id" value={d.id} />
                  <div className="min-w-36 flex-1">
                    <label className={labelCls}>Opção</label>
                    <input
                      name="nome"
                      required
                      placeholder="ex: iService"
                      className={`${inputCls} !py-1.5 !text-xs`}
                    />
                  </div>
                  <div className="min-w-40 flex-1">
                    <label className={labelCls}>Prós</label>
                    <input
                      name="pros"
                      placeholder="opcional"
                      className={`${inputCls} !py-1.5 !text-xs`}
                    />
                  </div>
                  <div className="min-w-40 flex-1">
                    <label className={labelCls}>Contras</label>
                    <input
                      name="contras"
                      placeholder="opcional"
                      className={`${inputCls} !py-1.5 !text-xs`}
                    />
                  </div>
                  <button type="submit" className={btnSecondary}>
                    <Plus size={13} />
                  </button>
                </form>
              </details>
            </Card>
          ))}
        </div>

        {/* decididas / arquivadas */}
        {fechadas.length > 0 && (
          <div className="mt-6">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
              Decididas e arquivadas
            </h3>
            <ul className="space-y-2">
              {fechadas.map((d) => (
                <li key={d.id}>
                  <Card className="flex flex-wrap items-center gap-3 p-3 opacity-80">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">{d.topic}</p>
                      {d.status === "decidida" && d.decided_option && (
                        <p className="text-xs text-primary-dark">
                          ✓ {d.decided_option}
                          {d.decided_at
                            ? ` — ${dateTimeBR(d.decided_at)}`
                            : ""}
                        </p>
                      )}
                    </div>
                    <Badge tone={d.status === "decidida" ? "green" : "neutral"}>
                      {d.status}
                    </Badge>
                    <form action={reabrirDecisao}>
                      <input type="hidden" name="id" value={d.id} />
                      <button
                        type="submit"
                        title="Reabrir decisão"
                        className={btnGhost}
                      >
                        <RotateCcw size={13} />
                      </button>
                    </form>
                  </Card>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </>
  );
}
