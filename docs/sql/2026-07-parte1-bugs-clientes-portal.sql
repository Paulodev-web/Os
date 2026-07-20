-- Parte 1 (devpaulo.com.br) — Etapa 1: correção dos bugs de Clientes/Portal
-- Rodar no SQL Editor do projeto Supabase (dashboard) — MCP supabase indisponível nesta sessão.
--
-- Contexto: os bugs de "criar marco" e "upload de foto" no os-pessoal têm causa provável em
-- RLS/Storage faltando. O código já foi corrigido pra mostrar o erro real (banner vermelho) em
-- vez de falhar em silêncio — rode este script E teste na tela antes de considerar resolvido:
-- se o erro mostrado no banner for diferente do que essas policies cobrem, ajuste a policy real
-- em vez de forçar o script abaixo.

-- 1) Inspecionar policies atuais (rode isso primeiro e compare project_milestones/project_assets com tasks)
select schemaname, tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'os_pessoal'
  and tablename in ('project_milestones', 'project_assets', 'tasks')
order by tablename, cmd;

-- 2) Se faltar policy de escrita em project_milestones/project_assets para authenticated,
--    aplicar (mesmo shape usado nas outras tabelas do painel — dono único, sem multi-tenant):
create policy "authenticated full access" on os_pessoal.project_milestones
  for all to authenticated using (true) with check (true);

create policy "authenticated full access" on os_pessoal.project_assets
  for all to authenticated using (true) with check (true);

-- 3) Bucket de Storage pro upload de assets do portal (provavelmente não existe ainda)
insert into storage.buckets (id, name, public)
values ('portal-assets', 'portal-assets', true)
on conflict (id) do nothing;

-- 4) Policies de Storage — só authenticated escreve; leitura pública já é coberta pelo
--    endpoint /storage/v1/object/public/... (bucket marcado como public acima, não precisa de
--    policy de select pra isso funcionar)
create policy "portal-assets insert (owner)" on storage.objects
  for insert to authenticated with check (bucket_id = 'portal-assets');

create policy "portal-assets update (owner)" on storage.objects
  for update to authenticated using (bucket_id = 'portal-assets');

create policy "portal-assets delete (owner)" on storage.objects
  for delete to authenticated using (bucket_id = 'portal-assets');
