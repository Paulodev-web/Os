// Tipos do schema os_pessoal — manter em dia conforme as migrations evoluírem

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

// ===== Fase 2 — Portal =====
export interface Client {
  id: string;
  slug: string;
  name: string;
  contact: string | null;
  segment: string | null;
  portal_token: string;
  notes: string | null;
  created_at: string;
}

export type ProjectStatus = "em_andamento" | "entregue" | "pausado" | "arquivado";

export interface Project {
  id: string;
  client_id: string;
  name: string;
  status: ProjectStatus;
  description: string | null;
  started_at: string | null;
  created_at: string;
}

export interface Milestone {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  published: boolean;
  published_at: string | null;
  created_from_meeting_id: string | null;
  created_at: string;
}

export type AssetType = "imagem" | "documento" | "link" | "video" | "outro";

export interface ProjectAsset {
  id: string;
  project_id: string;
  milestone_id: string | null;
  type: AssetType;
  title: string | null;
  storage_path: string | null;
  external_url: string | null;
  created_at: string;
}

// ===== Fase 3 — Reuniões =====
export type MeetingType =
  | "diagnostico"
  | "alinhamento"
  | "comercial"
  | "interna"
  | "outro";
export type MeetingStatus = "agendada" | "realizada" | "cancelada";
export type MeetingSource = "manual" | "reunicheck" | "ia" | "os_pessoal";

export interface Meeting {
  id: string;
  space_id: string;
  title: string;
  type: MeetingType;
  scheduled_at: string;
  status: MeetingStatus;
  source: MeetingSource;
  related_entity_type: "project" | "lead" | "client" | null;
  related_entity_id: string | null;
  booking_link_id: string | null;
  client_name: string | null;
  client_contact: string | null;
  duration_minutes: number | null;
  prep: MeetingPrep | null;
  prep_generated_at: string | null;
  raw_notes: string | null;
  structured_notes: StructuredNotes | null;
  created_at: string;
  updated_at: string;
}

// ===== Agendamento nativo (substitui o ReuniCheck) =====
export interface BookingSlotDay {
  date: string;
  times: string[];
}

export interface BookingLink {
  id: string;
  slug: string;
  space_id: string;
  title: string;
  description: string | null;
  duration_minutes: number;
  meeting_type: MeetingType;
  slots: BookingSlotDay[];
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface BookingBlock {
  id: string;
  title: string;
  date: string;
  start_time: string;
  end_time: string;
  created_at: string;
}

export interface MeetingPrep {
  objetivo: string;
  contexto: string[];
  perguntas: string[];
  alertas: string[];
}

export interface StructuredNotes {
  resumo: string;
  decisoes: string[];
  proximos_passos: string[];
  tarefas_extraidas: { titulo: string; categoria: TaskCategory; prazo: string | null }[];
  sugestao_marco: { titulo: string; descricao: string } | null;
}

// ===== Fase 4 — Comercial =====
export type LeadStage =
  | "novo"
  | "diagnostico_agendado"
  | "proposta_enviada"
  | "follow_up"
  | "fechado"
  | "perdido";

export interface Lead {
  id: string;
  name: string;
  segment: string | null;
  stage: LeadStage;
  contact: string | null;
  next_action: string | null;
  next_action_date: string | null;
  notes: string | null;
  client_id: string | null;
  created_at: string;
  updated_at: string;
}

export type ProposalStatus = "rascunho" | "enviada" | "aceita" | "recusada";

export interface Proposal {
  id: string;
  lead_id: string | null;
  client_id: string | null;
  title: string;
  value: number;
  status: ProposalStatus;
  sent_at: string | null;
  doc_url: string | null;
  notes: string | null;
  created_at: string;
}

// ===== Fase 5 — Hub =====
export interface DailyBriefing {
  id: string;
  date: string;
  summary: BriefingSummary;
  narrative: string | null;
  generated_by: "ia" | "fallback";
  created_at: string;
}

export interface BriefingSummary {
  tarefas_atrasadas: number;
  tarefas_hoje: number;
  reunioes_hoje: { titulo: string; horario: string }[];
  leads_sem_proxima_acao: number;
  followups_atrasados: number;
  treino_ontem: boolean;
  dieta_ontem_kcal: number | null;
  destaque: string | null;
}

export type AlertSeverity = "info" | "atencao" | "critico";
export type AlertStatus = "aberto" | "resolvido" | "dispensado";

export interface Alert {
  id: string;
  space_id: string;
  type: string;
  severity: AlertSeverity;
  message: string;
  related_entity_type: string | null;
  related_entity_id: string | null;
  status: AlertStatus;
  created_at: string;
}

// ===== Fase 6 — Treino/Dieta =====
export interface Exercicio {
  id: string;
  nome: string;
  grupo_muscular_primario: string;
  grupos_secundarios: string[];
}

export interface TreinoPlano {
  id: string;
  nome: string;
  ativo: boolean;
  frequencia_semanal_alvo: number | null;
}

export interface TreinoDia {
  id: string;
  plano_id: string;
  nome: string;
  ordem: number;
}

export interface FichaItem {
  id: string;
  dia_id: string;
  exercicio_id: string;
  ordem: number;
  series_alvo: number;
  reps_alvo_min: number | null;
  reps_alvo_max: number | null;
  carga_alvo: number | null;
  ativo: boolean;
  substituiu_item_id: string | null;
}

export interface TreinoSessao {
  id: string;
  data: string;
  dia_id: string | null;
  observacoes: string | null;
}

export interface SerieRegistrada {
  id: string;
  sessao_id: string;
  exercicio_id: string;
  serie_num: number;
  reps: number;
  carga: number;
  rpe: number | null;
  created_at: string;
}

export interface Alimento {
  id: string;
  nome: string;
  kcal_100g: number;
  proteina_100g: number;
  carbo_100g: number;
  gordura_100g: number;
}

export interface DietaMeta {
  id: string;
  vigente_desde: string;
  kcal_alvo: number;
  proteina_alvo: number;
  carbo_alvo: number;
  gordura_alvo: number;
}

export interface DietaRegistro {
  id: string;
  data: string;
  refeicao_nome: string;
  observacao: string | null;
  created_at: string;
}

// ===== Fase 7 — Financeiro =====
export type FinanceOrigin = "devpaulo" | "pessoal" | "iservice";
export type FinanceType = "entrada" | "saida";

export interface FinanceEntry {
  id: string;
  origin: FinanceOrigin;
  type: FinanceType;
  category: string;
  description: string | null;
  amount: number;
  date: string;
  transfer_group_id: string | null;
  related_entity_type: string | null;
  related_entity_id: string | null;
  created_at: string;
}

// ===== Fase 8 — iService =====
export type DecisionStatus = "aberta" | "decidida" | "arquivada";

export interface StartupDecision {
  id: string;
  topic: string;
  context: string | null;
  options: { nome: string; pros?: string; contras?: string }[];
  status: DecisionStatus;
  decided_option: string | null;
  decided_at: string | null;
  created_at: string;
}

export type RoadmapPhase = "naming" | "mvp" | "beta" | "lancamento";
export type RoadmapStatus = "pendente" | "em_andamento" | "concluido";

export interface RoadmapItem {
  id: string;
  phase: RoadmapPhase;
  title: string;
  status: RoadmapStatus;
  target_date: string | null;
  ordem: number;
}
