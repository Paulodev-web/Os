-- Parte 3 (devpaulo.com.br) — Agente central + CRUD completo
-- Rodar no SQL Editor do projeto Supabase (schema os_pessoal) — MCP indisponível
-- nesta sessão. Rode de cima pra baixo; os passos 1 e 4 pedem inspeção antes.

-- =====================================================================
-- 1) meetings.source: incluir 'ia' (o agente marca reuniões que ele cria)
-- =====================================================================
-- Inspecione o tipo real primeiro:
select column_name, data_type, udt_name
from information_schema.columns
where table_schema = 'os_pessoal'
  and table_name = 'meetings'
  and column_name = 'source';

-- 1a) Se udt_name for um enum nativo (não text/varchar), rode (troque o nome):
-- alter type os_pessoal.<nome_do_enum> add value if not exists 'ia';

-- 1b) Se for text + CHECK, rode (troque <nome_da_check> pelo nome real, visível
--     em information_schema.table_constraints):
-- alter table os_pessoal.meetings drop constraint <nome_da_check>;
-- alter table os_pessoal.meetings add constraint <nome_da_check>
--   check (source in ('manual', 'reunicheck', 'ia', 'os_pessoal'));
--
-- Obs: 'os_pessoal' já foi adicionado na Parte 1 (agendamento nativo). Se o
-- valor 'ia' já existir, os comandos acima são no-op / podem ser pulados.

-- =====================================================================
-- 2) Memória do agente — tabela nova
-- =====================================================================
create table if not exists os_pessoal.agent_memories (
  id uuid primary key default gen_random_uuid(),
  content text not null,
  space_id uuid references os_pessoal.spaces(id), -- null = geral (não específico de um espaço)
  created_at timestamptz not null default now()
);

alter table os_pessoal.agent_memories enable row level security;

-- dono único, sem multi-tenant (mesmo shape do resto do painel)
drop policy if exists "authenticated full access" on os_pessoal.agent_memories;
create policy "authenticated full access" on os_pessoal.agent_memories
  for all to authenticated using (true) with check (true);

-- =====================================================================
-- 3) tasks.source: 'ia' já existe no enum/type — nenhuma migração necessária
--    (confirmado por leitura de lib/database.types.ts). Nada a fazer aqui.
-- =====================================================================

-- =====================================================================
-- 4) CRUD completo — confirmar policy de UPDATE/DELETE nas tabelas que
--    ganharam edição/exclusão nesta rodada (clientes, projetos) e nas que o
--    agente agora escreve. Inspecione antes de aplicar:
-- =====================================================================
select schemaname, tablename, policyname, cmd, roles
from pg_policies
where schemaname = 'os_pessoal'
  and tablename in (
    'clients', 'projects', 'project_milestones', 'project_assets',
    'tasks', 'meetings', 'leads', 'proposals', 'finance_entries',
    'booking_links', 'booking_blocks', 'alerts', 'roadmap_items',
    'startup_decisions', 'treino_sessoes', 'treino_series_registradas',
    'dieta_registros', 'dieta_registro_itens', 'dieta_metas'
  )
order by tablename, cmd;

-- Onde faltar policy de escrita (UPDATE/DELETE) para authenticated, aplicar o
-- mesmo shape. Exemplos das tabelas com lacuna conhecida (clients e projects
-- nunca tinham sido checadas):
--
-- create policy "authenticated full access" on os_pessoal.clients
--   for all to authenticated using (true) with check (true);
-- create policy "authenticated full access" on os_pessoal.projects
--   for all to authenticated using (true) with check (true);
--
-- IMPORTANTE: o código já mostra banner de erro quando um DELETE/UPDATE não
-- afeta nenhuma linha (guard de RLS silenciosa via .select()). Se aparecer
-- "Nada foi excluído/atualizado — provável falta de permissão (RLS)", é aqui
-- que se resolve: crie a policy que estiver faltando para aquela tabela.
