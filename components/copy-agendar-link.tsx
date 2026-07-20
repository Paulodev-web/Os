"use client";

import { useState } from "react";
import { Check, Link2 } from "lucide-react";
import { btnSecondary } from "@/components/ui";

/** Copia o link público de agendamento (monta com a origem atual do navegador) */
export function CopyAgendarLink({ slug }: { slug: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    const url = `${window.location.origin}/agendar/${slug}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copie o link de agendamento:", url);
    }
  }

  return (
    <button type="button" onClick={copy} className={btnSecondary}>
      {copied ? (
        <>
          <Check size={15} className="text-primary" /> Copiado!
        </>
      ) : (
        <>
          <Link2 size={15} /> Copiar link
        </>
      )}
    </button>
  );
}
