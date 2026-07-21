"use client";

import { useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { ImagePlus, Loader } from "lucide-react";
import { btnPrimary, btnSecondary } from "@/components/ui";

const MAX_DIMENSION = 1920;
const JPEG_QUALITY = 0.82;

export interface PendingFile {
  id: string;
  file: File;
  previewUrl: string;
}

/** Redimensiona/recomprime imagens no navegador antes do upload — uploads mais
 * rápidos e confiáveis, sem esbarrar no limite de tamanho do Server Action.
 * Função pura (sem refs), segura pra compartilhar entre os componentes de
 * upload sem tropeçar na regra de lint `react-hooks/refs`. */
export async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/svg+xml") {
    return file;
  }
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;

  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, width, height);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY)
  );
  if (!blob || blob.size >= file.size) return file;

  const newName = file.name.replace(/\.[^.]+$/, "") + ".jpg";
  return new File([blob], newName, { type: "image/jpeg" });
}

export function ResetOnComplete({ onDone }: { onDone: () => void }) {
  const { pending } = useFormStatus();
  const wasPending = useRef(false);
  useEffect(() => {
    if (wasPending.current && !pending) onDone();
    wasPending.current = pending;
  }, [pending, onDone]);
  return null;
}

export function SubmitButton({
  count,
  label = "Anexar",
  variant = "secondary",
}: {
  count: number;
  label?: string;
  variant?: "primary" | "secondary";
}) {
  const { pending } = useFormStatus();
  const cls = variant === "primary" ? btnPrimary : btnSecondary;
  return (
    <button type="submit" disabled={pending} className={`${cls} w-full`}>
      {pending ? (
        <Loader size={15} className="animate-spin" />
      ) : (
        <ImagePlus size={15} />
      )}
      {pending ? "Enviando…" : `${label}${count ? ` (${count})` : ""}`}
    </button>
  );
}
