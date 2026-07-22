"use client";

import { Trash2 } from "lucide-react";
import { btnGhost } from "@/components/ui";

export function DeleteClientForm({
  action,
  clientId,
  clientSlug,
  clientName,
}: {
  action: (formData: FormData) => void;
  clientId: string;
  clientSlug: string;
  clientName: string;
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        const ok = window.confirm(
          `Excluir o cliente "${clientName}"? Essa ação não pode ser desfeita.`
        );
        if (!ok) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={clientId} />
      <input type="hidden" name="slug" value={clientSlug} />
      <button
        type="submit"
        className={`${btnGhost} hover:!bg-danger-soft hover:!text-danger`}
      >
        <Trash2 size={15} /> Excluir cliente
      </button>
    </form>
  );
}
