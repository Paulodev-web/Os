import Link from "next/link";
import { Plus, Trash2, Ban, ArrowLeft, AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import type { BookingLink, BookingBlock, Space } from "@/lib/database.types";
import {
  Card,
  PageHeader,
  Badge,
  EmptyState,
  inputCls,
  labelCls,
  btnPrimary,
  btnGhost,
} from "@/components/ui";
import { MEETING_TYPE_LABEL } from "@/lib/labels";
import { CopyAgendarLink } from "@/components/copy-agendar-link";
import { dateBR } from "@/lib/format";
import {
  createBookingLink,
  toggleBookingLinkActive,
  deleteBookingLink,
  createBlock,
  deleteBlock,
} from "./actions";

export const dynamic = "force-dynamic";

export default async function AgendamentoPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  const { erro } = await searchParams;
  const supabase = await createClient();

  const [{ data: linksData }, { data: blocksData }, { data: spacesData }] =
    await Promise.all([
      supabase
        .from("booking_links")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase
        .from("booking_blocks")
        .select("*")
        .order("date", { ascending: true }),
      supabase.from("spaces").select("*").order("slug"),
    ]);

  const links = (linksData ?? []) as BookingLink[];
  const blocks = (blocksData ?? []) as BookingBlock[];
  const spaces = (spacesData ?? []) as Space[];
  const devpauloSpace = spaces.find((s) => s.slug === "devpaulo");

  return (
    <>
      <Link
        href="/reunioes"
        className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-primary"
      >
        <ArrowLeft size={14} /> Reuniões
      </Link>

      {erro && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-danger/30 bg-danger-soft px-4 py-3 text-sm font-semibold text-danger">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          {erro}
        </div>
      )}

      <PageHeader
        title="Agendamento"
        subtitle="Links públicos pra lead/cliente marcar horário — cai direto em Reuniões"
      />

      {/* Novo link */}
      <Card className="mb-6 p-4">
        <form
          action={createBookingLink}
          className="grid grid-cols-2 gap-3 md:grid-cols-12"
        >
          <div className="col-span-2 md:col-span-4">
            <label className={labelCls} htmlFor="bl-title">
              Novo link
            </label>
            <input
              id="bl-title"
              name="title"
              required
              placeholder="ex: Diagnóstico inicial"
              className={inputCls}
            />
          </div>
          <div className="col-span-2 md:col-span-4">
            <label className={labelCls} htmlFor="bl-desc">
              Descrição
            </label>
            <input
              id="bl-desc"
              name="description"
              placeholder="opcional"
              className={inputCls}
            />
          </div>
          <div className="md:col-span-2">
            <label className={labelCls} htmlFor="bl-duration">
              Duração (min)
            </label>
            <input
              id="bl-duration"
              name="duration_minutes"
              type="number"
              defaultValue={60}
              min={5}
              className={inputCls}
            />
          </div>
          <div className="md:col-span-2">
            <label className={labelCls} htmlFor="bl-type">
              Tipo
            </label>
            <select
              id="bl-type"
              name="meeting_type"
              defaultValue="comercial"
              className={inputCls}
            >
              {Object.entries(MEETING_TYPE_LABEL).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </div>
          <input type="hidden" name="space_id" value={devpauloSpace?.id ?? ""} />
          <div className="col-span-2 flex items-end justify-end md:col-span-12">
            <button type="submit" className={btnPrimary}>
              <Plus size={16} /> Criar link
            </button>
          </div>
        </form>
      </Card>

      {links.length === 0 ? (
        <EmptyState
          title="Nenhum link de agendamento ainda"
          hint="Crie o primeiro acima."
        />
      ) : (
        <ul className="mb-10 space-y-2">
          {links.map((link) => (
            <li key={link.id}>
              <Card className="flex flex-wrap items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/reunioes/agendamento/${link.id}`}
                    className="font-semibold hover:text-primary"
                  >
                    {link.title}
                  </Link>
                  <p className="text-xs text-muted">
                    {link.duration_minutes} min ·{" "}
                    {MEETING_TYPE_LABEL[link.meeting_type] ?? link.meeting_type} ·{" "}
                    {link.slots.reduce((sum, s) => sum + s.times.length, 0)}{" "}
                    horário(s) cadastrado(s)
                  </p>
                </div>
                <Badge tone={link.active ? "green" : "neutral"}>
                  {link.active ? "ativo" : "inativo"}
                </Badge>
                <CopyAgendarLink slug={link.slug} />
                <form action={toggleBookingLinkActive}>
                  <input type="hidden" name="id" value={link.id} />
                  <input
                    type="hidden"
                    name="active"
                    value={String(!link.active)}
                  />
                  <button type="submit" className={btnGhost}>
                    {link.active ? "Desativar" : "Ativar"}
                  </button>
                </form>
                <form action={deleteBookingLink}>
                  <input type="hidden" name="id" value={link.id} />
                  <button
                    type="submit"
                    aria-label="Excluir link"
                    className={`${btnGhost} hover:!bg-danger-soft hover:!text-danger`}
                  >
                    <Trash2 size={15} />
                  </button>
                </form>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {/* Bloqueios */}
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted">
        <Ban size={15} className="text-primary" /> Bloqueios de horário
      </h2>
      <Card className="mb-4 p-4">
        <form
          action={createBlock}
          className="grid grid-cols-2 gap-3 md:grid-cols-12"
        >
          <div className="col-span-2 md:col-span-4">
            <label className={labelCls} htmlFor="bk-title">
              Motivo
            </label>
            <input
              id="bk-title"
              name="title"
              required
              placeholder="ex: Viagem"
              className={inputCls}
            />
          </div>
          <div className="md:col-span-3">
            <label className={labelCls} htmlFor="bk-date">
              Data
            </label>
            <input
              id="bk-date"
              name="date"
              type="date"
              required
              className={inputCls}
            />
          </div>
          <div className="md:col-span-2">
            <label className={labelCls} htmlFor="bk-start">
              Início
            </label>
            <input
              id="bk-start"
              name="start_time"
              type="time"
              required
              className={inputCls}
            />
          </div>
          <div className="md:col-span-2">
            <label className={labelCls} htmlFor="bk-end">
              Fim
            </label>
            <input
              id="bk-end"
              name="end_time"
              type="time"
              required
              className={inputCls}
            />
          </div>
          <div className="col-span-2 flex items-end md:col-span-1">
            <button type="submit" className={`${btnPrimary} w-full`}>
              <Plus size={15} />
            </button>
          </div>
        </form>
      </Card>

      {blocks.length === 0 ? (
        <p className="text-sm text-muted">Nenhum bloqueio cadastrado.</p>
      ) : (
        <ul className="space-y-2">
          {blocks.map((b) => (
            <li key={b.id}>
              <Card className="flex flex-wrap items-center gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{b.title}</p>
                  <p className="text-xs text-muted">
                    {dateBR(b.date)} · {b.start_time.slice(0, 5)}–
                    {b.end_time.slice(0, 5)}
                  </p>
                </div>
                <form action={deleteBlock}>
                  <input type="hidden" name="id" value={b.id} />
                  <button
                    type="submit"
                    aria-label="Excluir bloqueio"
                    className={`${btnGhost} hover:!bg-danger-soft hover:!text-danger`}
                  >
                    <Trash2 size={15} />
                  </button>
                </form>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
