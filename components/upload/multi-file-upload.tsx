"use client";

import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
} from "react";
import { useFormStatus } from "react-dom";
import { Upload, X, ImagePlus, Loader } from "lucide-react";
import { inputCls, labelCls, btnSecondary } from "@/components/ui";

const MAX_DIMENSION = 1920;
const JPEG_QUALITY = 0.82;

interface PendingFile {
  id: string;
  file: File;
  previewUrl: string;
}

/** Redimensiona/recomprime imagens no navegador antes do upload — uploads mais
 * rápidos e confiáveis, sem esbarrar no limite de tamanho do Server Action. */
async function compressImage(file: File): Promise<File> {
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

function ResetOnComplete({ onDone }: { onDone: () => void }) {
  const { pending } = useFormStatus();
  const wasPending = useRef(false);
  useEffect(() => {
    if (wasPending.current && !pending) onDone();
    wasPending.current = pending;
  }, [pending, onDone]);
  return null;
}

function SubmitButton({ count }: { count: number }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={`${btnSecondary} w-full`}
    >
      {pending ? (
        <Loader size={15} className="animate-spin" />
      ) : (
        <ImagePlus size={15} />
      )}
      {pending ? "Enviando…" : `Anexar${count ? ` (${count})` : ""}`}
    </button>
  );
}

export function MultiFileUpload({
  action,
  projectId,
  milestones,
}: {
  action: (formData: FormData) => void;
  projectId: string;
  milestones: { id: string; title: string }[];
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const syncedRef = useRef(false);
  const [pending, setPending] = useState<PendingFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    return () => {
      pending.forEach((p) => p.previewUrl && URL.revokeObjectURL(p.previewUrl));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function addFiles(fileList: FileList | File[]) {
    const incoming = Array.from(fileList);
    if (incoming.length === 0) return;
    const compressed = await Promise.all(incoming.map(compressImage));
    const next = compressed.map((file) => ({
      id: `${file.name}-${file.size}-${Math.random().toString(36).slice(2)}`,
      file,
      previewUrl: file.type.startsWith("image/")
        ? URL.createObjectURL(file)
        : "",
    }));
    setPending((prev) => [...prev, ...next]);
  }

  function removeFile(id: string) {
    setPending((prev) => {
      const target = prev.find((p) => p.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((p) => p.id !== id);
    });
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files?.length) void addFiles(e.dataTransfer.files);
  }

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    if (e.target.files?.length) void addFiles(e.target.files);
    e.target.value = "";
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    if (syncedRef.current) {
      syncedRef.current = false;
      return;
    }
    if (pending.length === 0) return;
    e.preventDefault();
    const dt = new DataTransfer();
    pending.forEach((p) => dt.items.add(p.file));
    if (fileInputRef.current) fileInputRef.current.files = dt.files;
    syncedRef.current = true;
    formRef.current?.requestSubmit();
  }

  return (
    <form
      ref={formRef}
      action={action}
      onSubmit={handleSubmit}
      className="space-y-4"
    >
      <ResetOnComplete onDone={() => setPending([])} />
      <input type="hidden" name="project_id" value={projectId} />

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        role="button"
        tabIndex={0}
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-8 text-center transition ${
          isDragging
            ? "border-primary bg-primary-soft/40"
            : "border-border bg-background hover:border-primary/40"
        }`}
      >
        <Upload size={26} className={isDragging ? "text-primary" : "text-muted"} />
        <p className="text-sm font-semibold">
          Arraste fotos/arquivos aqui ou clique pra escolher
        </p>
        <p className="text-xs text-muted">
          Várias imagens de uma vez — são comprimidas automaticamente antes do
          envio
        </p>
        <input
          ref={fileInputRef}
          type="file"
          name="file"
          multiple
          onChange={handleChange}
          className="hidden"
        />
      </div>

      {pending.length > 0 && (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
          {pending.map((p) => (
            <li
              key={p.id}
              className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-surface"
            >
              {p.previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={p.previewUrl}
                  alt={p.file.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center p-2 text-center text-[10px] font-semibold text-muted">
                  {p.file.name}
                </div>
              )}
              <button
                type="button"
                onClick={() => removeFile(p.id)}
                aria-label="Remover arquivo"
                className="absolute right-1 top-1 rounded-full bg-graphite/80 p-1 text-white opacity-0 transition group-hover:opacity-100"
              >
                <X size={12} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
        <div className="md:col-span-4">
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
        <div className="md:col-span-3">
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
        <div className="md:col-span-3">
          <label className={labelCls} htmlFor="as-milestone">
            Marco
          </label>
          <select id="as-milestone" name="milestone_id" className={inputCls}>
            <option value="">— entregável do projeto (aparece em Arquivos)</option>
            {milestones.map((m) => (
              <option key={m.id} value={m.id}>
                {m.title}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end md:col-span-2">
          <SubmitButton count={pending.length} />
        </div>
      </div>
    </form>
  );
}
