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
