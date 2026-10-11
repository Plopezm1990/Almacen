-- Post-reset schema contract repair.
-- Scope: restore the PM07 stock view and the callable contract of the two
-- private membership helpers without replacing either helper body.
-- Prepared only; do not apply to QA/PROD without explicit authorization.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

-- Fail closed if the expected post-reset primitives are not present.
do $preflight$
declare
  v_missing text[] := array[]::text[];
begin
  if to_regclass('public.stock_ubicacion') is null then
    v_missing := array_append(v_missing, 'public.stock_ubicacion');
  end if;
  if to_regprocedure('private.la_tiene_empresa(text)') is null then
    v_missing := array_append(v_missing, 'private.la_tiene_empresa(text)');
  end if;
  if to_regprocedure('private.la_tiene_local(text,text)') is null then
    v_missing := array_append(v_missing, 'private.la_tiene_local(text,text)');
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    v_missing := array_append(v_missing, 'role authenticated');
  end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    v_missing := array_append(v_missing, 'role anon');
  end if;

  if cardinality(v_missing) > 0 then
    raise exception 'post_reset_schema_contract_preflight_missing: %', array_to_string(v_missing, ', ');
  end if;

  if not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private'
      and p.proname = 'la_tiene_empresa'
      and pg_get_function_identity_arguments(p.oid) = 'p_empresa text'
      and p.prosecdef
      and p.provolatile = 's'
  ) then
    raise exception 'post_reset_schema_contract_preflight_bad_empresa_helper';
  end if;

  if not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private'
      and p.proname = 'la_tiene_local'
      and pg_get_function_identity_arguments(p.oid) = 'p_empresa text, p_local text'
      and p.prosecdef
      and p.provolatile = 's'
  ) then
    raise exception 'post_reset_schema_contract_preflight_bad_local_helper';
  end if;

  if exists (
    select required.column_name
    from (values
      ('empresa_id'), ('local_id'), ('producto_id'), ('almacen'), ('piso'),
      ('minimo'), ('fraccionable'), ('precision_cantidad'), ('updated_at'),
      ('local_operable')
    ) as required(column_name)
    where not exists (
      select 1
      from information_schema.columns c
      where c.table_schema = 'public'
        and c.table_name = 'stock_ubicacion'
        and c.column_name = required.column_name
    )
  ) then
    raise exception 'post_reset_schema_contract_preflight_stock_shape_mismatch';
  end if;
end
$preflight$;

-- Preserve the current helper bodies. Restore only their hardened execution
-- context and the least-privilege callable contract used by RLS policies.
alter function private.la_tiene_empresa(text)
  set search_path to public, auth, private, pg_temp;
alter function private.la_tiene_local(text, text)
  set search_path to public, auth, private, pg_temp;

revoke all on function private.la_tiene_empresa(text) from public, anon;
revoke all on function private.la_tiene_local(text, text) from public, anon;
grant execute on function private.la_tiene_empresa(text) to authenticated;
grant execute on function private.la_tiene_local(text, text) to authenticated;

-- Exact PM07 runtime projection. SECURITY INVOKER is required so the view
-- continues to respect stock_ubicacion RLS for the authenticated caller.
create or replace view public.stock_estado
with (security_invoker = true)
as
select
  empresa_id,
  local_id,
  producto_id,
  almacen,
  piso,
  round(almacen + piso, 6) as total,
  minimo,
  round(almacen + piso, 6) < minimo as bajo_minimo,
  fraccionable,
  precision_cantidad,
  updated_at,
  local_operable
from public.stock_ubicacion;

-- Do not expose the stock projection anonymously. Authenticated clients only
-- need SELECT; writes remain on the underlying guarded RPC/table contracts.
revoke all on public.stock_estado from public, anon, authenticated;
grant select on public.stock_estado to authenticated;
grant select on public.stock_estado to service_role;

-- Contract assertions inside the same transaction.
do $postflight$
begin
  if not has_function_privilege('authenticated', 'private.la_tiene_empresa(text)', 'EXECUTE') then
    raise exception 'post_reset_schema_contract_empresa_execute_missing';
  end if;
  if not has_function_privilege('authenticated', 'private.la_tiene_local(text,text)', 'EXECUTE') then
    raise exception 'post_reset_schema_contract_local_execute_missing';
  end if;
  if has_function_privilege('anon', 'private.la_tiene_empresa(text)', 'EXECUTE')
     or has_function_privilege('anon', 'private.la_tiene_local(text,text)', 'EXECUTE') then
    raise exception 'post_reset_schema_contract_anon_helper_execute';
  end if;
  if not has_table_privilege('authenticated', 'public.stock_estado', 'SELECT') then
    raise exception 'post_reset_schema_contract_stock_select_missing';
  end if;
  if has_table_privilege('anon', 'public.stock_estado', 'SELECT') then
    raise exception 'post_reset_schema_contract_stock_anon_select';
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
    raise exception 'post_reset_schema_contract_stock_not_security_invoker';
  end if;
  if not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private'
      and p.proname = 'la_tiene_empresa'
      and p.proconfig @> array['search_path=public, auth, private, pg_temp']::text[]
  ) then
    raise exception 'post_reset_schema_contract_empresa_search_path';
  end if;
  if not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private'
      and p.proname = 'la_tiene_local'
      and p.proconfig @> array['search_path=public, auth, private, pg_temp']::text[]
  ) then
    raise exception 'post_reset_schema_contract_local_search_path';
  end if;
end
$postflight$;

commit;
