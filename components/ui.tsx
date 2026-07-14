import type { ReactNode } from "react";

/* Primitivas do design system — todo componente bebe daqui.
   Nunca usar hex solto nas páginas: só tokens (bg-primary, text-muted, …). */

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-border bg-surface shadow-card ${className}`}
    >
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-black tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}

type BadgeTone =
  | "green"
  | "neutral"
  | "warn"
  | "danger"
  | "info"
  | "graphite";

const BADGE_TONES: Record<BadgeTone, string> = {
  green: "bg-primary-soft text-primary-dark",
  neutral: "bg-background text-muted border border-border",
  warn: "bg-warn-soft text-warn",
  danger: "bg-danger-soft text-danger",
  info: "bg-info-soft text-info",
  graphite: "bg-graphite text-white",
};

export function Badge({
  children,
  tone = "neutral",
  className = "",
}: {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ${BADGE_TONES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

/* Classes utilitárias compartilhadas (forms e botões) */
export const inputCls =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 placeholder:text-muted/60";

export const btnPrimary =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-50 disabled:cursor-not-allowed";

export const btnSecondary =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-surface px-4 py-2 text-sm font-semibold text-foreground transition hover:border-primary/40 hover:text-primary-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:opacity-50";

export const btnGhost =
  "inline-flex items-center justify-center gap-1 rounded-lg px-2.5 py-1.5 text-sm font-semibold text-muted transition hover:bg-background hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:opacity-50";

export const labelCls = "block text-xs font-semibold text-muted mb-1.5";

export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface/60 px-6 py-12 text-center">
      <p className="font-semibold text-foreground">{title}</p>
      {hint && <p className="mt-1 max-w-md text-sm text-muted">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Stat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  tone?: "default" | "positive" | "negative";
}) {
  const toneCls =
    tone === "positive"
      ? "text-primary-dark"
      : tone === "negative"
        ? "text-danger"
        : "text-foreground";
  return (
    <Card className="px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">
        {label}
      </p>
      <p className={`mt-1 text-xl font-black tabular-nums ${toneCls}`}>
        {value}
      </p>
    </Card>
  );
}
