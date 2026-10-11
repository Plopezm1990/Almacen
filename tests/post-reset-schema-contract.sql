\set ON_ERROR_STOP on

create role authenticated nologin;
create role anon nologin;
create role service_role nologin;
create schema if not exists auth;
create schema if not exists private;

create table public.stock_ubicacion (
  empresa_id text not null,
  local_id text not null,
  producto_id text not null,
  almacen numeric(18,6) not null default 0,
  piso numeric(18,6) not null default 0,
  minimo numeric(18,6) not null default 0,
  fraccionable boolean not null default false,
  precision_cantidad smallint not null default 0,
  updated_at timestamptz not null default now(),
  local_operable boolean not null default true,
  primary key (empresa_id, local_id, producto_id)
);

alter table public.stock_ubicacion enable row level security;
grant select on public.stock_ubicacion to authenticated;

-- Simulate the post-reset helper contract: correct current logic bodies,
-- SECURITY DEFINER/STABLE, but empty search_path and missing empresa EXECUTE.
create function private.la_tiene_empresa(p_empresa text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$ select p_empresa = 'empresa-ok' $$;

create function private.la_tiene_local(p_empresa text, p_local text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$ select p_empresa = 'empresa-ok' and p_local = 'local-ok' $$;

revoke all on function private.la_tiene_empresa(text) from public;
revoke all on function private.la_tiene_local(text, text) from public;
grant execute on function private.la_tiene_local(text, text) to authenticated;
grant usage on schema private to authenticated;

create policy fixture_stock_select on public.stock_ubicacion
for select to authenticated
using (private.la_tiene_local(empresa_id, local_id));

insert into public.stock_ubicacion(
  empresa_id, local_id, producto_id, almacen, piso, minimo,
  fraccionable, precision_cantidad, local_operable
) values
  ('empresa-ok', 'local-ok', 'producto-1', 5, 2, 3, false, 0, true),
  ('empresa-no', 'local-no', 'producto-2', 9, 1, 20, false, 0, true);

create temporary table helper_body_before as
select p.proname, pg_get_function_identity_arguments(p.oid) as args, md5(p.prosrc) as body_md5
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'private'
  and p.proname in ('la_tiene_empresa', 'la_tiene_local');

\ir ../supabase/migrations/20260915132000_post_reset_schema_contract_repair.sql

-- The migration must preserve function logic byte-for-byte.
do $verify_bodies$
begin
  if exists (
    select 1
    from helper_body_before b
    join pg_proc p on p.proname = b.proname
    join pg_namespace n on n.oid = p.pronamespace and n.nspname = 'private'
    where pg_get_function_identity_arguments(p.oid) = b.args
      and md5(p.prosrc) <> b.body_md5
  ) then
    raise exception 'helper_body_changed';
  end if;
end
$verify_bodies$;

-- ACL/configuration contract.
do $verify_acl$
begin
  if not has_function_privilege('authenticated', 'private.la_tiene_empresa(text)', 'EXECUTE') then
    raise exception 'authenticated_empresa_execute_missing';
  end if;
  if not has_function_privilege('authenticated', 'private.la_tiene_local(text,text)', 'EXECUTE') then
    raise exception 'authenticated_local_execute_missing';
  end if;
  if has_function_privilege('anon', 'private.la_tiene_empresa(text)', 'EXECUTE')
     or has_function_privilege('anon', 'private.la_tiene_local(text,text)', 'EXECUTE') then
    raise exception 'anon_helper_execute_present';
  end if;
  if not has_table_privilege('authenticated', 'public.stock_estado', 'SELECT') then
    raise exception 'authenticated_stock_select_missing';
  end if;
  if has_table_privilege('authenticated', 'public.stock_estado', 'INSERT')
     or has_table_privilege('authenticated', 'public.stock_estado', 'UPDATE')
     or has_table_privilege('authenticated', 'public.stock_estado', 'DELETE') then
    raise exception 'authenticated_stock_write_present';
  end if;
  if has_table_privilege('anon', 'public.stock_estado', 'SELECT') then
    raise exception 'anon_stock_select_present';
  end if;
  if not exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'stock_estado'
      and c.relkind = 'v'
      and coalesce(c.reloptions, array[]::text[]) @> array['security_invoker=true']::text[]
  ) then
    raise exception 'stock_estado_not_security_invoker';
  end if;
end
$verify_acl$;

-- SECURITY INVOKER + underlying RLS must expose only the permitted stock row.
set role authenticated;
do $verify_runtime$
declare
  v_count integer;
  v_total numeric;
  v_bajo boolean;
begin
  select count(*), max(total), bool_or(bajo_minimo)
    into v_count, v_total, v_bajo
  from public.stock_estado;

  if v_count <> 1 then
    raise exception 'stock_estado_rls_count: %', v_count;
  end if;
  if v_total <> 7.000000 then
    raise exception 'stock_estado_total: %', v_total;
  end if;
  if coalesce(v_bajo, true) then
    raise exception 'stock_estado_bajo_minimo_unexpected';
  end if;
end
$verify_runtime$;
reset role;

select 'PASS ephemeral postgres schema contract' as result;
