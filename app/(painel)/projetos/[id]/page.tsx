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
import { PROJECT_STATUS_LABEL } from "@/lib/labels";
import { dateTimeBR } from "@/lib/format";
import { publicAssetUrl } from "@/lib/storage";
import {
  addAsset,
  createMilestone,
  deleteAsset,
  deleteMilestone,
  setMilestonePublished,
  updateProjectStatus,
} from "../actions";

export const dynamic = "force-dynamic";

export default async function ProjetoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
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

      {/* Novo marco */}
      <Card className="mb-6 p-4">
        <form
          action={createMilestone}
          className="grid grid-cols-1 gap-3 md:grid-cols-12"
        >
          <input type="hidden" name="project_id" value={project.id} />
          <div className="md:col-span-4">
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
          <div className="md:col-span-6">
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

      {/* Anexar asset */}
      <Card className="mt-6 p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
          Anexar asset
        </h2>
        <form
          action={addAsset}
          className="grid grid-cols-1 gap-3 md:grid-cols-12"
        >
          <input type="hidden" name="project_id" value={project.id} />
          <div className="md:col-span-3">
            <label className={labelCls} htmlFor="as-file">
              Arquivo
            </label>
            <input
              id="as-file"
              name="file"
              type="file"
              className={`${inputCls} file:mr-2 file:rounded file:border-0 file:bg-primary-soft file:px-2 file:py-0.5 file:text-xs file:font-semibold file:text-primary-dark`}
            />
          </div>
          <div className="md:col-span-3">
            <label className={labelCls} htmlFor="as-url">
              …ou link externo
            </label>
            <input
              id="as-url"
              name="external_url"
              type="url"
              placeholder="https://…"
              className={inputCls}
            />
          </div>
          <div className="md:col-span-2">
            <label className={labelCls} htmlFor="as-title">
              Título
            </label>
            <input
              id="as-title"
              name="title"
              placeholder="opcional"
              className={inputCls}
            />
          </div>
          <div className="md:col-span-2">
            <label className={labelCls} htmlFor="as-milestone">
              Marco
            </label>
            <select id="as-milestone" name="milestone_id" className={inputCls}>
              <option value="">— sem marco (não vai ao portal)</option>
              {milestones.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.title}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end md:col-span-2">
            <button type="submit" className={`${btnSecondary} w-full`}>
              <Paperclip size={15} /> Anexar
            </button>
          </div>
        </form>
        <p className="mt-2 text-xs text-muted">
          Regra do portal: um asset só aparece pro cliente se estiver ligado a
          um marco <strong>publicado</strong>.
        </p>
      </Card>

      {/* Assets soltos */}
      {(assetsByMilestone.get(null) ?? []).length > 0 && (
        <Card className="mt-4 p-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
            Assets sem marco (internos)
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
