const TZ = "America/Sao_Paulo";

export function brl(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Data local de hoje (America/Sao_Paulo) em YYYY-MM-DD */
export function todayISO(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: TZ });
}

/** 'YYYY-MM-DD' → 'DD/MM/YYYY' (sem criar Date — evita bug de fuso) */
export function dateBR(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

/** timestamptz → 'DD/MM às HH:mm' no fuso de SP */
export function dateTimeBR(ts: string | null | undefined): string {
  if (!ts) return "—";
  const d = new Date(ts);
  const date = d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    timeZone: TZ,
  });
  const time = d.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TZ,
  });
  return `${date} às ${time}`;
}

export function isOverdue(iso: string | null | undefined): boolean {
  if (!iso) return false;
  return iso.slice(0, 10) < todayISO();
}

export function num(value: number, digits = 0): string {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export type Periodo = "dia" | "semana" | "mes" | "ano";

export const PERIODO_LABEL: Record<Periodo, string> = {
  dia: "Dia",
  semana: "Semana",
  mes: "Mês",
  ano: "Ano",
};

export function periodoValido(p: string | undefined): Periodo {
  return p === "dia" || p === "semana" || p === "mes" || p === "ano"
    ? p
    : "semana";
}

/** Janela [inicio, fim] (YYYY-MM-DD, inclusiva) do período ancorado em `ref`. */
export function periodoRange(
  periodo: Periodo,
  ref = todayISO()
): { inicio: string; fim: string } {
  const [y, m, d] = ref.split("-").map(Number);
  const base = new Date(Date.UTC(y, m - 1, d, 12)); // meio-dia UTC evita virada de dia
  if (periodo === "dia") return { inicio: ref, fim: ref };
  if (periodo === "semana") {
    const dow = base.getUTCDay();
    const seg = new Date(base);
    seg.setUTCDate(base.getUTCDate() - ((dow + 6) % 7));
    const dom = new Date(seg);
    dom.setUTCDate(seg.getUTCDate() + 6);
    return {
      inicio: seg.toISOString().slice(0, 10),
      fim: dom.toISOString().slice(0, 10),
    };
  }
  if (periodo === "mes") {
    const fim = new Date(Date.UTC(y, m, 0));
    return { inicio: `${ref.slice(0, 7)}-01`, fim: fim.toISOString().slice(0, 10) };
  }
  return { inicio: `${y}-01-01`, fim: `${y}-12-31` };
}
