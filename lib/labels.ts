// Rótulos compartilhados (enum do banco → texto de UI)

export const PROJECT_STATUS_LABEL: Record<string, string> = {
  em_andamento: "em andamento",
  entregue: "entregue",
  pausado: "pausado",
  arquivado: "arquivado",
};

export const LEAD_STAGE_LABEL: Record<string, string> = {
  novo: "Novo",
  diagnostico_agendado: "Diagnóstico agendado",
  proposta_enviada: "Proposta enviada",
  follow_up: "Follow-up",
  fechado: "Fechado",
  perdido: "Perdido",
};

export const MEETING_TYPE_LABEL: Record<string, string> = {
  diagnostico: "Diagnóstico",
  alinhamento: "Alinhamento",
  comercial: "Comercial",
  interna: "Interna",
  outro: "Outro",
};

export const MEETING_STATUS_LABEL: Record<string, string> = {
  agendada: "Agendada",
  realizada: "Realizada",
  cancelada: "Cancelada",
};

export const SPACE_LABEL: Record<string, string> = {
  devpaulo: "devpaulo",
  iservice: "iService",
  pessoal: "Pessoal",
};

export const ROADMAP_PHASE_LABEL: Record<string, string> = {
  naming: "Naming",
  mvp: "MVP",
  beta: "Beta",
  lancamento: "Lançamento",
};
