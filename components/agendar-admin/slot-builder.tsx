"use client";

import { useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { inputCls, btnSecondary } from "@/components/ui";
import { dateBR } from "@/lib/format";
import type { BookingSlotDay } from "@/lib/database.types";

/* Sem calendário mensal com modal (o ReuniCheck usa date-fns + Dialog, que não
   existem neste repo) — troca por lista de dia→horários com inputs nativos de
   date/time, no mesmo estilo de formulário simples usado no resto do painel. */

export function SlotBuilder({
  name,
  defaultValue,
}: {
  name: string;
  defaultValue: BookingSlotDay[];
}) {
  const [slots, setSlots] = useState<BookingSlotDay[]>(defaultValue);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("09:00");

  function addTime() {
    if (!date || !time) return;
    setSlots((prev) => {
      const next = [...prev];
      const idx = next.findIndex((d) => d.date === date);
      if (idx === -1) {
        next.push({ date, times: [time] });
      } else if (!next[idx].times.includes(time)) {
        next[idx] = { ...next[idx], times: [...next[idx].times, time].sort() };
      }
      return next.sort((a, b) => a.date.localeCompare(b.date));
    });
  }

  function removeTime(d: string, t: string) {
    setSlots((prev) =>
      prev
        .map((day) =>
          day.date === d
            ? { ...day, times: day.times.filter((x) => x !== t) }
            : day
        )
        .filter((day) => day.times.length > 0)
    );
  }

  function removeDay(d: string) {
    setSlots((prev) => prev.filter((day) => day.date !== d));
  }

  return (
    <div className="space-y-3">
      <input type="hidden" name={name} value={JSON.stringify(slots)} />

      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label className="mb-1 block text-xs font-semibold text-muted">
            Data
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={`${inputCls} !w-auto`}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-muted">
            Horário
          </label>
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className={`${inputCls} !w-auto`}
          />
        </div>
        <button type="button" onClick={addTime} className={btnSecondary}>
          <Plus size={14} /> Adicionar horário
        </button>
      </div>

      {slots.length === 0 ? (
        <p className="text-sm text-muted">Nenhum horário cadastrado ainda.</p>
      ) : (
        <ul className="space-y-2">
          {slots.map((day) => (
            <li
              key={day.date}
              className="rounded-lg border border-border bg-background p-2.5"
            >
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                  {dateBR(day.date)}
                </p>
                <button
                  type="button"
                  onClick={() => removeDay(day.date)}
                  aria-label="Remover dia"
                  className="text-muted/50 hover:text-danger"
                >
                  <Trash2 size={13} />
                </button>
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {day.times.map((t) => (
                  <span
                    key={t}
                    className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-2 py-0.5 text-xs font-semibold text-primary-dark"
                  >
                    {t}
                    <button
                      type="button"
                      onClick={() => removeTime(day.date, t)}
                      aria-label={`Remover horário ${t}`}
                    >
                      <X size={11} />
                    </button>
                  </span>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
