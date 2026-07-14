// Tipos do schema os_pessoal (Fase 1 — manter em dia conforme as migrations evoluírem)

export type TaskCategory =
  | "entrega"
  | "financeiro"
  | "marketing"
  | "comercial"
  | "operacional"
  | "relacionamento";

export type TaskPriority = "alta" | "media" | "baixa";
export type TaskSource = "manual" | "ia" | "import";
export type SpaceSlug = "devpaulo" | "iservice" | "pessoal";

export interface Space {
  id: string;
  slug: SpaceSlug;
  name: string;
  created_at: string;
}

export interface Task {
  id: string;
  space_id: string;
  title: string;
  category: TaskCategory;
  priority: TaskPriority;
  due_date: string | null;
  done: boolean;
  source: TaskSource;
  note: string | null;
  legacy_client_slug: string | null;
  related_entity_type: string | null;
  related_entity_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaskWithSpace extends Task {
  spaces: Pick<Space, "slug" | "name"> | null;
}
