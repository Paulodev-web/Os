"use client";

import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
} from "react";
import { Upload, X } from "lucide-react";
import { inputCls, labelCls } from "@/components/ui";
import {
  compressImage,
  ResetOnComplete,
  SubmitButton,
  type PendingFile,
} from "./upload-shared";

export function MultiFileUpload({
  action,
  projectId,
  fixedMilestoneId,
}: {
  action: (formData: FormData) => void;
  projectId: string;
  /** Quando presente, anexa direto a esse marco (sem select). Quando ausente,
   * vira entregável do projeto (sem marco). */
  fixedMilestoneId?: string;
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
      {fixedMilestoneId && (
        <input type="hidden" name="milestone_id" value={fixedMilestoneId} />
      )}

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
        <div className="md:col-span-5">
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
        <div className="md:col-span-5">
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
        <div className="flex items-end md:col-span-2">
          <SubmitButton count={pending.length} />
        </div>
      </div>
    </form>
  );
}
