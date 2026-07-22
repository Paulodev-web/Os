import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink, ArrowLeft, AlertTriangle, Trash2 } from "lucide-react";
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
  EmptyState,
  inputCls,
  labelCls,
  btnSecondary,
} from "@/components/ui";
import { CopyPortalLink } from "@/components/copy-link";
import { MultiFileUpload } from "@/components/upload/multi-file-upload";
import { PhaseStepper } from "@/components/portal/phase-stepper";
import { NewMilestoneForm } from "@/components/projetos/new-milestone-form";
import { MilestoneCard } from "@/components/projetos/milestone-card";
import { DeleteProjectForm } from "@/components/projetos/delete-project-form";
import { PROJECT_STATUS_LABEL } from "@/lib/labels";
import { PROJECT_PHASES, phaseIndex } from "@/lib/phases";
import { publicAssetUrl } from "@/lib/storage";
import {
  addAsset,
  createMilestoneWithFiles,
  deleteAsset,
  deleteMilestone,
  deleteProject,
  setMilestonePublished,
  updateMilestone,
  updateProjectBasics,
  updateProjectNextAction,
  updateProjectPhase,
  updateProjectScope,
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
      .order("published_at", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true }),
    supabase
      .from("project_assets")
      .select("*")
      .eq("project_id", id)
      .order("created_at", { ascending: true }),
  ]);

  const milestones = (milestonesData ?? []) as Milestone[];
  const assets = (assetsData ?? []) as ProjectAsset[];
  const assetsByMilestone = new Map<string | null, ProjectAsset[]>();
  for (const a of assets) {
    const key = a.milestone_id;
    assetsByMilestone.set(key, [...(assetsByMilestone.get(key) ?? []), a]);
  }
  const publishedCount = milestones.filter((m) => m.published).length;

  // Sugestão de sincronizar a fase atual: só avisa se o marco publicado mais
  // avançado estiver à frente da fase atual (nunca sugere regredir).
  const publishedPhaseIdxs = milestones
    .filter((m) => m.published && m.phase)
    .map((m) => phaseIndex(m.phase));
  const maxPublishedIdx = publishedPhaseIdxs.length
    ? Math.max(...publishedPhaseIdxs)
    : -1;
  const currentIdx = phaseIndex(project.current_phase);
  const suggestedPhase =
    maxPublishedIdx > currentIdx ? PROJECT_PHASES[maxPublishedIdx] : null;

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
              >
                {Object.entries(PROJECT_STATUS_LABEL).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
              <button type="submit" className={`${btnSecondary} mt-1 w-full`}>
                Atualizar status
              </button>
            </form>
          </div>
        }
      />

      {/* Dados básicos — nome, descrição e data de início */}
      <Card className="mb-6 p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
          Dados do projeto
        </h2>
        <form
          action={updateProjectBasics}
          className="grid grid-cols-1 gap-3 md:grid-cols-12"
        >
          <input type="hidden" name="id" value={project.id} />
          <input type="hidden" name="client_slug" value={project.clients.slug} />
          <div className="md:col-span-5">
            <label className={labelCls} htmlFor="pb-name">
              Nome
            </label>
            <input
              id="pb-name"
              name="name"
              required
              defaultValue={project.name}
              className={inputCls}
            />
          </div>
          <div className="md:col-span-4">
            <label className={labelCls} htmlFor="pb-desc">
              Descrição
            </label>
            <input
              id="pb-desc"
              name="description"
              defaultValue={project.description ?? ""}
              placeholder="Escopo em uma linha"
              className={inputCls}
            />
          </div>
          <div className="md:col-span-2">
            <label className={labelCls} htmlFor="pb-start">
              Início
            </label>
            <input
              id="pb-start"
              name="started_at"
              type="date"
              defaultValue={project.started_at ?? ""}
              className={inputCls}
            />
          </div>
          <div className="flex items-end md:col-span-1">
            <button type="submit" className={`${btnSecondary} w-full`}>
              Salvar
            </button>
          </div>
        </form>
      </Card>

      {/* Fase do projeto — mesma visão que o cliente vê no portal */}
      <Card className="mb-6 p-4">
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-muted">
          Fase do projeto
        </h2>
        <PhaseStepper
          currentPhase={project.current_phase}
          targetDate={project.current_phase_target_date}
        />
        <form
          action={updateProjectPhase}
          className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-12"
        >
          <input type="hidden" name="id" value={project.id} />
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
          <div className="md:col-span-4">
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
          <div className="flex items-end md:col-span-2">
            <button type="submit" className={`${btnSecondary} w-full`}>
              Salvar fase
            </button>
          </div>
        </form>

        {suggestedPhase && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-info/30 bg-info-soft px-4 py-3 text-sm">
            <p className="text-foreground">
              Você já publicou um marco da fase{" "}
              <strong>{suggestedPhase.label}</strong> — atualizar a fase atual
              do projeto pra essa?
            </p>
            <form action={updateProjectPhase}>
              <input type="hidden" name="id" value={project.id} />
              <input
                type="hidden"
                name="current_phase"
                value={suggestedPhase.key}
              />
              <button type="submit" className={btnSecondary}>
                Atualizar para {suggestedPhase.label}
              </button>
            </form>
          </div>
        )}
      </Card>

      {/* Escopo do projeto */}
      <Card className="mb-6 p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
          Escopo do projeto
        </h2>
        <form
          action={updateProjectScope}
          className="grid grid-cols-1 gap-3 md:grid-cols-2"
        >
          <input type="hidden" name="id" value={project.id} />
          <div>
            <label className={labelCls} htmlFor="sc-in">
              Escopo incluído (uma linha por item)
            </label>
            <textarea
              id="sc-in"
              name="scope_included"
              rows={4}
              defaultValue={project.scope_included ?? ""}
              placeholder={"Layout responsivo\nIntegração com pagamento"}
              className={`${inputCls} resize-y`}
            />
          </div>
          <div>
            <label className={labelCls} htmlFor="sc-out">
              Fora do escopo (uma linha por item)
            </label>
            <textarea
              id="sc-out"
              name="scope_excluded"
              rows={4}
              defaultValue={project.scope_excluded ?? ""}
              placeholder={"App mobile nativo\nMigração de dados legados"}
              className={`${inputCls} resize-y`}
            />
          </div>
          <div className="md:col-span-2">
            <button type="submit" className={btnSecondary}>
              Salvar escopo
            </button>
          </div>
        </form>
      </Card>

      {/* Próxima ação necessária do cliente */}
      <Card className="mb-6 p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
          Próxima ação necessária
        </h2>
        <form
          action={updateProjectNextAction}
          className="grid grid-cols-1 gap-3 md:grid-cols-12"
        >
          <input type="hidden" name="id" value={project.id} />
          <div className="md:col-span-8">
            <label className={labelCls} htmlFor="na-text">
              O que falta do lado do cliente
            </label>
            <input
              id="na-text"
              name="next_action"
              defaultValue={project.next_action ?? ""}
              placeholder="ex: Aprovar o layout da home"
              className={inputCls}
            />
          </div>
          <div className="md:col-span-2">
            <label className={labelCls} htmlFor="na-date">
              Prazo (opcional)
            </label>
            <input
              id="na-date"
              name="next_action_date"
              type="date"
              defaultValue={project.next_action_date ?? ""}
              className={inputCls}
            />
          </div>
          <div className="flex items-end md:col-span-2">
            <button type="submit" className={`${btnSecondary} w-full`}>
              Salvar
            </button>
          </div>
        </form>
      </Card>

      {/* Novo marco — já com upload de fotos no mesmo passo */}
      <NewMilestoneForm projectId={project.id} action={createMilestoneWithFiles} />

      {milestones.length === 0 && (
        <EmptyState
          title="Nenhum marco ainda"
          hint="Crie o primeiro marco acima e já anexe as primeiras fotos — só o que você publicar aparece no portal do cliente."
        />
      )}

      {/* Marcos */}
      {milestones.length > 0 && (
        <ul className="space-y-3">
          {milestones.map((m) => (
            <li key={m.id}>
              <MilestoneCard
                milestone={m}
                projectId={project.id}
                assets={assetsByMilestone.get(m.id) ?? []}
                onPublishToggle={setMilestonePublished}
                onDelete={deleteMilestone}
                onUpdate={updateMilestone}
                onAddAsset={addAsset}
                onDeleteAsset={deleteAsset}
              />
            </li>
          ))}
        </ul>
      )}

      {/* Arquivos do projeto (entregáveis sem marco) */}
      <Card className="mt-6 p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
          Arquivos do projeto
        </h2>
        <p className="mb-3 text-xs text-muted">
          Entregáveis sem marco — contrato, protótipo, nota fiscal… aparecem
          direto na seção &quot;Arquivos do projeto&quot; do portal.
        </p>
        <MultiFileUpload action={addAsset} projectId={project.id} />

        {(assetsByMilestone.get(null) ?? []).length > 0 && (
          <ul className="mt-4 flex flex-wrap gap-2">
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
        )}
      </Card>

      {/* Zona de risco */}
      <Card className="mt-6 border-danger/20 p-4">
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-muted">
          Zona de risco
        </h2>
        <p className="mb-3 text-xs text-muted">
          Apaga o projeto, todos os marcos e todos os arquivos anexados a ele
          (inclusive no Storage). Não afeta outros projetos do cliente.
        </p>
        <DeleteProjectForm
          action={deleteProject}
          projectId={project.id}
          clientSlug={project.clients.slug}
          projectName={project.name}
        />
      </Card>
    </>
  );
}
