-- Parte 1 (devpaulo.com.br) — Etapa 3: agendamento nativo, base pra aposentar o ReuniCheck
-- Rodar no SQL Editor do projeto Supabase (schema os_pessoal) — MCP supabase indisponível
-- nesta sessão. Rode em ordem, de cima pra baixo. Os passos 1-2 pedem uma decisão manual
-- (ver o resultado do select antes de escolher 2a ou 2b).

-- 1) Inspecionar o tipo real de meetings.source antes de alterar
select column_name, data_type, udt_name
from information_schema.columns
where table_schema = 'os_pessoal' and table_name = 'meetings' and column_name = 'source';

-- 2a) Se udt_name apontar pra um enum nativo (não "text"/"varchar"), rode:
-- alter type os_pessoal.<nome_do_enum> add value if not exists 'ia';
-- alter type os_pessoal.<nome_do_enum> add value if not exists 'os_pessoal';

-- 2b) Se for text + CHECK constraint, rode (troque <nome_da_check> pelo nome real,
--     visível em information_schema.table_constraints ou no editor de tabela do dashboard):
-- alter table os_pessoal.meetings drop constraint <nome_da_check>;
-- alter table os_pessoal.meetings add constraint <nome_da_check>
--   check (source in ('manual', 'reunicheck', 'ia', 'os_pessoal'));
--
-- Nota: 'ia' só vai ser usado quando a Frente 3.1 (Agente central) for construída — está sendo
-- adicionado aqui pra evitar um segundo ALTER TYPE/CHECK depois.

-- 3) Tabelas novas
create table os_pessoal.booking_links (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  space_id uuid not null references os_pessoal.spaces(id),
  title text not null,
  description text,
  duration_minutes int not null check (duration_minutes > 0),
  meeting_type text not null default 'comercial',
  slots jsonb not null default '[]'::jsonb, -- [{ "date": "YYYY-MM-DD", "times": ["09:00","09:30"] }]
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table os_pessoal.booking_blocks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  date date not null,
  start_time time not null,
  end_time time not null,
  created_at timestamptz not null default now()
);

alter table os_pessoal.meetings
  add column if not exists booking_link_id uuid references os_pessoal.booking_links(id) on delete set null,
  add column if not exists client_name text,
  add column if not exists client_contact text,
  add column if not exists duration_minutes int;

-- protege contra double-booking dentro do mesmo link (equivalente ao 23505 do ReuniCheck)
create unique index if not exists meetings_booking_slot_unique
  on os_pessoal.meetings (booking_link_id, scheduled_at)
  where booking_link_id is not null;

-- 4) RLS — só authenticated mexe direto; acesso público é só via as RPCs abaixo
alter table os_pessoal.booking_links enable row level security;
alter table os_pessoal.booking_blocks enable row level security;

create policy "authenticated full access" on os_pessoal.booking_links
  for all to authenticated using (true) with check (true);
create policy "authenticated full access" on os_pessoal.booking_blocks
  for all to authenticated using (true) with check (true);

-- 5) RPCs security-definer (mesmo padrão de os_pessoal.portal_do_cliente)

create or replace function os_pessoal.public_booking_link(p_slug text)
returns jsonb
language plpgsql
security definer
set search_path = os_pessoal, public
as $$
declare
  v_link os_pessoal.booking_links%rowtype;
  v_ocupados jsonb;
  v_bloqueios jsonb;
begin
  select * into v_link from os_pessoal.booking_links where slug = p_slug and active = true;
  if not found then
    return null;
  end if;

  -- só os horários (scheduled_at), nunca client_name/client_contact de quem já marcou
  select coalesce(jsonb_agg(scheduled_at), '[]'::jsonb) into v_ocupados
  from os_pessoal.meetings
  where booking_link_id = v_link.id and status = 'agendada';

  -- bloqueios: omite "title" de propósito pra não vazar detalhe da agenda pessoal
  select coalesce(jsonb_agg(jsonb_build_object('date', date, 'start_time', start_time, 'end_time', end_time)), '[]'::jsonb)
  into v_bloqueios
  from os_pessoal.booking_blocks
  where date >= current_date;

  return jsonb_build_object(
    'title', v_link.title,
    'description', v_link.description,
    'duration_minutes', v_link.duration_minutes,
    'slots', v_link.slots,
    'ocupados', v_ocupados,
    'bloqueios', v_bloqueios
  );
end;
$$;

grant execute on function os_pessoal.public_booking_link(text) to anon, authenticated;

create or replace function os_pessoal.criar_agendamento(
  p_slug text,
  p_date date,
  p_time text,
  p_client_name text,
  p_client_contact text
)
returns jsonb
language plpgsql
security definer
set search_path = os_pessoal, public
as $$
declare
  v_link os_pessoal.booking_links%rowtype;
  v_scheduled_at timestamptz;
  v_end_at timestamptz;
  v_meeting_id uuid;
begin
  select * into v_link from os_pessoal.booking_links where slug = p_slug and active = true;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'link_not_found');
  end if;

  if not exists (
    select 1 from jsonb_array_elements(v_link.slots) s
    where (s->>'date') = p_date::text and s->'times' ? p_time
  ) then
    return jsonb_build_object('ok', false, 'reason', 'slot_not_available');
  end if;

  v_scheduled_at := (p_date::text || ' ' || p_time || ':00')::timestamp at time zone 'America/Sao_Paulo';
  if v_scheduled_at < now() then
    return jsonb_build_object('ok', false, 'reason', 'slot_in_past');
  end if;
  v_end_at := v_scheduled_at + make_interval(mins => v_link.duration_minutes);

  if exists (
    select 1 from os_pessoal.booking_blocks b
    where b.date = p_date
      and (p_time::time) < b.end_time
      and (v_end_at::time) > b.start_time
  ) then
    return jsonb_build_object('ok', false, 'reason', 'blocked');
  end if;

  -- protege contra colisão com QUALQUER reunião existente, não só do mesmo link
  -- (decisão de robustez além do desenho original do ReuniCheck — reunião manual sem
  -- duration_minutes assume 60min só pra esse cálculo, não é persistido)
  if exists (
    select 1 from os_pessoal.meetings m
    where m.status = 'agendada'
      and v_scheduled_at < (m.scheduled_at + make_interval(mins => coalesce(m.duration_minutes, 60)))
      and v_end_at > m.scheduled_at
  ) then
    return jsonb_build_object('ok', false, 'reason', 'slot_taken');
  end if;

  begin
    insert into os_pessoal.meetings (
      space_id, title, type, scheduled_at, status, source,
      booking_link_id, client_name, client_contact, duration_minutes
    ) values (
      v_link.space_id,
      v_link.title || ' — ' || p_client_name,
      v_link.meeting_type,
      v_scheduled_at,
      'agendada',
      'os_pessoal',
      v_link.id,
      p_client_name,
      nullif(p_client_contact, ''),
      v_link.duration_minutes
    )
    returning id into v_meeting_id;
  exception when unique_violation then
    return jsonb_build_object('ok', false, 'reason', 'slot_taken');
  end;

  return jsonb_build_object('ok', true, 'meeting_id', v_meeting_id);
end;
$$;

grant execute on function os_pessoal.criar_agendamento(text, date, text, text, text) to anon, authenticated;
