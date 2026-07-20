import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, AlertTriangle, Save } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import type { BookingLink } from "@/lib/database.types";
import {
  Card,
  PageHeader,
  Badge,
  inputCls,
  labelCls,
  btnPrimary,
} from "@/components/ui";
import { MEETING_TYPE_LABEL } from "@/lib/labels";
import { CopyAgendarLink } from "@/components/copy-agendar-link";
import { SlotBuilder } from "@/components/agendar-admin/slot-builder";
import { updateBookingLink } from "../actions";

export const dynamic = "force-dynamic";

export default async function BookingLinkPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ erro?: string }>;
}) {
  const { id } = await params;
  const { erro } = await searchParams;
  const supabase = await createClient();

  const { data } = await supabase
    .from("booking_links")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();
  const link = data as BookingLink;

  return (
    <>
      <Link
        href="/reunioes/agendamento"
        className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-primary"
      >
        <ArrowLeft size={14} /> Agendamento
      </Link>

      {erro && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-danger/30 bg-danger-soft px-4 py-3 text-sm font-semibold text-danger">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          {erro}
        </div>
      )}

      <PageHeader
        title={link.title}
        subtitle={
          <span className="flex items-center gap-2">
            <Badge tone={link.active ? "green" : "neutral"}>
              {link.active ? "ativo" : "inativo"}
            </Badge>
          </span>
        }
        action={<CopyAgendarLink slug={link.slug} />}
      />

      <form action={updateBookingLink} className="space-y-6">
        <input type="hidden" name="id" value={link.id} />

        <Card className="p-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
            <div className="md:col-span-6">
              <label className={labelCls} htmlFor="bl-title">
                Título
              </label>
              <input
                id="bl-title"
                name="title"
                required
                defaultValue={link.title}
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
                min={5}
                required
                defaultValue={link.duration_minutes}
                className={inputCls}
              />
            </div>
            <div className="md:col-span-4">
              <label className={labelCls} htmlFor="bl-type">
                Tipo
              </label>
              <select
                id="bl-type"
                name="meeting_type"
                defaultValue={link.meeting_type}
                className={inputCls}
              >
                {Object.entries(MEETING_TYPE_LABEL).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-12">
              <label className={labelCls} htmlFor="bl-desc">
                Descrição (o lead/cliente vê isso na página pública)
              </label>
              <input
                id="bl-desc"
                name="description"
                defaultValue={link.description ?? ""}
                className={inputCls}
              />
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
            Horários disponíveis
          </h2>
          <SlotBuilder name="slots" defaultValue={link.slots} />
        </Card>

        <button type="submit" className={btnPrimary}>
          <Save size={16} /> Salvar
        </button>
      </form>
    </>
  );
}
