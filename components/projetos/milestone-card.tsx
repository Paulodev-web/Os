"use client";

import { useState } from "react";
import { Eye, EyeOff, Trash2, Pencil, Plus, Paperclip } from "lucide-react";
import {
  Card,
  Badge,
  inputCls,
  labelCls,
  btnPrimary,
  btnSecondary,
  btnGhost,
} from "@/components/ui";
import { MultiFileUpload } from "@/components/upload/multi-file-upload";
import { PROJECT_PHASES, PHASE_LABEL } from "@/lib/phases";
import { dateTimeBR } from "@/lib/format";
import { publicAssetUrl } from "@/lib/storage";
import type { Milestone, ProjectAsset } from "@/lib/database.types";

export function MilestoneCard({
  milestone: m,
  projectId,
  assets,
  onPublishToggle,
  onDelete,
  onUpdate,
  onAddAsset,
  onDeleteAsset,
}: {
  milestone: Milestone;
  projectId: string;
  assets: ProjectAsset[];
  onPublishToggle: (formData: FormData) => void;
  onDelete: (formData: FormData) => void;
  onUpdate: (formData: FormData) => void;
  onAddAsset: (formData: FormData) => void;
  onDeleteAsset: (formData: FormData) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [uploaderOpen, setUploaderOpen] = useState(false);

  return (
    <Card className={`p-4 ${m.published ? "border-primary/30" : ""}`}>
      {editing ? (
        <form
          action={async (formData) => {
            await onUpdate(formData);
            setEditing(false);
          }}
          className="space-y-3"
        >
          <input type="hidden" name="id" value={m.id} />
          <input type="hidden" name="project_id" value={projectId} />
          <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
            <div className="md:col-span-4">
              <label className={labelCls} htmlFor={`em-title-${m.id}`}>
                Título
              </label>
              <input
                id={`em-title-${m.id}`}
                name="title"
                required
                defaultValue={m.title}
                className={inputCls}
              />
            </div>
            <div className="md:col-span-3">
              <label className={labelCls} htmlFor={`em-phase-${m.id}`}>
                Fase
              </label>
              <select
                id={`em-phase-${m.id}`}
                name="phase"
                defaultValue={m.phase ?? ""}
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
            <div className="md:col-span-5">
              <label className={labelCls} htmlFor={`em-desc-${m.id}`}>
                Descrição
              </label>
              <input
                id={`em-desc-${m.id}`}
                name="description"
                defaultValue={m.description ?? ""}
                className={inputCls}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" className={btnPrimary}>
              Salvar
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className={btnGhost}
            >
              Cancelar
            </button>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-semibold">{m.title}</p>
              {m.phase && <Badge tone="info">{PHASE_LABEL[m.phase]}</Badge>}
              {m.published ? (
                <Badge tone="green">
                  publicado · {dateTimeBR(m.published_at)}
                </Badge>
              ) : (
                <Badge>rascunho — só você vê</Badge>
              )}
            </div>
            {m.description && (
              <p className="mt-1 text-sm text-muted">{m.description}</p>
            )}
          </div>
          <div className="flex items-center gap-1">
            <form action={onPublishToggle}>
              <input type="hidden" name="id" value={m.id} />
              <input type="hidden" name="project_id" value={projectId} />
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
            <button
              type="button"
              onClick={() => setEditing(true)}
              aria-label="Editar marco"
              className={btnGhost}
            >
              <Pencil size={15} />
            </button>
            <form action={onDelete}>
              <input type="hidden" name="id" value={m.id} />
              <input type="hidden" name="project_id" value={projectId} />
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
      )}

      {assets.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {assets.map((a) => (
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
              <form action={onDeleteAsset}>
                <input type="hidden" name="id" value={a.id} />
                <input type="hidden" name="project_id" value={projectId} />
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

      <div className="mt-3 border-t border-border pt-3">
        <button
          type="button"
          onClick={() => setUploaderOpen((v) => !v)}
          className={btnGhost}
        >
          <Plus size={14} /> {uploaderOpen ? "Fechar" : "Adicionar arquivos"}
        </button>
        {uploaderOpen && (
          <div className="mt-3">
            <MultiFileUpload
              action={onAddAsset}
              projectId={projectId}
              fixedMilestoneId={m.id}
            />
          </div>
        )}
      </div>
    </Card>
  );
}
