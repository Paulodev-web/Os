import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus, FolderOpen, ChevronRight, AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import type {
  Client,
  Project,
  Proposal,
  Task,
} from "@/lib/database.types";
import {
  Card,
  PageHeader,
  Badge,
  EmptyState,
  inputCls,
  labelCls,
  btnPrimary,
  btnSecondary,
} from "@/components/ui";
import { CopyPortalLink } from "@/components/copy-link";
import { DeleteClientForm } from "@/components/clientes/delete-client-form";
import { PROJECT_STATUS_LABEL } from "@/lib/labels";
import { brl, dateBR } from "@/lib/format";
import {
  createProject,
  deleteClient,
  updateClient,
  updateClientNotes,
} from "../actions";

export const dynamic = "force-dynamic";

const PROJECT_TONE: Record<string, "green" | "neutral" | "warn"> = {
  em_andamento: "green",
  entregue: "neutral",
  pausado: "warn",
  arquivado: "neutral",
};

const PROPOSAL_TONE: Record<string, "green" | "neutral" | "warn" | "danger"> = {
  rascunho: "neutral",
  enviada: "warn",
  aceita: "green",
  recusada: "danger",
};

export default async function ClientePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ erro?: string }>;
}) {
  const { slug } = await params;
  const { erro } = await searchParams;
  const supabase = await createClient();

  const { data: clientData } = await supabase
    .from("clients")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (!clientData) notFound();
  const client = clientData as Client;

  const [{ data: projectsData }, { data: proposalsData }, { data: tasksData }] =
    await Promise.all([
      supabase
        .from("projects")
        .select("*")
        .eq("client_id", client.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("proposals")
        .select("*")
        .eq("client_id", client.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("tasks")
        .select("*")
        .eq("related_entity_id", client.id)
        .eq("done", false)
        .order("due_date"),
    ]);

  const projects = (projectsData ?? []) as Project[];
  const proposals = (proposalsData ?? []) as Proposal[];
  const tasks = (tasksData ?? []) as Task[];

  return (
    <>
      <PageHeader
        title={client.name}
        subtitle={
          <>
            {client.segment ?? "—"}
            {client.contact ? <> · {client.contact}</> : null}
          </>
        }
        action={<CopyPortalLink token={client.portal_token} />}
      />

      {erro && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-danger/30 bg-danger-soft px-4 py-3 text-sm font-semibold text-danger">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          {erro}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Dados do cliente */}
          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
              Dados do cliente
            </h2>
            <Card className="p-4">
              <form
                action={updateClient}
                className="grid grid-cols-1 gap-3 md:grid-cols-12"
              >
                <input type="hidden" name="id" value={client.id} />
                <input type="hidden" name="slug" value={client.slug} />
                <div className="md:col-span-5">
                  <label className={labelCls} htmlFor="cl-name">
                    Nome
                  </label>
                  <input
                    id="cl-name"
                    name="name"
                    required
                    defaultValue={client.name}
                    className={inputCls}
                  />
                </div>
                <div className="md:col-span-3">
                  <label className={labelCls} htmlFor="cl-segment">
                    Segmento
                  </label>
                  <input
                    id="cl-segment"
                    name="segment"
                    defaultValue={client.segment ?? ""}
                    className={inputCls}
                  />
                </div>
                <div className="md:col-span-3">
                  <label className={labelCls} htmlFor="cl-contact">
                    Contato
                  </label>
                  <input
                    id="cl-contact"
                    name="contact"
                    defaultValue={client.contact ?? ""}
                    className={inputCls}
                  />
                </div>
                <div className="flex items-end md:col-span-1">
                  <button type="submit" className={`${btnSecondary} w-full`}>
                    Salvar
                  </button>
                </div>
              </form>
            </Card>
          </section>

          {/* Projetos */}
          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
              Projetos
            </h2>
            {projects.length === 0 ? (
              <EmptyState
                title="Nenhum projeto"
                hint="Crie o primeiro projeto deste cliente abaixo."
              />
            ) : (
              <ul className="space-y-2">
                {projects.map((p) => (
                  <li key={p.id}>
                    <Link href={`/projetos/${p.id}`}>
                      <Card className="flex items-center gap-3 p-4 transition hover:border-primary/40 hover:shadow-pop">
                        <FolderOpen
                          size={18}
                          className="shrink-0 text-primary"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold">{p.name}</p>
                          {p.description && (
                            <p className="truncate text-sm text-muted">
                              {p.description}
                            </p>
                          )}
                        </div>
                        <Badge tone={PROJECT_TONE[p.status]}>
                          {PROJECT_STATUS_LABEL[p.status]}
                        </Badge>
                        <ChevronRight size={16} className="text-muted/50" />
                      </Card>
                    </Link>
                  </li>
                ))}
              </ul>
            )}

            <Card className="mt-3 p-4">
              <form
                action={createProject}
                className="grid grid-cols-1 gap-3 md:grid-cols-12"
              >
                <input type="hidden" name="client_id" value={client.id} />
                <input type="hidden" name="client_slug" value={client.slug} />
                <div className="md:col-span-5">
                  <label className={labelCls} htmlFor="np-name">
                    Novo projeto
                  </label>
                  <input
                    id="np-name"
                    name="name"
                    required
                    placeholder="Nome do projeto"
                    className={inputCls}
                  />
                </div>
                <div className="md:col-span-5">
                  <label className={labelCls} htmlFor="np-desc">
                    Descrição
                  </label>
                  <input
                    id="np-desc"
                    name="description"
                    placeholder="Escopo em uma linha"
                    className={inputCls}
                  />
                </div>
                <div className="flex items-end md:col-span-2">
                  <button type="submit" className={`${btnPrimary} w-full`}>
                    <Plus size={16} /> Criar
                  </button>
                </div>
              </form>
            </Card>
          </section>

          {/* Propostas do cliente */}
          {proposals.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
                Propostas
              </h2>
              <ul className="space-y-2">
                {proposals.map((p) => (
                  <li key={p.id}>
                    <Card className="flex items-center gap-3 p-4">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold">{p.title}</p>
                        {p.notes && (
                          <p className="text-sm text-muted">{p.notes}</p>
                        )}
                      </div>
                      <span className="font-black tabular-nums">
                        {brl(p.value)}
                      </span>
                      <Badge tone={PROPOSAL_TONE[p.status]}>{p.status}</Badge>
                    </Card>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Zona de risco */}
          <Card className="border-danger/20 p-4">
            <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-muted">
              Zona de risco
            </h2>
            <p className="mb-3 text-xs text-muted">
              Exclui o cliente do painel. Só funciona se não houver projetos —
              apague ou arquive os projetos antes. Não altera o slug nem o link
              do portal enquanto o cliente existir.
            </p>
            <DeleteClientForm
              action={deleteClient}
              clientId={client.id}
              clientSlug={client.slug}
              clientName={client.name}
            />
          </Card>
        </div>

        <div className="space-y-6">
          {/* Tarefas abertas do cliente */}
          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
              Tarefas abertas
            </h2>
            {tasks.length === 0 ? (
              <Card className="p-4 text-sm text-muted">
                Nenhuma tarefa aberta pra este cliente.
              </Card>
            ) : (
              <Card className="divide-y divide-border">
                {tasks.map((t) => (
                  <div key={t.id} className="p-3">
                    <p className="text-sm font-semibold">{t.title}</p>
                    <p className="mt-0.5 text-xs text-muted">
                      {t.category} · {dateBR(t.due_date)}
                    </p>
                  </div>
                ))}
              </Card>
            )}
            <Link
              href="/tarefas"
              className={`${btnSecondary} mt-3 w-full`}
            >
              Ver todas as tarefas
            </Link>
          </section>

          {/* Notas / histórico */}
          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
              Notas do cliente
            </h2>
            <Card className="p-4">
              <form action={updateClientNotes}>
                <input type="hidden" name="id" value={client.id} />
                <input type="hidden" name="slug" value={client.slug} />
                <textarea
                  name="notes"
                  rows={7}
                  defaultValue={client.notes ?? ""}
                  placeholder="Histórico, contexto, oportunidades de upsell…"
                  className={`${inputCls} resize-y`}
                />
                <button type="submit" className={`${btnSecondary} mt-3`}>
                  Salvar notas
                </button>
              </form>
            </Card>
          </section>
        </div>
      </div>
    </>
  );
}
