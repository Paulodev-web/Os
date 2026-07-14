import Link from "next/link";
import { Plus, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import type { Client, Project } from "@/lib/database.types";
import {
  Card,
  PageHeader,
  Badge,
  EmptyState,
  inputCls,
  labelCls,
  btnPrimary,
} from "@/components/ui";
import { createNewClient } from "./actions";

export const dynamic = "force-dynamic";

type ClientWithProjects = Client & { projects: Pick<Project, "id" | "status">[] };

export default async function ClientesPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clients")
    .select("*, projects(id, status)")
    .order("name");

  if (error) throw new Error(`Erro ao carregar clientes: ${error.message}`);
  const clients = (data ?? []) as unknown as ClientWithProjects[];

  return (
    <>
      <PageHeader
        title="Clientes"
        subtitle="Visão 360° — um cliente pode ter vários projetos ao longo do tempo"
      />

      <Card className="mb-6 p-4">
        <form
          action={createNewClient}
          className="grid grid-cols-2 gap-3 md:grid-cols-12"
        >
          <div className="col-span-2 md:col-span-4">
            <label className={labelCls} htmlFor="nc-name">
              Novo cliente
            </label>
            <input
              id="nc-name"
              name="name"
              required
              placeholder="Nome da empresa"
              className={inputCls}
            />
          </div>
          <div className="md:col-span-3">
            <label className={labelCls} htmlFor="nc-seg">
              Segmento
            </label>
            <input
              id="nc-seg"
              name="segment"
              placeholder="ex: Odontologia"
              className={inputCls}
            />
          </div>
          <div className="md:col-span-3">
            <label className={labelCls} htmlFor="nc-contact">
              Contato
            </label>
            <input
              id="nc-contact"
              name="contact"
              placeholder="Nome · WhatsApp"
              className={inputCls}
            />
          </div>
          <div className="col-span-2 flex items-end md:col-span-2">
            <button type="submit" className={`${btnPrimary} w-full`}>
              <Plus size={16} /> Criar
            </button>
          </div>
        </form>
      </Card>

      {clients.length === 0 ? (
        <EmptyState title="Nenhum cliente ainda" />
      ) : (
        <ul className="space-y-2">
          {clients.map((c) => {
            const ativos = c.projects.filter(
              (p) => p.status === "em_andamento"
            ).length;
            return (
              <li key={c.id}>
                <Link href={`/clientes/${c.slug}`}>
                  <Card className="flex items-center gap-4 p-4 transition hover:border-primary/40 hover:shadow-pop">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-sm font-black text-primary-dark">
                      {c.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{c.name}</p>
                      <p className="text-sm text-muted">
                        {c.segment ?? "—"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {ativos > 0 && (
                        <Badge tone="green">
                          {ativos} projeto{ativos > 1 ? "s" : ""} ativo
                          {ativos > 1 ? "s" : ""}
                        </Badge>
                      )}
                      <Badge>
                        {c.projects.length} no total
                      </Badge>
                      <ChevronRight size={16} className="text-muted/50" />
                    </div>
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
