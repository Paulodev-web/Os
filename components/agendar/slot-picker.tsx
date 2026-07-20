"use client";

import { useMemo, useState } from "react";
import { filtrarSlotsDisponiveis, type Bloqueio } from "@/lib/booking-slots";
import { dateBR } from "@/lib/format";
import { Card, inputCls, btnPrimary, btnSecondary } from "@/components/ui";
import { criarAgendamento } from "@/app/agendar/[slug]/actions";
import type { BookingSlotDay } from "@/lib/database.types";

interface LinkData {
  duration_minutes: number;
  slots: BookingSlotDay[];
  ocupados: string[];
  bloqueios: Bloqueio[];
}

export function SlotPicker({ slug, link }: { slug: string; link: LinkData }) {
  const base = useMemo(
    () =>
      filtrarSlotsDisponiveis(
        link.slots,
        link.duration_minutes,
        link.ocupados,
        link.bloqueios
      ),
    [link]
  );

  const [selected, setSelected] = useState<{ date: string; time: string } | null>(
    null
  );
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error" | "done">(
    "idle"
  );
  const [error, setError] = useState("");
  const [confirmed, setConfirmed] = useState<{ date: string; time: string } | null>(
    null
  );
  const [taken, setTaken] = useState<Set<string>>(new Set());

  const visiveis = base
    .map((d) => ({
      ...d,
      times: d.times.filter((t) => !taken.has(`${d.date}T${t}`)),
    }))
    .filter((d) => d.times.length > 0);

  async function handleConfirm() {
    if (!selected || !name.trim()) return;
    setStatus("loading");
    setError("");
    const result = await criarAgendamento({
      slug,
      date: selected.date,
      time: selected.time,
      clientName: name,
      clientContact: contact,
    });
    if (!result.ok) {
      if (result.reason === "slot_taken") {
        setTaken((prev) => new Set(prev).add(`${selected.date}T${selected.time}`));
        setError(
          "Esse horário acabou de ser reservado por outra pessoa — escolha outro."
        );
        setSelected(null);
      } else {
        setError("Não foi possível confirmar o agendamento. Tente de novo.");
      }
      setStatus("error");
      return;
    }
    setConfirmed(selected);
    setStatus("done");
  }

  if (status === "done" && confirmed) {
    return (
      <Card className="p-6 text-center">
        <p className="text-lg font-black">Agendado! ✓</p>
        <p className="mt-2 text-sm text-muted">
          {dateBR(confirmed.date)} às {confirmed.time} — te espero por lá.
        </p>
      </Card>
    );
  }

  if (visiveis.length === 0) {
    return (
      <Card className="p-6 text-center text-sm text-muted">
        Nenhum horário disponível no momento. Fale com contato@devpaulo.com.br.
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm font-semibold text-danger">
          {error}
        </p>
      )}

      {!selected ? (
        <ul className="space-y-3">
          {visiveis.map((day) => (
            <li key={day.date}>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
                {dateBR(day.date)}
              </p>
              <div className="flex flex-wrap gap-2">
                {day.times.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setSelected({ date: day.date, time: t })}
                    className={btnSecondary}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <Card className="p-4">
          <p className="text-sm text-muted">
            Horário escolhido:{" "}
            <strong className="text-foreground">
              {dateBR(selected.date)} às {selected.time}
            </strong>
          </p>
          <div className="mt-3 space-y-3">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Seu nome"
              required
              className={inputCls}
            />
            <input
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder="WhatsApp ou email"
              className={inputCls}
            />
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleConfirm}
                disabled={status === "loading" || !name.trim()}
                className={btnPrimary}
              >
                {status === "loading" ? "Confirmando…" : "Confirmar agendamento"}
              </button>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className={btnSecondary}
              >
                Escolher outro horário
              </button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
