import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Plus,
  Eye,
  EyeOff,
  Trash2,
  Paperclip,
  ExternalLink,
  ArrowLeft,
  AlertTriangle,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import type {
  Client,
  Milestone,
  Project,
  ProjectAsset,
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
import { CopyPortalLink } from "@/components/copy-link";
import { MultiFileUpload } from "@/components/upload/multi-file-upload";
import { PROJECT_STATUS_LABEL } from "@/lib/labels";
import { PROJECT_PHASES, PHASE_LABEL } from "@/lib/phases";
import { dateTimeBR } from "@/lib/format";
import { publicAssetUrl } from "@/lib/storage";
import {
  addAsset,
  createMilestone,
  deleteAsset,
  deleteMilestone,
  setMilestonePublished,
  updateProjectPortalSettings,
  updateProjectStatus,
} from "../actions";

export const dynamic = "force-dynamic";

export default async function ProjetoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ erro?: string }>;
}) {
  const { id } = await params;
  const { erro } = await searchParams;
  const supabase = await createClient();

  const { data: projectData } = await supabase
    .from("projects")
    .select("*, clients(*)")
    .eq("id", id)
    .maybeSingle();

  if (!projectData) notFound();
  const project = projectData as unknown as Project & { clients: Client };

  const [{ data: milestonesData }, { data: assetsData }] = await Promise.all([
    supabase
      .from("project_milestones")
      .select("*")
      .eq("project_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("project_assets")
      .select("*")
      .eq("project_id", id)
      .order("created_at", { ascending: false }),
  ]);

  const milestones = (milestonesData ?? []) as Milestone[];
  const assets = (assetsData ?? []) as ProjectAsset[];
  const assetsByMilestone = new Map<string | null, ProjectAsset[]>();
  for (const a of assets) {
    const key = a.milestone_id;
    assetsByMilestone.set(key, [...(assetsByMilestone.get(key) ?? []), a]);
  }
  const publishedCount = milestones.filter((m) => m.published).length;

  return (
    <>
      <Link
        href={`/clientes/${project.clients.slug}`}
        className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-primary"
      >
        <ArrowLeft size={14} /> {project.clients.name}
      </Link>

      {erro && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-danger/30 bg-danger-soft px-4 py-3 text-sm font-semibold text-danger">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          {erro}
        </div>
      )}

      <PageHeader
        title={project.name}
        subtitle={
          <>
            {publishedCount} marco{publishedCount === 1 ? "" : "s"} publicado
            {publishedCount === 1 ? "" : "s"} no portal do cliente
          </>
        }
        action={
          <div className="flex flex-wrap items-center gap-2">
            <CopyPortalLink token={project.clients.portal_token} />
            <form action={updateProjectStatus}>
              <input type="hidden" name="id" value={project.id} />
              <select
                name="status"
                defaultValue={project.status}
                className={inputCls}
                // eslint-disable-next-line react/no-unknown-property
              >
                {Object.entries(PROJECT_STATUS_LABEL).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
              <button type="submit" className={`${btnGhost} mt-1 w-full`}>
                Atualizar status
              </button>
            </form>
          </div>
        }
      />

      {/* Configurações do portal */}
      <Card className="mb-6 p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
          Configurações do portal
        </h2>
        <form action={updateProjectPortalSettings} className="space-y-4">
          <input type="hidden" name="id" value={project.id} />
          <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
            <div className="md:col-span-6">
              <label className={labelCls} htmlFor="ps-phase">
                Fase atual
              </label>
              <select
                id="ps-phase"
                name="current_phase"
                defaultValue={project.current_phase ?? ""}
                className={inputCls}
              >
                <option value="">— não iniciado</option>
                {PROJECT_PHASES.map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-6">
              <label className={labelCls} htmlFor="ps-phase-date">
                Previsão de entrega da fase atual
              </label>
              <input
                id="ps-phase-date"
                name="current_phase_target_date"
                type="date"
                defaultValue={project.current_phase_target_date ?? ""}
                className={inputCls}
              />
            </div>
            <div className="md:col-span-6">
              <label className={labelCls} htmlFor="ps-scope-in">
                Escopo incluído (uma linha por item)
              </label>
              <textarea
                id="ps-scope-in"
                name="scope_included"
                rows={4}
                defaultValue={project.scope_included ?? ""}
                placeholder={"Layout responsivo\nIntegração com pagamento"}
                className={`${inputCls} resize-y`}
              />
            </div>
            <div className="md:col-span-6">
              <label className={labelCls} htmlFor="ps-scope-out">
                Fora do escopo (uma linha por item)
              </label>
              <textarea
                id="ps-scope-out"
                name="scope_excluded"
                rows={4}
                defaultValue={project.scope_excluded ?? ""}
                placeholder={"App mobile nativo\nMigração de dados legados"}
                className={`${inputCls} resize-y`}
              />
            </div>
            <div className="md:col-span-8">
              <label className={labelCls} htmlFor="ps-next-action">
                Próxima ação necessária do cliente
              </label>
              <input
                id="ps-next-action"
                name="next_action"
                defaultValue={project.next_action ?? ""}
                placeholder="ex: Aprovar o layout da home"
                className={inputCls}
              />
            </div>
            <div className="md:col-span-4">
              <label className={labelCls} htmlFor="ps-next-action-date">
                Prazo (opcional)
              </label>
              <input
                id="ps-next-action-date"
                name="next_action_date"
                type="date"
                defaultValue={project.next_action_date ?? ""}
                className={inputCls}
              />
            </div>
          </div>
          <button type="submit" className={btnPrimary}>
            Salvar configurações do portal
          </button>
        </form>
      </Card>

      {/* Novo marco */}
      <Card className="mb-6 p-4">
        <form
          action={createMilestone}
          className="grid grid-cols-1 gap-3 md:grid-cols-12"
        >
          <input type="hidden" name="project_id" value={project.id} />
          <div className="md:col-span-3">
            <label className={labelCls} htmlFor="nm-title">
              Novo marco
            </label>
            <input
              id="nm-title"
              name="title"
              required
              placeholder="ex: Layout aprovado"
              className={inputCls}
            />
          </div>
          <div className="md:col-span-3">
            <label className={labelCls} htmlFor="nm-phase">
              Fase
            </label>
            <select
              id="nm-phase"
              name="phase"
              defaultValue=""
              className={inputCls}
            >
              <option value="">— sem fase</option>
              {PROJECT_PHASES.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-4">
            <label className={labelCls} htmlFor="nm-desc">
              Descrição (o cliente vê isso quando publicado)
            </label>
            <input
              id="nm-desc"
              name="description"
              placeholder="O que foi concluído nesta etapa"
              className={inputCls}
            />
          </div>
          <div className="flex items-end md:col-span-2">
            <button type="submit" className={`${btnPrimary} w-full`}>
              <Plus size={16} /> Criar
            </button>
          </div>
        </form>
      </Card>

      {/* Marcos */}
      {milestones.length === 0 ? (
        <EmptyState
          title="Nenhum marco ainda"
          hint="Crie marcos pra contar o andamento do projeto. Só o que você publicar aparece no portal do cliente."
        />
      ) : (
        <ul className="space-y-3">
          {milestones.map((m) => {
            const mAssets = assetsByMilestone.get(m.id) ?? [];
            return (
              <li key={m.id}>
                <Card
                  className={`p-4 ${m.published ? "border-primary/30" : ""}`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold">{m.title}</p>
                        {m.phase && (
                          <Badge tone="info">{PHASE_LABEL[m.phase]}</Badge>
                        )}
                        {m.published ? (
                          <Badge tone="green">
                            publicado · {dateTimeBR(m.published_at)}
                          </Badge>
                        ) : (
                          <Badge>rascunho — só você vê</Badge>
                        )}
                      </div>
                      {m.description && (
                        <p className="mt-1 text-sm text-muted">
                          {m.description}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <form action={setMilestonePublished}>
                        <input type="hidden" name="id" value={m.id} />
                        <input
                          type="hidden"
                          name="project_id"
                          value={project.id}
                        />
                        <input
                          type="hidden"
                          name="publish"
                          value={String(!m.published)}
                        />
                        <button
                          type="submit"
                          className={m.published ? btnSecondary : btnPrimary}
                        >
                          {m.published ? (
                            <>
                              <EyeOff size={15} /> Despublicar
                            </>
                          ) : (
                            <>
                              <Eye size={15} /> Publicar no portal
                            </>
                          )}
                        </button>
                      </form>
                      <form action={deleteMilestone}>
                        <input type="hidden" name="id" value={m.id} />
                        <input
                          type="hidden"
                          name="project_id"
                          value={project.id}
                        />
                        <button
                          type="submit"
                          aria-label="Excluir marco"
                          className={`${btnGhost} hover:!bg-danger-soft hover:!text-danger`}
                        >
                          <Trash2 size={15} />
                        </button>
                      </form>
                    </div>
                  </div>

                  {/* Assets do marco */}
                  {mAssets.length > 0 && (
                    <ul className="mt-3 flex flex-wrap gap-2">
                      {mAssets.map((a) => (
                        <li
                          key={a.id}
                          className="flex items-center gap-2 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-semibold"
                        >
                          <Paperclip size={12} className="text-muted" />
                          <a
                            href={
                              a.storage_path
                                ? publicAssetUrl(a.storage_path)
                                : (a.external_url ?? "#")
                            }
                            target="_blank"
                            rel="noreferrer"
                            className="max-w-48 truncate hover:text-primary"
                          >
                            {a.title ?? a.type}
                          </a>
                          <form action={deleteAsset}>
                            <input type="hidden" name="id" value={a.id} />
                            <input
                              type="hidden"
                              name="project_id"
                              value={project.id}
                            />
                            <button
                              type="submit"
                              aria-label="Remover asset"
                              className="text-muted/50 hover:text-danger"
                            >
                              <Trash2 size={12} />
                            </button>
                          </form>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      {/* Anexar arquivos */}
      <Card className="mt-6 p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
          Anexar arquivos
        </h2>
        <MultiFileUpload
          action={addAsset}
          projectId={project.id}
          milestones={milestones.map((m) => ({ id: m.id, title: m.title }))}
        />
        <p className="mt-3 text-xs text-muted">
          Regra do portal: um arquivo ligado a um marco só aparece pro cliente
          se o marco estiver <strong>publicado</strong>. Sem marco, o arquivo
          vira um entregável do projeto (contrato, protótipo, nota fiscal…) e
          aparece direto na seção &quot;Arquivos do projeto&quot; do portal.
        </p>
      </Card>

      {/* Arquivos do projeto (sem marco) */}
      {(assetsByMilestone.get(null) ?? []).length > 0 && (
        <Card className="mt-4 p-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
            Arquivos do projeto (aparecem na seção &quot;Arquivos&quot; do
            portal)
          </h3>
          <ul className="flex flex-wrap gap-2">
            {(assetsByMilestone.get(null) ?? []).map((a) => (
              <li
                key={a.id}
                className="flex items-center gap-2 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-semibold"
              >
                <ExternalLink size={12} className="text-muted" />
                <a
                  href={
                    a.storage_path
                      ? publicAssetUrl(a.storage_path)
                      : (a.external_url ?? "#")
                  }
                  target="_blank"
                  rel="noreferrer"
                  className="max-w-48 truncate hover:text-primary"
                >
                  {a.title ?? a.type}
                </a>
                <form action={deleteAsset}>
                  <input type="hidden" name="id" value={a.id} />
                  <input type="hidden" name="project_id" value={project.id} />
                  <button
                    type="submit"
                    aria-label="Remover asset"
                    className="text-muted/50 hover:text-danger"
                  >
                    <Trash2 size={12} />
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
