"use client";

import { Trash2 } from "lucide-react";
import { btnGhost } from "@/components/ui";

export function DeleteProjectForm({
  action,
  projectId,
  clientSlug,
  projectName,
}: {
  action: (formData: FormData) => void;
  projectId: string;
  clientSlug: string;
  projectName: string;
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
    >
      <input type="hidden" name="id" value={projectId} />
      <input type="hidden" name="client_slug" value={clientSlug} />
      <button
        type="submit"
        className={`${btnGhost} hover:!bg-danger-soft hover:!text-danger`}
      >
        <Trash2 size={15} /> Excluir projeto
      </button>
    </form>
  );
}
