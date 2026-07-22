import { NextResponse } from "next/server";
import { adminConfigurado, createAdminClient } from "@/lib/supabase/admin";
import { executarBriefingDiario } from "@/lib/briefing";
import { prepararReunioesDoDia } from "@/lib/prep";
import { geminiConfigurado } from "@/lib/gemini";

/* Cron da Vercel (vercel.json) — roda 1x/dia às 06:00 de São Paulo.
   Plano Hobby = 1 cron/dia, então este handler acumula as rotinas diárias:
   briefing + alertas + prep automático das reuniões do dia.
   Protegido por CRON_SECRET (a Vercel envia Authorization: Bearer <secret>). */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET não configurada" },
      { status: 503 }
    );
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }

  if (!adminConfigurado()) {
    return NextResponse.json(
      {
        error:
          "SUPABASE_SERVICE_ROLE_KEY não configurada — briefing automático indisponível.",
      },
      { status: 503 }
    );
  }

  try {
    const admin = createAdminClient();
    const resultado = await executarBriefingDiario(admin);
    const preps = geminiConfigurado() ? await prepararReunioesDoDia(admin) : 0;
    return NextResponse.json({ ok: true, ...resultado, preps_gerados: preps });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "erro desconhecido";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
