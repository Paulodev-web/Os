import Link from "next/link";
import { Plus, Sparkles, FileText, CalendarClock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import type { Meeting, Space } from "@/lib/database.types";
import {
  Card,
  PageHeader,
  Badge,
  EmptyState,
  inputCls,
  labelCls,
  btnPrimary,
} from "@/components/ui";
import {
  MEETING_TYPE_LABEL,
  MEETING_STATUS_LABEL,
  SPACE_LABEL,
} from "@/lib/labels";
import { dateTimeBR } from "@/lib/format";
import { createMeeting } from "./actions";

export const dynamic = "force-dynamic";

const STATUS_TONE = {
  agendada: "info",
  realizada: "green",
  cancelada: "neutral",
} as const;

export default async function ReunioesPage() {
  const supabase = await createClient();

  const [
    { data: meetingsData, error },
    { data: spacesData },
    { data: projectsData },
    { data: leadsData },
    { data: clientsData },
  ] = await Promise.all([
    supabase
      .from("meetings")
      .select("*")
      .order("scheduled_at", { ascending: false }),
    supabase.from("spaces").select("*").order("slug"),
    supabase
      .from("projects")
      .select("id, name, clients(name)")
      .in("status", ["em_andamento", "pausado"]),
    supabase
      .from("leads")
      .select("id, name")
      .not("stage", "in", "(fechado,perdido)"),
    supabase.from("clients").select("id, name").order("name"),
  ]);

  if (error) throw new Error(`Erro ao carregar reuniões: ${error.message}`);

  const meetings = (meetingsData ?? []) as Meeting[];
  const spaces = (spacesData ?? []) as Space[];
  const projects = (projectsData ?? []) as unknown as {
    id: string;
    name: string;
    clients: { name: string } | null;
  }[];
  const leads = (leadsData ?? []) as { id: string; name: string }[];
  const clients = (clientsData ?? []) as { id: string; name: string }[];

  const agora = new Date().toISOString();
  const proximas = meetings
    .filter((m) => m.status === "agendada" && m.scheduled_at >= agora)
    .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));
  const passadas = meetings.filter(
    (m) => !(m.status === "agendada" && m.scheduled_at >= agora)
  );

  const devpauloSpace = spaces.find((s) => s.slug === "devpaulo");

  function MeetingCard({ m }: { m: Meeting }) {
    return (
      <li>
        <Link href={`/reunioes/${m.id}`}>
          <Card className="p-4 transition hover:border-primary/40">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{m.title}</p>
                <p className="mt-0.5 flex items-center gap-1 text-sm text-muted">
                  <CalendarClock size={13} />
                  {dateTimeBR(m.scheduled_at)} ·{" "}
                  {MEETING_TYPE_LABEL[m.type] ?? m.type}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {m.prep && (
                  <Badge tone="info">
                    <Sparkles size={11} /> prep pronto
                  </Badge>
                )}
                {m.structured_notes && (
                  <Badge tone="green">
                    <FileText size={11} /> ata estruturada
                  </Badge>
                )}
                <Badge tone={STATUS_TONE[m.status]}>
                  {MEETING_STATUS_LABEL[m.status] ?? m.status}
                </Badge>
              </div>
            </div>
          </Card>
        </Link>
      </li>
    );
  }

  return (
    <>
      <PageHeader
        title="Reuniões"
        subtitle={`${proximas.length} agendada${proximas.length === 1 ? "" : "s"} · prep e ata ficam SÓ aqui — cliente nunca vê`}
      />

      {/* Nova reunião */}
      <Card className="mb-6 p-4">
        <form
          action={createMeeting}
          className="grid grid-cols-2 gap-3 md:grid-cols-12"
        >
          <div className="col-span-2 md:col-span-4">
            <label className={labelCls} htmlFor="nr-title">
              Nova reunião
            </label>
            <input
              id="nr-title"
              name="title"
              required
              placeholder="ex: Alinhamento semanal Dallagnol"
              className={inputCls}
            />
          </div>
          <div className="md:col-span-2">
            <label className={labelCls} htmlFor="nr-type">
              Tipo
            </label>
            <select id="nr-type" name="type" className={inputCls}>
              {Object.entries(MEETING_TYPE_LABEL).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-3">
            <label className={labelCls} htmlFor="nr-when">
              Quando
            </label>
            <input
              id="nr-when"
              name="scheduled_at"
              type="datetime-local"
              required
              className={inputCls}
            />
          </div>
          <div className="md:col-span-3">
            <label className={labelCls} htmlFor="nr-space">
              Espaço
            </label>
            <select
              id="nr-space"
              name="space_id"
              defaultValue={devpauloSpace?.id}
              className={inputCls}
            >
              {spaces.map((s) => (
                <option key={s.id} value={s.id}>
                  {SPACE_LABEL[s.slug] ?? s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="col-span-2 md:col-span-9">
            <label className={labelCls} htmlFor="nr-related">
              Vincular a (dá contexto pro prep e pra ata da IA)
            </label>
            <select id="nr-related" name="related" className={inputCls}>
              <option value="">— sem vínculo</option>
              {projects.length > 0 && (
                <optgroup label="Projetos">
                  {projects.map((p) => (
                    <option key={p.id} value={`project:${p.id}`}>
                      {p.name}
                      {p.clients ? ` (${p.clients.name})` : ""}
                    </option>
                  ))}
                </optgroup>
              )}
              {leads.length > 0 && (
                <optgroup label="Leads">
                  {leads.map((l) => (
                    <option key={l.id} value={`lead:${l.id}`}>
                      {l.name}
                    </option>
                  ))}
                </optgroup>
              )}
              {clients.length > 0 && (
                <optgroup label="Clientes">
                  {clients.map((c) => (
                    <option key={c.id} value={`client:${c.id}`}>
                      {c.name}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>
          <div className="col-span-2 flex items-end md:col-span-3">
            <button type="submit" className={`${btnPrimary} w-full`}>
              <Plus size={16} /> Agendar
            </button>
          </div>
        </form>
      </Card>

      {meetings.length === 0 ? (
        <EmptyState
          title="Nenhuma reunião ainda"
          hint="Agende a primeira acima. A IA prepara o prep antes e estrutura a ata depois."
        />
      ) : (
        <>
          {proximas.length > 0 && (
            <section className="mb-8">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
                Próximas
              </h2>
              <ul className="space-y-2">
                {proximas.map((m) => (
                  <MeetingCard key={m.id} m={m} />
                ))}
              </ul>
            </section>
          )}
          {passadas.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
                Passadas
              </h2>
              <ul className="space-y-2">
                {passadas.map((m) => (
                  <MeetingCard key={m.id} m={m} />
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </>
  );
}
