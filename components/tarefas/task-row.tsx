"use client";

import { useState } from "react";
import { Trash2, Pencil } from "lucide-react";
import {
  Card,
  Badge,
  inputCls,
  labelCls,
  btnPrimary,
  btnGhost,
} from "@/components/ui";
import { dateBR, isOverdue } from "@/lib/format";
import type { TaskWithSpace } from "@/lib/database.types";

const PRIORITY_TONE = {
  alta: "danger",
  media: "warn",
  baixa: "neutral",
} as const;

const SPACE_LABEL: Record<string, string> = {
  devpaulo: "devpaulo",
  iservice: "iService",
  pessoal: "Pessoal",
};

export function TaskRow({
  task,
  onToggle,
  onUpdate,
  onDelete,
}: {
  task: TaskWithSpace;
  onToggle: (formData: FormData) => void;
  onUpdate: (formData: FormData) => void;
  onDelete: (formData: FormData) => void;
}) {
  const [editing, setEditing] = useState(false);
  const overdue = isOverdue(task.due_date) && !task.done;

  if (editing) {
    return (
      <Card className="p-4">
        <form
          action={async (formData) => {
            await onUpdate(formData);
            setEditing(false);
          }}
          className="grid grid-cols-2 gap-3 md:grid-cols-12"
        >
          <input type="hidden" name="id" value={task.id} />
          <div className="col-span-2 md:col-span-4">
            <label className={labelCls} htmlFor={`et-title-${task.id}`}>
              Título
            </label>
            <input
              id={`et-title-${task.id}`}
              name="title"
              required
              defaultValue={task.title}
              className={inputCls}
            />
          </div>
          <div className="md:col-span-2">
            <label className={labelCls} htmlFor={`et-cat-${task.id}`}>
              Categoria
            </label>
            <select
              id={`et-cat-${task.id}`}
              name="category"
              defaultValue={task.category}
              className={inputCls}
            >
              <option value="entrega">entrega</option>
              <option value="financeiro">financeiro</option>
              <option value="marketing">marketing</option>
              <option value="comercial">comercial</option>
              <option value="operacional">operacional</option>
              <option value="relacionamento">relacionamento</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label className={labelCls} htmlFor={`et-pri-${task.id}`}>
              Prioridade
            </label>
            <select
              id={`et-pri-${task.id}`}
              name="priority"
              defaultValue={task.priority}
              className={inputCls}
            >
              <option value="alta">alta</option>
              <option value="media">média</option>
              <option value="baixa">baixa</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label className={labelCls} htmlFor={`et-due-${task.id}`}>
              Prazo
            </label>
            <input
              id={`et-due-${task.id}`}
              name="due_date"
              type="date"
              defaultValue={task.due_date ?? ""}
              className={inputCls}
            />
          </div>
          <div className="col-span-2 md:col-span-12">
            <label className={labelCls} htmlFor={`et-note-${task.id}`}>
              Nota
            </label>
            <input
              id={`et-note-${task.id}`}
              name="note"
              defaultValue={task.note ?? ""}
              placeholder="opcional"
              className={inputCls}
            />
          </div>
          <div className="col-span-2 flex gap-2 md:col-span-12">
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
      </Card>
    );
  }

  return (
    <Card className={`group flex items-start gap-3 p-4 ${task.done ? "opacity-55" : ""}`}>
      <form action={onToggle} className="pt-0.5">
        <input type="hidden" name="id" value={task.id} />
        <input type="hidden" name="done" value={String(task.done)} />
        <button
          type="submit"
          aria-label={task.done ? "Reabrir tarefa" : "Concluir tarefa"}
          className={`flex h-5 w-5 items-center justify-center rounded-md border text-xs font-bold transition ${
            task.done
              ? "border-primary bg-primary text-white"
              : "border-border hover:border-primary"
          }`}
        >
          {task.done ? "✓" : ""}
        </button>
      </form>

      <div className="min-w-0 flex-1">
        <p className={`font-semibold ${task.done ? "line-through" : ""}`}>
          {task.title}
        </p>
        {task.note && <p className="mt-0.5 text-sm text-muted">{task.note}</p>}
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <Badge tone={PRIORITY_TONE[task.priority]}>{task.priority}</Badge>
          <Badge>{task.category}</Badge>
          {task.spaces && (
            <Badge tone="graphite">
              {SPACE_LABEL[task.spaces.slug] ?? task.spaces.slug}
            </Badge>
          )}
          {task.legacy_client_slug && (
            <Badge tone="green">{task.legacy_client_slug}</Badge>
          )}
          <span
            className={`ml-1 text-xs ${overdue ? "font-semibold text-danger" : "text-muted"}`}
          >
            {overdue ? "atrasada · " : ""}
            {dateBR(task.due_date)}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => setEditing(true)}
          aria-label="Editar tarefa"
          className="rounded-lg p-1.5 text-muted/40 opacity-0 transition group-hover:opacity-100 hover:bg-background hover:text-foreground"
        >
          <Pencil size={15} />
        </button>
        <form action={onDelete}>
          <input type="hidden" name="id" value={task.id} />
          <button
            type="submit"
            aria-label="Excluir tarefa"
            className="rounded-lg p-1.5 text-muted/40 opacity-0 transition group-hover:opacity-100 hover:bg-danger-soft hover:text-danger"
          >
            <Trash2 size={15} />
          </button>
        </form>
      </div>
    </Card>
  );
}
