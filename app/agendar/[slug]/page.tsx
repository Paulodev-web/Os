import Image from "next/image";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { SlotPicker } from "@/components/agendar/slot-picker";
import type { BookingSlotDay } from "@/lib/database.types";
import type { Bloqueio } from "@/lib/booking-slots";

export const dynamic = "force-dynamic";

/* Página pública de agendamento — sem login, mesmo padrão de app/c/[token]:
   anon key + RPC security-definer, que já decide o que pode ser exposto. */

interface PublicBookingLink {
  title: string;
  description: string | null;
  duration_minutes: number;
  slots: BookingSlotDay[];
  ocupados: string[];
  bloqueios: Bloqueio[];
}

async function fetchLink(slug: string): Promise<PublicBookingLink | null> {
  const supabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { db: { schema: "os_pessoal" }, auth: { persistSession: false } }
  );
  const { data, error } = await supabase.rpc("public_booking_link", {
    p_slug: slug,
  });
  if (error || !data) return null;
  return data as PublicBookingLink;
}

export default async function AgendarPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const link = await fetchLink(slug);

  if (!link) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center">
        <Image
          src="/logo/devpaulo.png"
          alt="devpaulo"
          width={64}
          height={64}
        />
        <h1 className="mt-4 text-xl font-black">Link não encontrado</h1>
        <p className="mt-2 max-w-sm text-sm text-muted">
          Este link de agendamento não existe ou foi desativado. Fale com
          contato@devpaulo.com.br.
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-6 py-5">
          <Image
            src="/logo/devpaulo.png"
            alt="devpaulo"
            width={40}
            height={40}
          />
          <div>
            <span className="flex items-baseline gap-1 text-lg font-black tracking-tight">
              devpaulo
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            </span>
            <p className="text-xs font-light text-muted">Agendar horário</p>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-6 py-10">
        <h1 className="text-2xl font-black tracking-tight">{link.title}</h1>
        {link.description && (
          <p className="mt-2 text-muted">{link.description}</p>
        )}
        <p className="mt-1 text-xs text-muted">
          {link.duration_minutes} minutos
        </p>

        <div className="mt-8">
          <SlotPicker slug={slug} link={link} />
        </div>
      </div>

      <footer className="mt-16 bg-graphite">
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-1 px-6 py-8 text-center">
          <span className="text-lg font-black tracking-tight text-white">
            devpaulo
            <span className="ml-0.5 inline-block h-1.5 w-1.5 rounded-full bg-primary-soft" />
          </span>
          <p className="text-xs font-light text-white/50">
            Software sob medida — contato@devpaulo.com.br
          </p>
        </div>
      </footer>
    </main>
  );
}
