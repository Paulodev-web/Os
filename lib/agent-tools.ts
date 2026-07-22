import type { SupabaseClient } from "@supabase/supabase-js";
import type { GeminiTool } from "@/lib/gemini";
import { inserirLancamento, atualizarLancamento } from "@/lib/finance";
import { todayISO } from "@/lib/format";

/* Fábrica de ferramentas do Agente central.
   REGRA DE SEGURANÇA: sempre recebe o client autenticado da sessão do Paulo
   (mesma superfície de RLS que ele já tem manualmente) — NUNCA service role.
   CRUD completo em todo módulo do sistema. */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = SupabaseClient<any, any, any>;

type Args = Record<string, unknown>;

function str(a: Args, k: string): string {
  const v = a[k];
  return typeof v === "string" ? v.trim() : v == null ? "" : String(v);
}
function optStr(a: Args, k: string): string | null {
  const s = str(a, k);
  return s || null;
}
function numOr(a: Args, k: string, def: number): number {
  const v = a[k];
  const n = typeof v === "number" ? v : Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : def;
}
function boolVal(a: Args, k: string): boolean {
  return a[k] === true || a[k] === "true";
}

// esquema JSON reutilizável
const S = {
  obj: (props: Record<string, unknown>, required: string[] = []) => ({
    type: "object",
    properties: props,
    required,
  }),
  str: (description: string) => ({ type: "string", description }),
  num: (description: string) => ({ type: "number", description }),
  bool: (description: string) => ({ type: "boolean", description }),
  enum: (values: string[], description: string) => ({
    type: "string",
    enum: values,
    description,
  }),
};

const TASK_CATEGORIES = [
  "entrega",
  "financeiro",
  "marketing",
  "comercial",
  "operacional",
  "relacionamento",
];
const TASK_PRIORITIES = ["alta", "media", "baixa"];
const MEETING_TYPES = [
  "diagnostico",
  "alinhamento",
  "comercial",
  "interna",
  "outro",
];
const LEAD_STAGES = [
  "novo",
  "diagnostico_agendado",
  "proposta_enviada",
  "follow_up",
  "fechado",
  "perdido",
];
const SPACES = ["devpaulo", "iservice", "pessoal"];

async function spaceId(db: Db, slug: string): Promise<string | null> {
  const { data } = await db
    .from("spaces")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  return (data?.id as string) ?? null;
}

/** normaliza "YYYY-MM-DDTHH:mm" (local SP) → timestamptz com offset fixo -03 */
function normalizeScheduled(v: string): string {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v) ? `${v}:00-03:00` : v;
}

export function buildAgentTools(db: Db): GeminiTool[] {
  const t = (
    name: string,
    description: string,
    parametersJsonSchema: Record<string, unknown>,
    execute: (a: Args) => Promise<unknown>
  ): GeminiTool => ({ name, description, parametersJsonSchema, execute });

  return [
    /* ===================== TAREFAS ===================== */
    t(
      "get_tasks",
      "Lista tarefas. Filtros opcionais por status (done), espaço e categoria.",
      S.obj({
        done: S.bool("true=concluídas, false=pendentes; omitir = todas"),
        espaco: S.enum(SPACES, "espaço (opcional)"),
        categoria: S.enum(TASK_CATEGORIES, "categoria (opcional)"),
      }),
      async (a) => {
        let q = db
          .from("tasks")
          .select("id, title, category, priority, due_date, done, note, spaces(slug)")
          .order("due_date")
          .limit(80);
        if (typeof a.done === "boolean") q = q.eq("done", a.done);
        if (str(a, "categoria")) q = q.eq("category", str(a, "categoria"));
        const { data, error } = await q;
        if (error) return { erro: error.message };
        const espaco = str(a, "espaco");
        const rows = (data ?? []) as unknown as {
          spaces: { slug: string } | null;
        }[];
        return espaco
          ? rows.filter((r) => r.spaces?.slug === espaco)
          : rows;
      }
    ),
    t(
      "create_task",
      "Cria uma tarefa nova (source=ia).",
      S.obj(
        {
          title: S.str("título da tarefa"),
          espaco: S.enum(SPACES, "espaço (default devpaulo)"),
          category: S.enum(TASK_CATEGORIES, "categoria (default operacional)"),
          priority: S.enum(TASK_PRIORITIES, "prioridade (default media)"),
          due_date: S.str("prazo YYYY-MM-DD (opcional)"),
          note: S.str("nota/observação (opcional)"),
        },
        ["title"]
      ),
      async (a) => {
        const title = str(a, "title");
        if (!title) return { erro: "title é obrigatório" };
        const slug = SPACES.includes(str(a, "espaco")) ? str(a, "espaco") : "devpaulo";
        const sid = await spaceId(db, slug);
        if (!sid) return { erro: "espaço não encontrado" };
        const category = TASK_CATEGORIES.includes(str(a, "category"))
          ? str(a, "category")
          : "operacional";
        const priority = TASK_PRIORITIES.includes(str(a, "priority"))
          ? str(a, "priority")
          : "media";
        const due = str(a, "due_date");
        const { data, error } = await db
          .from("tasks")
          .insert({
            title,
            space_id: sid,
            category,
            priority,
            due_date: /^\d{4}-\d{2}-\d{2}$/.test(due) ? due : null,
            note: optStr(a, "note"),
            source: "ia",
          })
          .select("id")
          .single();
        return error ? { erro: error.message } : { ok: true, id: data.id };
      }
    ),
    t(
      "update_task",
      "Edita uma tarefa existente (título/categoria/prioridade/prazo/nota).",
      S.obj(
        {
          id: S.str("id da tarefa"),
          title: S.str("novo título"),
          category: S.enum(TASK_CATEGORIES, "categoria"),
          priority: S.enum(TASK_PRIORITIES, "prioridade"),
          due_date: S.str("prazo YYYY-MM-DD ou vazio pra remover"),
          note: S.str("nota"),
          done: S.bool("marcar concluída/reabrir"),
        },
        ["id"]
      ),
      async (a) => {
        const id = str(a, "id");
        if (!id) return { erro: "id é obrigatório" };
        const patch: Record<string, unknown> = {};
        if (str(a, "title")) patch.title = str(a, "title");
        if (TASK_CATEGORIES.includes(str(a, "category")))
          patch.category = str(a, "category");
        if (TASK_PRIORITIES.includes(str(a, "priority")))
          patch.priority = str(a, "priority");
        if ("due_date" in a) {
          const due = str(a, "due_date");
          patch.due_date = /^\d{4}-\d{2}-\d{2}$/.test(due) ? due : null;
        }
        if ("note" in a) patch.note = optStr(a, "note");
        if (typeof a.done === "boolean") patch.done = a.done;
        const { data, error } = await db
          .from("tasks")
          .update(patch)
          .eq("id", id)
          .select("id");
        if (error) return { erro: error.message };
        return data?.length ? { ok: true, id } : { erro: "nada atualizado (RLS/id)" };
      }
    ),
    t(
      "delete_task",
      "Exclui uma tarefa.",
      S.obj({ id: S.str("id da tarefa") }, ["id"]),
      async (a) => {
        const id = str(a, "id");
        if (!id) return { erro: "id é obrigatório" };
        const { data, error } = await db
          .from("tasks")
          .delete()
          .eq("id", id)
          .select("id");
        if (error) return { erro: error.message };
        return data?.length ? { ok: true } : { erro: "nada excluído (RLS/id)" };
      }
    ),

    /* ===================== REUNIÕES ===================== */
    t(
      "get_meetings",
      "Lista reuniões (mais recentes primeiro).",
      S.obj({
        status: S.enum(["agendada", "realizada", "cancelada"], "status (opcional)"),
      }),
      async (a) => {
        let q = db
          .from("meetings")
          .select("id, title, type, scheduled_at, status, client_name")
          .order("scheduled_at", { ascending: false })
          .limit(50);
        if (str(a, "status")) q = q.eq("status", str(a, "status"));
        const { data, error } = await q;
        return error ? { erro: error.message } : data;
      }
    ),
    t(
      "create_meeting",
      "Cria uma reunião. scheduled_at no formato YYYY-MM-DDTHH:mm (horário de SP).",
      S.obj(
        {
          title: S.str("título"),
          type: S.enum(MEETING_TYPES, "tipo (default outro)"),
          espaco: S.enum(SPACES, "espaço (default devpaulo)"),
          scheduled_at: S.str("data/hora YYYY-MM-DDTHH:mm"),
        },
        ["title", "scheduled_at"]
      ),
      async (a) => {
        const title = str(a, "title");
        const scheduled = str(a, "scheduled_at");
        if (!title || !scheduled) return { erro: "title e scheduled_at obrigatórios" };
        const slug = SPACES.includes(str(a, "espaco")) ? str(a, "espaco") : "devpaulo";
        const sid = await spaceId(db, slug);
        if (!sid) return { erro: "espaço não encontrado" };
        const type = MEETING_TYPES.includes(str(a, "type")) ? str(a, "type") : "outro";
        const { data, error } = await db
          .from("meetings")
          .insert({
            title,
            type,
            space_id: sid,
            scheduled_at: normalizeScheduled(scheduled),
            source: "ia",
          })
          .select("id")
          .single();
        return error ? { erro: error.message } : { ok: true, id: data.id };
      }
    ),
    t(
      "update_meeting",
      "Edita título/tipo/data-hora ou status de uma reunião (reagenda sem perder prep/ata).",
      S.obj(
        {
          id: S.str("id da reunião"),
          title: S.str("novo título"),
          type: S.enum(MEETING_TYPES, "tipo"),
          scheduled_at: S.str("nova data/hora YYYY-MM-DDTHH:mm"),
          status: S.enum(["agendada", "realizada", "cancelada"], "status"),
        },
        ["id"]
      ),
      async (a) => {
        const id = str(a, "id");
        if (!id) return { erro: "id é obrigatório" };
        const patch: Record<string, unknown> = {};
        if (str(a, "title")) patch.title = str(a, "title");
        if (MEETING_TYPES.includes(str(a, "type"))) patch.type = str(a, "type");
        if (str(a, "scheduled_at"))
          patch.scheduled_at = normalizeScheduled(str(a, "scheduled_at"));
        if (["agendada", "realizada", "cancelada"].includes(str(a, "status")))
          patch.status = str(a, "status");
        const { data, error } = await db
          .from("meetings")
          .update(patch)
          .eq("id", id)
          .select("id");
        if (error) return { erro: error.message };
        return data?.length ? { ok: true, id } : { erro: "nada atualizado (RLS/id)" };
      }
    ),
    t(
      "delete_meeting",
      "Exclui uma reunião.",
      S.obj({ id: S.str("id da reunião") }, ["id"]),
      async (a) => {
        const id = str(a, "id");
        if (!id) return { erro: "id é obrigatório" };
        const { data, error } = await db
          .from("meetings")
          .delete()
          .eq("id", id)
          .select("id");
        if (error) return { erro: error.message };
        return data?.length ? { ok: true } : { erro: "nada excluído (RLS/id)" };
      }
    ),

    /* ===================== LEADS ===================== */
    t(
      "get_leads",
      "Lista leads do pipeline comercial.",
      S.obj({ stage: S.enum(LEAD_STAGES, "estágio (opcional)") }),
      async (a) => {
        let q = db
          .from("leads")
          .select("id, name, segment, stage, contact, next_action, next_action_date, notes")
          .order("updated_at", { ascending: false })
          .limit(80);
        if (LEAD_STAGES.includes(str(a, "stage"))) q = q.eq("stage", str(a, "stage"));
        const { data, error } = await q;
        return error ? { erro: error.message } : data;
      }
    ),
    t(
      "create_lead",
      "Cria um lead novo (nasce no estágio 'novo').",
      S.obj(
        {
          name: S.str("nome da empresa/lead"),
          segment: S.str("segmento (opcional)"),
          contact: S.str("contato: WhatsApp/email (opcional)"),
          next_action: S.str("próxima ação (opcional)"),
          next_action_date: S.str("data da próxima ação YYYY-MM-DD (opcional)"),
          notes: S.str("notas/contexto (opcional)"),
        },
        ["name"]
      ),
      async (a) => {
        const name = str(a, "name");
        if (!name) return { erro: "name é obrigatório" };
        const nad = str(a, "next_action_date");
        const { data, error } = await db
          .from("leads")
          .insert({
            name,
            segment: optStr(a, "segment"),
            contact: optStr(a, "contact"),
            next_action: optStr(a, "next_action"),
            next_action_date: /^\d{4}-\d{2}-\d{2}$/.test(nad) ? nad : null,
            notes: optStr(a, "notes"),
            stage: "novo",
          })
          .select("id")
          .single();
        return error ? { erro: error.message } : { ok: true, id: data.id };
      }
    ),
    t(
      "update_lead",
      "Edita um lead: move de estágio e/ou atualiza contato/próxima ação/notas.",
      S.obj(
        {
          id: S.str("id do lead"),
          stage: S.enum(LEAD_STAGES, "novo estágio"),
          contact: S.str("contato"),
          next_action: S.str("próxima ação"),
          next_action_date: S.str("data YYYY-MM-DD"),
          notes: S.str("notas"),
        },
        ["id"]
      ),
      async (a) => {
        const id = str(a, "id");
        if (!id) return { erro: "id é obrigatório" };
        const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (LEAD_STAGES.includes(str(a, "stage"))) patch.stage = str(a, "stage");
        if ("contact" in a) patch.contact = optStr(a, "contact");
        if ("next_action" in a) patch.next_action = optStr(a, "next_action");
        if ("next_action_date" in a) {
          const nad = str(a, "next_action_date");
          patch.next_action_date = /^\d{4}-\d{2}-\d{2}$/.test(nad) ? nad : null;
        }
        if ("notes" in a) patch.notes = optStr(a, "notes");
        const { data, error } = await db
          .from("leads")
          .update(patch)
          .eq("id", id)
          .select("id");
        if (error) return { erro: error.message };
        return data?.length ? { ok: true, id } : { erro: "nada atualizado (RLS/id)" };
      }
    ),
    t(
      "delete_lead",
      "Exclui um lead.",
      S.obj({ id: S.str("id do lead") }, ["id"]),
      async (a) => {
        const id = str(a, "id");
        if (!id) return { erro: "id é obrigatório" };
        const { data, error } = await db
          .from("leads")
          .delete()
          .eq("id", id)
          .select("id");
        if (error) return { erro: error.message };
        return data?.length ? { ok: true } : { erro: "nada excluído (RLS/id)" };
      }
    ),

    /* ===================== PROPOSTAS ===================== */
    t(
      "get_proposals",
      "Lista propostas comerciais.",
      S.obj({}),
      async () => {
        const { data, error } = await db
          .from("proposals")
          .select("id, title, value, status, lead_id, client_id, doc_url, notes, sent_at")
          .order("created_at", { ascending: false })
          .limit(80);
        return error ? { erro: error.message } : data;
      }
    ),
    t(
      "create_proposal",
      "Cria uma proposta, opcionalmente vinculada a um lead.",
      S.obj(
        {
          title: S.str("título da proposta"),
          value: S.num("valor em reais"),
          lead_id: S.str("id do lead (opcional)"),
          status: S.enum(["rascunho", "enviada", "aceita", "recusada"], "status (default rascunho)"),
          doc_url: S.str("link do documento (opcional)"),
          notes: S.str("notas (opcional)"),
        },
        ["title", "value"]
      ),
      async (a) => {
        const title = str(a, "title");
        const value = numOr(a, "value", NaN);
        if (!title || !Number.isFinite(value) || value < 0)
          return { erro: "title e value (>=0) obrigatórios" };
        const status = ["rascunho", "enviada", "aceita", "recusada"].includes(
          str(a, "status")
        )
          ? str(a, "status")
          : "rascunho";
        const { data, error } = await db
          .from("proposals")
          .insert({
            title,
            value,
            lead_id: optStr(a, "lead_id"),
            status,
            sent_at: status === "enviada" ? new Date().toISOString() : null,
            doc_url: optStr(a, "doc_url"),
            notes: optStr(a, "notes"),
          })
          .select("id")
          .single();
        return error ? { erro: error.message } : { ok: true, id: data.id };
      }
    ),
    t(
      "update_proposal",
      "Edita título/valor/status/link/notas de uma proposta.",
      S.obj(
        {
          id: S.str("id da proposta"),
          title: S.str("novo título"),
          value: S.num("novo valor"),
          status: S.enum(["rascunho", "enviada", "aceita", "recusada"], "status"),
          doc_url: S.str("link"),
          notes: S.str("notas"),
        },
        ["id"]
      ),
      async (a) => {
        const id = str(a, "id");
        if (!id) return { erro: "id é obrigatório" };
        const patch: Record<string, unknown> = {};
        if (str(a, "title")) patch.title = str(a, "title");
        if ("value" in a) {
          const v = numOr(a, "value", NaN);
          if (Number.isFinite(v) && v >= 0) patch.value = v;
        }
        if (["rascunho", "enviada", "aceita", "recusada"].includes(str(a, "status"))) {
          patch.status = str(a, "status");
          if (str(a, "status") === "enviada") patch.sent_at = new Date().toISOString();
        }
        if ("doc_url" in a) patch.doc_url = optStr(a, "doc_url");
        if ("notes" in a) patch.notes = optStr(a, "notes");
        const { data, error } = await db
          .from("proposals")
          .update(patch)
          .eq("id", id)
          .select("id");
        if (error) return { erro: error.message };
        return data?.length ? { ok: true, id } : { erro: "nada atualizado (RLS/id)" };
      }
    ),
    t(
      "delete_proposal",
      "Exclui uma proposta.",
      S.obj({ id: S.str("id da proposta") }, ["id"]),
      async (a) => {
        const id = str(a, "id");
        if (!id) return { erro: "id é obrigatório" };
        const { data, error } = await db
          .from("proposals")
          .delete()
          .eq("id", id)
          .select("id");
        if (error) return { erro: error.message };
        return data?.length ? { ok: true } : { erro: "nada excluído (RLS/id)" };
      }
    ),

    /* ===================== CLIENTES ===================== */
    t(
      "get_clients",
      "Lista clientes.",
      S.obj({}),
      async () => {
        const { data, error } = await db
          .from("clients")
          .select("id, name, slug, segment, contact, notes")
          .order("name")
          .limit(100);
        return error ? { erro: error.message } : data;
      }
    ),
    t(
      "create_client",
      "Cria um cliente novo.",
      S.obj(
        {
          name: S.str("nome da empresa"),
          segment: S.str("segmento (opcional)"),
          contact: S.str("contato (opcional)"),
        },
        ["name"]
      ),
      async (a) => {
        const name = str(a, "name");
        if (!name) return { erro: "name é obrigatório" };
        const slug = name
          .toLowerCase()
          .normalize("NFD")
          .replace(/[̀-ͯ]/g, "")
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)+/g, "");
        const { data, error } = await db
          .from("clients")
          .insert({
            name,
            slug,
            segment: optStr(a, "segment"),
            contact: optStr(a, "contact"),
          })
          .select("id, slug")
          .single();
        return error ? { erro: error.message } : { ok: true, id: data.id, slug: data.slug };
      }
    ),
    t(
      "update_client",
      "Edita nome/segmento/contato/notas de um cliente (não altera o slug/link do portal).",
      S.obj(
        {
          id: S.str("id do cliente"),
          name: S.str("novo nome"),
          segment: S.str("segmento"),
          contact: S.str("contato"),
          notes: S.str("notas"),
        },
        ["id"]
      ),
      async (a) => {
        const id = str(a, "id");
        if (!id) return { erro: "id é obrigatório" };
        const patch: Record<string, unknown> = {};
        if (str(a, "name")) patch.name = str(a, "name");
        if ("segment" in a) patch.segment = optStr(a, "segment");
        if ("contact" in a) patch.contact = optStr(a, "contact");
        if ("notes" in a) patch.notes = optStr(a, "notes");
        const { data, error } = await db
          .from("clients")
          .update(patch)
          .eq("id", id)
          .select("id");
        if (error) return { erro: error.message };
        return data?.length ? { ok: true, id } : { erro: "nada atualizado (RLS/id)" };
      }
    ),
    t(
      "delete_client",
      "Exclui um cliente. Só funciona se não houver projetos vinculados.",
      S.obj({ id: S.str("id do cliente") }, ["id"]),
      async (a) => {
        const id = str(a, "id");
        if (!id) return { erro: "id é obrigatório" };
        const { count } = await db
          .from("projects")
          .select("id", { count: "exact", head: true })
          .eq("client_id", id);
        if ((count ?? 0) > 0)
          return {
            erro: "cliente tem projetos vinculados — apague/arquive os projetos antes.",
          };
        const { data, error } = await db
          .from("clients")
          .delete()
          .eq("id", id)
          .select("id");
        if (error) return { erro: error.message };
        return data?.length ? { ok: true } : { erro: "nada excluído (RLS/id)" };
      }
    ),

    /* ===================== PROJETOS ===================== */
    t(
      "get_projects",
      "Lista projetos. Filtro opcional por cliente.",
      S.obj({ client_id: S.str("id do cliente (opcional)") }),
      async (a) => {
        let q = db
          .from("projects")
          .select("id, name, status, description, client_id, current_phase, started_at")
          .order("created_at", { ascending: false })
          .limit(80);
        if (str(a, "client_id")) q = q.eq("client_id", str(a, "client_id"));
        const { data, error } = await q;
        return error ? { erro: error.message } : data;
      }
    ),
    t(
      "create_project",
      "Cria um projeto para um cliente.",
      S.obj(
        {
          client_id: S.str("id do cliente"),
          name: S.str("nome do projeto"),
          description: S.str("descrição (opcional)"),
        },
        ["client_id", "name"]
      ),
      async (a) => {
        const clientId = str(a, "client_id");
        const name = str(a, "name");
        if (!clientId || !name) return { erro: "client_id e name obrigatórios" };
        const { data, error } = await db
          .from("projects")
          .insert({
            client_id: clientId,
            name,
            description: optStr(a, "description"),
            started_at: todayISO(),
          })
          .select("id")
          .single();
        return error ? { erro: error.message } : { ok: true, id: data.id };
      }
    ),
    t(
      "update_project",
      "Edita um projeto: nome, descrição, status, fase, próxima ação, escopo, data de início.",
      S.obj(
        {
          id: S.str("id do projeto"),
          name: S.str("nome"),
          description: S.str("descrição"),
          status: S.enum(["em_andamento", "entregue", "pausado", "arquivado"], "status"),
          current_phase: S.enum(
            ["descoberta", "escopo", "design", "desenvolvimento", "qa", "entrega", "pos_entrega"],
            "fase atual"
          ),
          next_action: S.str("próxima ação do cliente"),
          started_at: S.str("data de início YYYY-MM-DD"),
        },
        ["id"]
      ),
      async (a) => {
        const id = str(a, "id");
        if (!id) return { erro: "id é obrigatório" };
        const patch: Record<string, unknown> = {};
        if (str(a, "name")) patch.name = str(a, "name");
        if ("description" in a) patch.description = optStr(a, "description");
        if (["em_andamento", "entregue", "pausado", "arquivado"].includes(str(a, "status")))
          patch.status = str(a, "status");
        if (str(a, "current_phase")) patch.current_phase = str(a, "current_phase");
        if ("next_action" in a) patch.next_action = optStr(a, "next_action");
        if (str(a, "started_at")) patch.started_at = str(a, "started_at");
        const { data, error } = await db
          .from("projects")
          .update(patch)
          .eq("id", id)
          .select("id");
        if (error) return { erro: error.message };
        return data?.length ? { ok: true, id } : { erro: "nada atualizado (RLS/id)" };
      }
    ),
    t(
      "delete_project",
      "Exclui um projeto e todos os marcos/arquivos dele. Irreversível.",
      S.obj({ id: S.str("id do projeto") }, ["id"]),
      async (a) => {
        const id = str(a, "id");
        if (!id) return { erro: "id é obrigatório" };
        await db.from("project_assets").delete().eq("project_id", id);
        await db.from("project_milestones").delete().eq("project_id", id);
        const { data, error } = await db
          .from("projects")
          .delete()
          .eq("id", id)
          .select("id");
        if (error) return { erro: error.message };
        return data?.length ? { ok: true } : { erro: "nada excluído (RLS/id)" };
      }
    ),

    /* ===================== MARCOS ===================== */
    t(
      "get_milestones",
      "Lista marcos de um projeto.",
      S.obj({ project_id: S.str("id do projeto") }, ["project_id"]),
      async (a) => {
        const pid = str(a, "project_id");
        if (!pid) return { erro: "project_id é obrigatório" };
        const { data, error } = await db
          .from("project_milestones")
          .select("id, title, description, published, phase, published_at")
          .eq("project_id", pid)
          .order("created_at");
        return error ? { erro: error.message } : data;
      }
    ),
    t(
      "create_milestone",
      "Cria um marco de projeto (nasce como rascunho — não publicado).",
      S.obj(
        {
          project_id: S.str("id do projeto"),
          title: S.str("título do marco"),
          description: S.str("descrição (opcional)"),
          phase: S.str("fase (opcional)"),
        },
        ["project_id", "title"]
      ),
      async (a) => {
        const pid = str(a, "project_id");
        const title = str(a, "title");
        if (!pid || !title) return { erro: "project_id e title obrigatórios" };
        const { data, error } = await db
          .from("project_milestones")
          .insert({
            project_id: pid,
            title,
            description: optStr(a, "description"),
            phase: optStr(a, "phase"),
          })
          .select("id")
          .single();
        return error ? { erro: error.message } : { ok: true, id: data.id };
      }
    ),
    t(
      "update_milestone",
      "Edita título/descrição/fase de um marco.",
      S.obj(
        {
          id: S.str("id do marco"),
          title: S.str("título"),
          description: S.str("descrição"),
          phase: S.str("fase"),
        },
        ["id"]
      ),
      async (a) => {
        const id = str(a, "id");
        if (!id) return { erro: "id é obrigatório" };
        const patch: Record<string, unknown> = {};
        if (str(a, "title")) patch.title = str(a, "title");
        if ("description" in a) patch.description = optStr(a, "description");
        if ("phase" in a) patch.phase = optStr(a, "phase");
        const { data, error } = await db
          .from("project_milestones")
          .update(patch)
          .eq("id", id)
          .select("id");
        if (error) return { erro: error.message };
        return data?.length ? { ok: true, id } : { erro: "nada atualizado (RLS/id)" };
      }
    ),
    t(
      "publish_milestone",
      "Publica ou despublica um marco no portal do cliente.",
      S.obj(
        { id: S.str("id do marco"), publish: S.bool("true=publicar, false=despublicar") },
        ["id", "publish"]
      ),
      async (a) => {
        const id = str(a, "id");
        if (!id) return { erro: "id é obrigatório" };
        const publish = boolVal(a, "publish");
        const { data, error } = await db
          .from("project_milestones")
          .update({
            published: publish,
            published_at: publish ? new Date().toISOString() : null,
          })
          .eq("id", id)
          .select("id");
        if (error) return { erro: error.message };
        return data?.length ? { ok: true, publicado: publish } : { erro: "nada atualizado (RLS/id)" };
      }
    ),
    t(
      "delete_milestone",
      "Exclui um marco e os arquivos dele.",
      S.obj({ id: S.str("id do marco") }, ["id"]),
      async (a) => {
        const id = str(a, "id");
        if (!id) return { erro: "id é obrigatório" };
        await db.from("project_assets").delete().eq("milestone_id", id);
        const { data, error } = await db
          .from("project_milestones")
          .delete()
          .eq("id", id)
          .select("id");
        if (error) return { erro: error.message };
        return data?.length ? { ok: true } : { erro: "nada excluído (RLS/id)" };
      }
    ),

    /* ===================== FINANCEIRO ===================== */
    t(
      "get_finance_summary",
      "Resumo financeiro (entradas/saídas/saldo) de uma origem num período.",
      S.obj({
        origin: S.enum(["devpaulo", "pessoal", "iservice"], "origem (default devpaulo)"),
        inicio: S.str("data inicial YYYY-MM-DD (default início do mês)"),
        fim: S.str("data final YYYY-MM-DD (default hoje)"),
      }),
      async (a) => {
        const origin = ["devpaulo", "pessoal", "iservice"].includes(str(a, "origin"))
          ? str(a, "origin")
          : "devpaulo";
        const hoje = todayISO();
        const inicio = /^\d{4}-\d{2}-\d{2}$/.test(str(a, "inicio"))
          ? str(a, "inicio")
          : `${hoje.slice(0, 7)}-01`;
        const fim = /^\d{4}-\d{2}-\d{2}$/.test(str(a, "fim")) ? str(a, "fim") : hoje;
        const { data, error } = await db
          .from("finance_entries")
          .select("type, amount")
          .eq("origin", origin)
          .gte("date", inicio)
          .lte("date", fim);
        if (error) return { erro: error.message };
        const rows = (data ?? []) as { type: string; amount: number }[];
        const entradas = rows.filter((r) => r.type === "entrada").reduce((s, r) => s + Number(r.amount), 0);
        const saidas = rows.filter((r) => r.type === "saida").reduce((s, r) => s + Number(r.amount), 0);
        return { origin, inicio, fim, entradas, saidas, saldo: entradas - saidas };
      }
    ),
    t(
      "get_finance_entries",
      "Lista lançamentos financeiros de uma origem num período.",
      S.obj({
        origin: S.enum(["devpaulo", "pessoal", "iservice"], "origem (default devpaulo)"),
        inicio: S.str("data inicial YYYY-MM-DD"),
        fim: S.str("data final YYYY-MM-DD"),
      }),
      async (a) => {
        const origin = ["devpaulo", "pessoal", "iservice"].includes(str(a, "origin"))
          ? str(a, "origin")
          : "devpaulo";
        const hoje = todayISO();
        const inicio = /^\d{4}-\d{2}-\d{2}$/.test(str(a, "inicio"))
          ? str(a, "inicio")
          : `${hoje.slice(0, 7)}-01`;
        const fim = /^\d{4}-\d{2}-\d{2}$/.test(str(a, "fim")) ? str(a, "fim") : hoje;
        const { data, error } = await db
          .from("finance_entries")
          .select("id, type, category, description, amount, date, transfer_group_id")
          .eq("origin", origin)
          .gte("date", inicio)
          .lte("date", fim)
          .order("date", { ascending: false })
          .limit(100);
        return error ? { erro: error.message } : data;
      }
    ),
    t(
      "create_finance_entry",
      "Lança uma entrada ou saída financeira.",
      S.obj(
        {
          origin: S.enum(["devpaulo", "pessoal", "iservice"], "origem"),
          type: S.enum(["entrada", "saida"], "tipo"),
          category: S.str("categoria (ex: projeto, mercado)"),
          amount: S.num("valor em reais"),
          description: S.str("descrição (opcional)"),
          date: S.str("data YYYY-MM-DD (default hoje)"),
        },
        ["origin", "type", "category", "amount"]
      ),
      async (a) => {
        const res = await inserirLancamento(db, {
          origin: str(a, "origin"),
          type: str(a, "type"),
          category: str(a, "category"),
          description: optStr(a, "description"),
          amount: numOr(a, "amount", NaN),
          date: /^\d{4}-\d{2}-\d{2}$/.test(str(a, "date")) ? str(a, "date") : todayISO(),
        });
        return res;
      }
    ),
    t(
      "update_finance_entry",
      "Edita categoria/descrição/valor/data de um lançamento (não edita perna de transferência).",
      S.obj(
        {
          id: S.str("id do lançamento"),
          category: S.str("categoria"),
          amount: S.num("valor"),
          description: S.str("descrição"),
          date: S.str("data YYYY-MM-DD"),
        },
        ["id", "category", "amount", "date"]
      ),
      async (a) => {
        const res = await atualizarLancamento(db, {
          id: str(a, "id"),
          category: str(a, "category"),
          description: optStr(a, "description"),
          amount: numOr(a, "amount", NaN),
          date: str(a, "date"),
        });
        return res;
      }
    ),
    t(
      "delete_finance_entry",
      "Exclui um lançamento. Se for transferência, remove o par inteiro.",
      S.obj({ id: S.str("id do lançamento") }, ["id"]),
      async (a) => {
        const id = str(a, "id");
        if (!id) return { erro: "id é obrigatório" };
        const { data: cur } = await db
          .from("finance_entries")
          .select("transfer_group_id")
          .eq("id", id)
          .maybeSingle();
        if (cur?.transfer_group_id) {
          const { error } = await db
            .from("finance_entries")
            .delete()
            .eq("transfer_group_id", cur.transfer_group_id);
          return error ? { erro: error.message } : { ok: true, par_transferencia: true };
        }
        const { data, error } = await db
          .from("finance_entries")
          .delete()
          .eq("id", id)
          .select("id");
        if (error) return { erro: error.message };
        return data?.length ? { ok: true } : { erro: "nada excluído (RLS/id)" };
      }
    ),

    /* ===================== AGENDAMENTO ===================== */
    t(
      "get_booking_links",
      "Lista links públicos de agendamento.",
      S.obj({}),
      async () => {
        const { data, error } = await db
          .from("booking_links")
          .select("id, slug, title, duration_minutes, meeting_type, active")
          .order("created_at", { ascending: false });
        return error ? { erro: error.message } : data;
      }
    ),
    t(
      "toggle_booking_link",
      "Ativa ou desativa um link de agendamento.",
      S.obj(
        { id: S.str("id do link"), active: S.bool("true=ativar, false=desativar") },
        ["id", "active"]
      ),
      async (a) => {
        const id = str(a, "id");
        if (!id) return { erro: "id é obrigatório" };
        const { data, error } = await db
          .from("booking_links")
          .update({ active: boolVal(a, "active"), updated_at: new Date().toISOString() })
          .eq("id", id)
          .select("id");
        if (error) return { erro: error.message };
        return data?.length ? { ok: true } : { erro: "nada atualizado (RLS/id)" };
      }
    ),
    t(
      "delete_booking_link",
      "Exclui um link de agendamento.",
      S.obj({ id: S.str("id do link") }, ["id"]),
      async (a) => {
        const id = str(a, "id");
        if (!id) return { erro: "id é obrigatório" };
        const { data, error } = await db
          .from("booking_links")
          .delete()
          .eq("id", id)
          .select("id");
        if (error) return { erro: error.message };
        return data?.length ? { ok: true } : { erro: "nada excluído (RLS/id)" };
      }
    ),
    t(
      "get_booking_blocks",
      "Lista bloqueios de horário do agendamento.",
      S.obj({}),
      async () => {
        const { data, error } = await db
          .from("booking_blocks")
          .select("id, title, date, start_time, end_time")
          .gte("date", todayISO())
          .order("date");
        return error ? { erro: error.message } : data;
      }
    ),
    t(
      "create_booking_block",
      "Cria um bloqueio de horário (impede agendamentos naquela faixa).",
      S.obj(
        {
          title: S.str("motivo do bloqueio"),
          date: S.str("data YYYY-MM-DD"),
          start_time: S.str("hora inicial HH:mm"),
          end_time: S.str("hora final HH:mm"),
        },
        ["title", "date", "start_time", "end_time"]
      ),
      async (a) => {
        const title = str(a, "title");
        const date = str(a, "date");
        const start = str(a, "start_time");
        const end = str(a, "end_time");
        if (!title || !date || !start || !end)
          return { erro: "title, date, start_time e end_time obrigatórios" };
        const { data, error } = await db
          .from("booking_blocks")
          .insert({ title, date, start_time: start, end_time: end })
          .select("id")
          .single();
        return error ? { erro: error.message } : { ok: true, id: data.id };
      }
    ),
    t(
      "delete_booking_block",
      "Remove um bloqueio de horário.",
      S.obj({ id: S.str("id do bloqueio") }, ["id"]),
      async (a) => {
        const id = str(a, "id");
        if (!id) return { erro: "id é obrigatório" };
        const { data, error } = await db
          .from("booking_blocks")
          .delete()
          .eq("id", id)
          .select("id");
        if (error) return { erro: error.message };
        return data?.length ? { ok: true } : { erro: "nada excluído (RLS/id)" };
      }
    ),

    /* ===================== ALERTAS ===================== */
    t(
      "get_alerts",
      "Lista alertas abertos.",
      S.obj({}),
      async () => {
        const { data, error } = await db
          .from("alerts")
          .select("id, type, severity, message, status")
          .eq("status", "aberto")
          .order("created_at", { ascending: false });
        return error ? { erro: error.message } : data;
      }
    ),
    t(
      "update_alert_status",
      "Resolve ou dispensa um alerta.",
      S.obj(
        { id: S.str("id do alerta"), status: S.enum(["resolvido", "dispensado"], "novo status") },
        ["id", "status"]
      ),
      async (a) => {
        const id = str(a, "id");
        const status = str(a, "status");
        if (!id || !["resolvido", "dispensado"].includes(status))
          return { erro: "id e status (resolvido|dispensado) obrigatórios" };
        const { data, error } = await db
          .from("alerts")
          .update({ status })
          .eq("id", id)
          .select("id");
        if (error) return { erro: error.message };
        return data?.length ? { ok: true } : { erro: "nada atualizado (RLS/id)" };
      }
    ),

    /* ===================== TREINO / DIETA ===================== */
    t(
      "get_treino_contexto",
      "Últimas sessões de treino e séries registradas.",
      S.obj({}),
      async () => {
        const [{ data: sessoes }, { data: series }] = await Promise.all([
          db
            .from("treino_sessoes")
            .select("id, data, observacoes, treino_dias(nome)")
            .order("data", { ascending: false })
            .limit(10),
          db
            .from("treino_series_registradas")
            .select("serie_num, reps, carga, rpe, exercicios(nome), treino_sessoes(data)")
            .order("created_at", { ascending: false })
            .limit(60),
        ]);
        return { sessoes: sessoes ?? [], series_recentes: series ?? [] };
      }
    ),
    t(
      "get_dieta_contexto",
      "Meta de dieta vigente e registros de hoje.",
      S.obj({}),
      async () => {
        const hoje = todayISO();
        const [{ data: meta }, { data: registros }] = await Promise.all([
          db
            .from("dieta_metas")
            .select("kcal_alvo, proteina_alvo, carbo_alvo, gordura_alvo, vigente_desde")
            .lte("vigente_desde", hoje)
            .order("vigente_desde", { ascending: false })
            .limit(1)
            .maybeSingle(),
          db
            .from("dieta_registros")
            .select("id, refeicao_nome, dieta_registro_itens(quantidade_g, alimentos(nome, kcal_100g))")
            .eq("data", hoje),
        ]);
        return { meta: meta ?? null, registros_hoje: registros ?? [] };
      }
    ),
    t(
      "registrar_serie",
      "Registra uma série de treino. Resolve o exercício pelo nome e cria/usa a sessão do dia.",
      S.obj(
        {
          exercicio_nome: S.str("nome do exercício (ex: supino reto)"),
          reps: S.num("repetições"),
          carga: S.num("carga em kg"),
          rpe: S.num("RPE 1-10 (opcional)"),
          data: S.str("data YYYY-MM-DD (default hoje)"),
        },
        ["exercicio_nome", "reps", "carga"]
      ),
      async (a) => {
        const nome = str(a, "exercicio_nome");
        const reps = numOr(a, "reps", 0);
        const carga = numOr(a, "carga", NaN);
        if (!nome || reps <= 0 || !Number.isFinite(carga))
          return { erro: "exercicio_nome, reps (>0) e carga obrigatórios" };
        const data = /^\d{4}-\d{2}-\d{2}$/.test(str(a, "data")) ? str(a, "data") : todayISO();

        const { data: ex } = await db
          .from("exercicios")
          .select("id, nome")
          .ilike("nome", `%${nome}%`)
          .limit(1)
          .maybeSingle();
        if (!ex) return { erro: `exercício "${nome}" não encontrado no catálogo` };

        let { data: sessao } = await db
          .from("treino_sessoes")
          .select("id")
          .eq("data", data)
          .order("id")
          .limit(1)
          .maybeSingle();
        if (!sessao) {
          const novo = await db
            .from("treino_sessoes")
            .insert({ data })
            .select("id")
            .single();
          if (novo.error) return { erro: novo.error.message };
          sessao = novo.data;
        }

        const { count } = await db
          .from("treino_series_registradas")
          .select("id", { count: "exact", head: true })
          .eq("sessao_id", sessao.id)
          .eq("exercicio_id", ex.id);
        const rpe = numOr(a, "rpe", NaN);
        const { error } = await db.from("treino_series_registradas").insert({
          sessao_id: sessao.id,
          exercicio_id: ex.id,
          serie_num: (count ?? 0) + 1,
          reps,
          carga,
          rpe: Number.isFinite(rpe) && rpe > 0 ? rpe : null,
        });
        return error
          ? { erro: error.message }
          : { ok: true, exercicio: ex.nome, serie: (count ?? 0) + 1 };
      }
    ),
    t(
      "registrar_refeicao",
      "Registra itens de uma refeição. Resolve cada alimento pelo nome no catálogo.",
      S.obj(
        {
          refeicao_nome: S.str("nome da refeição (ex: almoço)"),
          itens: {
            type: "array",
            description: "lista de itens da refeição",
            items: S.obj(
              {
                alimento_nome: S.str("nome do alimento"),
                quantidade_g: S.num("quantidade em gramas"),
              },
              ["alimento_nome", "quantidade_g"]
            ),
          },
          data: S.str("data YYYY-MM-DD (default hoje)"),
        },
        ["refeicao_nome", "itens"]
      ),
      async (a) => {
        const refeicao = str(a, "refeicao_nome");
        const itens = Array.isArray(a.itens) ? (a.itens as Args[]) : [];
        if (!refeicao || itens.length === 0)
          return { erro: "refeicao_nome e ao menos 1 item obrigatórios" };
        const data = /^\d{4}-\d{2}-\d{2}$/.test(str(a, "data")) ? str(a, "data") : todayISO();

        let { data: registro } = await db
          .from("dieta_registros")
          .select("id")
          .eq("data", data)
          .eq("refeicao_nome", refeicao)
          .maybeSingle();
        if (!registro) {
          const novo = await db
            .from("dieta_registros")
            .insert({ data, refeicao_nome: refeicao })
            .select("id")
            .single();
          if (novo.error) return { erro: novo.error.message };
          registro = novo.data;
        }

        const registrados: string[] = [];
        const naoAchados: string[] = [];
        for (const item of itens) {
          const anome = str(item, "alimento_nome");
          const qtd = numOr(item, "quantidade_g", NaN);
          if (!anome || !Number.isFinite(qtd) || qtd <= 0) continue;
          const { data: alim } = await db
            .from("alimentos")
            .select("id, nome")
            .ilike("nome", `%${anome}%`)
            .limit(1)
            .maybeSingle();
          if (!alim) {
            naoAchados.push(anome);
            continue;
          }
          await db.from("dieta_registro_itens").insert({
            registro_id: registro.id,
            alimento_id: alim.id,
            quantidade_g: qtd,
          });
          registrados.push(`${alim.nome} ${qtd}g`);
        }
        return { ok: true, refeicao, registrados, nao_encontrados: naoAchados };
      }
    ),
    t(
      "atualizar_meta_dieta",
      "Define/atualiza a meta de dieta vigente (kcal e macros).",
      S.obj(
        {
          kcal_alvo: S.num("kcal alvo"),
          proteina_alvo: S.num("proteína alvo (g)"),
          carbo_alvo: S.num("carboidrato alvo (g)"),
          gordura_alvo: S.num("gordura alvo (g)"),
        },
        ["kcal_alvo", "proteina_alvo", "carbo_alvo", "gordura_alvo"]
      ),
      async (a) => {
        const kcal = numOr(a, "kcal_alvo", 0);
        const prot = numOr(a, "proteina_alvo", 0);
        const carb = numOr(a, "carbo_alvo", 0);
        const gord = numOr(a, "gordura_alvo", 0);
        if (kcal <= 0) return { erro: "kcal_alvo deve ser maior que zero" };
        const hoje = todayISO();
        const valores = {
          kcal_alvo: kcal,
          proteina_alvo: prot,
          carbo_alvo: carb,
          gordura_alvo: gord,
        };
        const { data: existente } = await db
          .from("dieta_metas")
          .select("id")
          .eq("vigente_desde", hoje)
          .maybeSingle();
        if (existente) {
          const { error } = await db
            .from("dieta_metas")
            .update(valores)
            .eq("id", existente.id);
          return error ? { erro: error.message } : { ok: true, atualizada: true };
        }
        const { error } = await db
          .from("dieta_metas")
          .insert({ ...valores, vigente_desde: hoje });
        return error ? { erro: error.message } : { ok: true, criada: true };
      }
    ),

    /* ===================== iSERVICE ===================== */
    t(
      "get_roadmap",
      "Lista itens do roadmap da iService.",
      S.obj({}),
      async () => {
        const { data, error } = await db
          .from("roadmap_items")
          .select("id, phase, title, status, target_date, ordem")
          .order("ordem");
        return error ? { erro: error.message } : data;
      }
    ),
    t(
      "create_roadmap_item",
      "Cria um item de roadmap da iService.",
      S.obj(
        {
          phase: S.enum(["naming", "mvp", "beta", "lancamento"], "fase"),
          title: S.str("título do item"),
          target_date: S.str("data alvo YYYY-MM-DD (opcional)"),
        },
        ["phase", "title"]
      ),
      async (a) => {
        const phase = str(a, "phase");
        const title = str(a, "title");
        if (!["naming", "mvp", "beta", "lancamento"].includes(phase) || !title)
          return { erro: "phase válida e title obrigatórios" };
        const { data, error } = await db
          .from("roadmap_items")
          .insert({
            phase,
            title,
            target_date: /^\d{4}-\d{2}-\d{2}$/.test(str(a, "target_date"))
              ? str(a, "target_date")
              : null,
            ordem: 0,
          })
          .select("id")
          .single();
        return error ? { erro: error.message } : { ok: true, id: data.id };
      }
    ),
    t(
      "update_roadmap_item",
      "Edita status/título de um item do roadmap.",
      S.obj(
        {
          id: S.str("id do item"),
          status: S.enum(["pendente", "em_andamento", "concluido"], "status"),
          title: S.str("título"),
        },
        ["id"]
      ),
      async (a) => {
        const id = str(a, "id");
        if (!id) return { erro: "id é obrigatório" };
        const patch: Record<string, unknown> = {};
        if (["pendente", "em_andamento", "concluido"].includes(str(a, "status")))
          patch.status = str(a, "status");
        if (str(a, "title")) patch.title = str(a, "title");
        const { data, error } = await db
          .from("roadmap_items")
          .update(patch)
          .eq("id", id)
          .select("id");
        if (error) return { erro: error.message };
        return data?.length ? { ok: true, id } : { erro: "nada atualizado (RLS/id)" };
      }
    ),
    t(
      "delete_roadmap_item",
      "Exclui um item de roadmap.",
      S.obj({ id: S.str("id do item") }, ["id"]),
      async (a) => {
        const id = str(a, "id");
        if (!id) return { erro: "id é obrigatório" };
        const { data, error } = await db
          .from("roadmap_items")
          .delete()
          .eq("id", id)
          .select("id");
        if (error) return { erro: error.message };
        return data?.length ? { ok: true } : { erro: "nada excluído (RLS/id)" };
      }
    ),
    t(
      "get_decisoes",
      "Lista decisões da startup iService.",
      S.obj({}),
      async () => {
        const { data, error } = await db
          .from("startup_decisions")
          .select("id, topic, status, decided_option, options")
          .order("created_at", { ascending: false });
        return error ? { erro: error.message } : data;
      }
    ),
    t(
      "create_decisao",
      "Registra uma decisão em aberto da iService.",
      S.obj(
        { topic: S.str("tema da decisão"), context: S.str("contexto (opcional)") },
        ["topic"]
      ),
      async (a) => {
        const topic = str(a, "topic");
        if (!topic) return { erro: "topic é obrigatório" };
        const { data, error } = await db
          .from("startup_decisions")
          .insert({ topic, context: optStr(a, "context"), options: [] })
          .select("id")
          .single();
        return error ? { erro: error.message } : { ok: true, id: data.id };
      }
    ),
    t(
      "decidir_opcao",
      "Marca uma decisão como decidida com a opção escolhida.",
      S.obj(
        { id: S.str("id da decisão"), decided_option: S.str("opção escolhida") },
        ["id", "decided_option"]
      ),
      async (a) => {
        const id = str(a, "id");
        const opcao = str(a, "decided_option");
        if (!id || !opcao) return { erro: "id e decided_option obrigatórios" };
        const { data, error } = await db
          .from("startup_decisions")
          .update({
            status: "decidida",
            decided_option: opcao,
            decided_at: new Date().toISOString(),
          })
          .eq("id", id)
          .select("id");
        if (error) return { erro: error.message };
        return data?.length ? { ok: true } : { erro: "nada atualizado (RLS/id)" };
      }
    ),

    /* ===================== MEMÓRIA DO AGENTE ===================== */
    t(
      "remember_fact",
      "Guarda um fato/preferência na memória do agente. SÓ chame quando o Paulo pedir explicitamente pra lembrar de algo ('lembra disso', 'guarda que...', 'a partir de agora...').",
      S.obj({ content: S.str("o fato/preferência a guardar, em uma frase clara") }, ["content"]),
      async (a) => {
        const content = str(a, "content");
        if (!content) return { erro: "content é obrigatório" };
        const { data, error } = await db
          .from("agent_memories")
          .insert({ content })
          .select("id")
          .single();
        return error ? { erro: error.message } : { ok: true, id: data.id };
      }
    ),
    t(
      "list_memories",
      "Lista tudo que está guardado na memória do agente.",
      S.obj({}),
      async () => {
        const { data, error } = await db
          .from("agent_memories")
          .select("id, content, created_at")
          .order("created_at", { ascending: false });
        return error ? { erro: error.message } : data;
      }
    ),
    t(
      "forget_memory",
      "Apaga um item da memória do agente pelo id (use list_memories antes pra achar o id).",
      S.obj({ id: S.str("id da memória") }, ["id"]),
      async (a) => {
        const id = str(a, "id");
        if (!id) return { erro: "id é obrigatório" };
        const { data, error } = await db
          .from("agent_memories")
          .delete()
          .eq("id", id)
          .select("id");
        if (error) return { erro: error.message };
        return data?.length ? { ok: true } : { erro: "nada excluído (RLS/id)" };
      }
    ),
  ];
}
