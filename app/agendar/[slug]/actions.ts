"use server";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export interface CriarAgendamentoResult {
  ok: boolean;
  meetingId?: string;
  reason?: string;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/* Rota pública por natureza — sem requireUser(). Usa anon key + RPC
   security-definer, mesmo padrão de app/c/[token]/page.tsx. */
export async function criarAgendamento(input: {
  slug: string;
  date: string;
  time: string;
  clientName: string;
  clientContact: string;
}): Promise<CriarAgendamentoResult> {
  const { slug, date, time, clientName, clientContact } = input;
  if (!slug || !clientName.trim() || !DATE_RE.test(date) || !TIME_RE.test(time)) {
    return { ok: false, reason: "invalid_input" };
  }

  const supabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { db: { schema: "os_pessoal" }, auth: { persistSession: false } }
  );

  const { data, error } = await supabase.rpc("criar_agendamento", {
    p_slug: slug,
    p_date: date,
    p_time: time,
    p_client_name: clientName.trim(),
    p_client_contact: clientContact.trim() || null,
  });

  if (error) return { ok: false, reason: "server_error" };
  const result = data as { ok: boolean; reason?: string; meeting_id?: string };
  if (!result.ok) return { ok: false, reason: result.reason };
  return { ok: true, meetingId: result.meeting_id };
}
