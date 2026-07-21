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
import { Card, inputCls, labelCls } from "@/components/ui";
import { PROJECT_PHASES } from "@/lib/phases";
import {
  compressImage,
  ResetOnComplete,
  SubmitButton,
  type PendingFile,
} from "@/components/upload/upload-shared";

export function NewMilestoneForm({
  projectId,
  action,
}: {
  projectId: string;
  action: (formData: FormData) => void;
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
    <Card className="mb-6 p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
        Novo marco
      </h2>
      <form
        ref={formRef}
        action={action}
        onSubmit={handleSubmit}
        className="space-y-4"
      >
        <ResetOnComplete onDone={() => setPending([])} />
        <input type="hidden" name="project_id" value={projectId} />

        <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
          <div className="md:col-span-4">
            <label className={labelCls} htmlFor="nm-title">
              Título
            </label>
            <input
              id="nm-title"
              name="title"
              required
              placeholder="ex: Layout aprovado"
              className={inputCls}
            />
          </div>
          <div className="md:col-span-3">
            <label className={labelCls} htmlFor="nm-phase">
              Fase
            </label>
            <select
              id="nm-phase"
              name="phase"
              defaultValue=""
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
            <label className={labelCls} htmlFor="nm-desc">
              Descrição (o cliente vê isso quando publicado)
            </label>
            <input
              id="nm-desc"
              name="description"
              placeholder="O que foi concluído nesta etapa"
              className={inputCls}
            />
          </div>
        </div>

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
            Arraste as primeiras fotos aqui (opcional)
          </p>
          <p className="text-xs text-muted">
            Já anexa ao marco no mesmo passo — comprimidas automaticamente
            antes do envio
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

        <SubmitButton
          count={pending.length}
          label="Criar marco"
          variant="primary"
        />
      </form>
    </Card>
  );
}
