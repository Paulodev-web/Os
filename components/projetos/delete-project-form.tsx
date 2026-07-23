"use client";

import { Trash2 } from "lucide-react";
import { btnGhost } from "@/components/ui";

export function DeleteProjectForm({
  action,
  projectId,
  clientSlug,
  projectName,
  compact = false,
}: {
  action: (formData: FormData) => void;
  projectId: string;
  clientSlug: string;
  projectName: string;
  /** Ícone isolado, sem texto — pra caber direto no card da lista de projetos. */
  compact?: boolean;
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        const ok = window.confirm(
          `Excluir "${projectName}" e todos os marcos/arquivos dele? Essa ação não pode ser desfeita.`
        );
        if (!ok) e.preventDefault();
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <input type="hidden" name="id" value={projectId} />
      <input type="hidden" name="client_slug" value={clientSlug} />
      {compact ? (
        <button
          type="submit"
          title="Excluir projeto"
          aria-label="Excluir projeto"
          className="inline-flex shrink-0 items-center justify-center rounded-lg p-2 text-muted transition hover:bg-danger-soft hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
        >
          <Trash2 size={15} />
        </button>
      ) : (
        <button
          type="submit"
          className={`${btnGhost} hover:!bg-danger-soft hover:!text-danger`}
        >
          <Trash2 size={15} /> Excluir projeto
        </button>
      )}
    </form>
  );
}
