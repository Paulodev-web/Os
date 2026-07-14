"use client";

import { useState } from "react";
import { Check, Link2 } from "lucide-react";
import { btnSecondary } from "@/components/ui";

/** Copia o link público do portal (monta com a origem atual do navegador) */
export function CopyPortalLink({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    const url = `${window.location.origin}/c/${token}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copie o link do portal:", url);
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
          <Link2 size={15} /> Copiar link do portal
        </>
      )}
    </button>
  );
}
