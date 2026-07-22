-- Parte 2 (devpaulo.com.br) — Portal do cliente por etapas + upload em galeria
-- Rodar no SQL Editor do projeto Supabase (dashboard) — MCP supabase indisponível nesta sessão.
--
-- Contexto: reestrutura o portal público (/c/[token]) pra mostrar fases fixas
-- (stepper), escopo do projeto, próxima ação do cliente e arquivos/entregáveis
-- agregados. Precisa de colunas novas em projects/project_milestones e de
-- reescrever a RPC portal_do_cliente (que só existe no banco, não neste repo).

-- 1) Colunas novas em projects — todas nullable, não quebra dado existente
alter table os_pessoal.projects
  add column if not exists current_phase text,
  add column if not exists current_phase_target_date date,
  add column if not exists scope_included text,
  add column if not exists scope_excluded text,
  add column if not exists next_action text,
  add column if not exists next_action_date date;

-- 2) Coluna nova em project_milestones — tag de fase (opcional)
alter table os_pessoal.project_milestones
  add column if not exists phase text;

-- 3) Reescreve a RPC pública portal_do_cliente(token)
--
-- IMPORTANTE: esta função é reconstruída a partir do comportamento documentado
-- (README.md / código de app/c/[token]/page.tsx), já que a definição atual só
-- existe no dashboard e não foi possível puxá-la nesta sessão (sem acesso MCP
-- ao Supabase). Antes de rodar em produção, compare com a versão atual em
-- Database → Functions no dashboard — se ela tiver alguma lógica extra não
-- documentada aqui, ajuste este script antes de aplicar. Mantém o invariante
-- de segurança original: só retorna marcos publicados e assets ligados a eles
-- (ou, agora, assets do projeto sem marco — ver seção "arquivos" abaixo).
create or replace function os_pessoal.portal_do_cliente(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = os_pessoal, public
as $$
declare
  v_client_id uuid;
  v_result jsonb;
begin
  select id into v_client_id
  from os_pessoal.clients
  where portal_token = p_token;

  if v_client_id is null then
    return null;
  end if;

  select jsonb_build_object(
    'cliente', c.name,
    'projetos', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', p.id,
          'nome', p.name,
          'status', p.status,
          'descricao', p.description,
          'iniciado_em', p.started_at,
          'fase_atual', p.current_phase,
          'fase_atual_previsao', p.current_phase_target_date,
          'escopo_incluido', p.scope_included,
          'escopo_excluido', p.scope_excluded,
          'proxima_acao', p.next_action,
          'proxima_acao_data', p.next_action_date,
          'marcos', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'titulo', m.title,
                'descricao', m.description,
                'publicado_em', m.published_at,
                'fase', m.phase,
                'assets', coalesce((
                  select jsonb_agg(
                    jsonb_build_object(
                      'tipo', a.type,
                      'titulo', a.title,
                      'storage_path', a.storage_path,
                      'url_externa', a.external_url
                    ) order by a.created_at
                  )
                  from os_pessoal.project_assets a
                  where a.milestone_id = m.id
                ), '[]'::jsonb)
              ) order by m.published_at
            )
            from os_pessoal.project_milestones m
            where m.project_id = p.id and m.published = true
          ), '[]'::jsonb),
          -- Arquivos/entregáveis do projeto (sem marco): contrato, nota fiscal,
          -- link de protótipo etc. Antes eram ocultados do portal; agora
          -- aparecem na seção "Arquivos do projeto".
          'arquivos', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'tipo', a.type,
                'titulo', a.title,
                'storage_path', a.storage_path,
                'url_externa', a.external_url
              ) order by a.created_at
            )
            from os_pessoal.project_assets a
            where a.project_id = p.id and a.milestone_id is null
          ), '[]'::jsonb)
        ) order by p.created_at
      )
      from os_pessoal.projects p
      where p.client_id = c.id
    ), '[]'::jsonb)
  )
  into v_result
  from os_pessoal.clients c
  where c.id = v_client_id;

  return v_result;
end;
$$;

grant execute on function os_pessoal.portal_do_cliente(text) to anon;
