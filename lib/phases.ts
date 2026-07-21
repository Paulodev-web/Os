// Taxonomia fixa de fases do projeto — fonte única (ordem, chave, rótulo).
// Usada no stepper do portal, no select de fase do marco e nas configs do projeto.

export const PROJECT_PHASES = [
  { key: "descoberta", label: "Diagnóstico / Descoberta" },
  { key: "escopo", label: "Escopo & Proposta aprovada" },
  { key: "design", label: "Design / Arquitetura" },
  { key: "desenvolvimento", label: "Desenvolvimento" },
  { key: "qa", label: "QA / Ajustes" },
  { key: "entrega", label: "Entrega / Go-live" },
  { key: "pos_entrega", label: "Pós-entrega" },
] as const;

export type ProjectPhaseKey = (typeof PROJECT_PHASES)[number]["key"];

export const PHASE_LABEL: Record<ProjectPhaseKey, string> = Object.fromEntries(
  PROJECT_PHASES.map((p) => [p.key, p.label])
) as Record<ProjectPhaseKey, string>;

export function phaseIndex(phase: string | null | undefined): number {
  if (!phase) return -1;
  return PROJECT_PHASES.findIndex((p) => p.key === phase);
}
