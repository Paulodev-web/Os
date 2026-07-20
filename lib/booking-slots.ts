import type { BookingSlotDay } from "./database.types";

/* Porte do algoritmo de disponibilidade do ReuniCheck (lib/slots.ts) — mesma
   lógica, nomenclatura EN pra bater com o resto do schema. Sem date-fns-tz:
   Brasil não observa horário de verão desde 2019, então o offset -03:00 fixo
   (mesmo truque já usado em reunioes/actions.ts:createMeeting) é suficiente. */

export interface Bloqueio {
  date: string;
  start_time: string;
  end_time: string;
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function isSlotInPast(date: string, time: string): boolean {
  return new Date(`${date}T${time}:00-03:00`).getTime() < Date.now();
}

function colideComBloqueio(
  date: string,
  time: string,
  durationMinutes: number,
  bloqueios: Bloqueio[]
): boolean {
  const inicioA = toMinutes(time);
  const fimA = inicioA + durationMinutes;

  return bloqueios
    .filter((b) => b.date === date)
    .some((b) => {
      const inicioB = toMinutes(b.start_time.slice(0, 5));
      const fimB = toMinutes(b.end_time.slice(0, 5));
      return inicioA < fimB && fimA > inicioB;
    });
}

/** timestamptz (ISO, qualquer offset) → { date, time } no fuso de SP */
function toLocalDateTime(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  const date = d.toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
  const time = d.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "America/Sao_Paulo",
  });
  return { date, time };
}

/**
 * Slots configurados menos: horários passados, já ocupados (`ocupados`,
 * timestamps ISO de reuniões já agendadas nesse link) e colisão com bloqueio.
 */
export function filtrarSlotsDisponiveis(
  slots: BookingSlotDay[],
  durationMinutes: number,
  ocupados: string[],
  bloqueios: Bloqueio[]
): BookingSlotDay[] {
  const ocupadosSet = new Set(
    ocupados.map((iso) => {
      const { date, time } = toLocalDateTime(iso);
      return `${date}T${time}`;
    })
  );

  return slots
    .map((slot) => ({
      date: slot.date,
      times: slot.times.filter(
        (t) =>
          !ocupadosSet.has(`${slot.date}T${t}`) &&
          !isSlotInPast(slot.date, t) &&
          !colideComBloqueio(slot.date, t, durationMinutes, bloqueios)
      ),
    }))
    .filter((s) => s.times.length > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
}
