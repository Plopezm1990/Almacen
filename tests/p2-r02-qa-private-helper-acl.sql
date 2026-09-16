\set ON_ERROR_STOP on

create role anon nologin;
create role authenticated nologin;
create schema private;
grant usage on schema private to authenticated;

create function private.pm06_proteger_identidad_y_total() returns boolean
language sql stable security definer set search_path='public','private','pg_temp'
as $$ select true $$;
create function private.pm06_proyectar_gasto_factura() returns boolean
language sql stable security definer set search_path='public','private','pg_temp'
as $$ select true $$;
create function private.pm06_puede_gestionar_finanzas() returns boolean
language sql stable security definer set search_path='public','private','pg_temp'
as $$ select true $$;
create function private.pm06_total_factura(text,text,text,text) returns numeric
language sql stable security definer set search_path='public','private','pg_temp'
as $$ select 1::numeric $$;
create function private.pm06_validar_proveedor_compatible() returns boolean
language sql stable security definer set search_path='public','private','pg_temp'
as $$ select true $$;
create function private.pm07_puede_gestionar_stock() returns boolean
language sql stable security definer set search_path='public','private','pg_temp'
as $$ select true $$;
create function private.pm07_puede_vender() returns boolean
language sql stable security definer set search_path='public','private','pg_temp'
as $$ select true $$;
create function private.pm14_total_encargo(text,text,text) returns numeric
language sql stable security definer set search_path='public','private','pg_temp'
as $$ select 1::numeric $$;

-- Probe de policy: la helper financiera debe seguir siendo invocable por authenticated.
create table public.finance_probe(id int primary key);
insert into public.finance_probe values (1);
alter table public.finance_probe enable row level security;
grant select on public.finance_probe to authenticated;
create policy finance_probe_select on public.finance_probe for select to authenticated
using (private.pm06_puede_gestionar_finanzas());

\i supabase/migrations/20260916040900_p2_r02_qa_alinear_acl_helpers_privados.sql

do $p2_r02_qa_acl_smoke$
declare
  r regprocedure;
begin
  foreach r in array array[
    'private.pm06_proteger_identidad_y_total()'::regprocedure,
    'private.pm06_proyectar_gasto_factura()'::regprocedure,
    'private.pm06_total_factura(text,text,text,text)'::regprocedure,
    'private.pm06_validar_proveedor_compatible()'::regprocedure,
    'private.pm07_puede_gestionar_stock()'::regprocedure,
    'private.pm07_puede_vender()'::regprocedure,
    'private.pm14_total_encargo(text,text,text)'::regprocedure
  ] loop
    if has_function_privilege('authenticated',r,'EXECUTE') then
      raise exception 'P2-R02 QA ACL_FALLO: authenticated conserva EXECUTE sobre %',r;
    end if;
    if has_function_privilege('anon',r,'EXECUTE') then
      raise exception 'P2-R02 QA ACL_FALLO: anon/PUBLIC conserva EXECUTE sobre %',r;
    end if;
    if not exists (select 1 from pg_proc p where p.oid=r::oid and p.prosecdef) then
      raise exception 'P2-R02 QA ACL_FALLO: % dejo de ser SECURITY DEFINER',r;
    end if;
  end loop;

  r := 'private.pm06_puede_gestionar_finanzas()'::regprocedure;
  if not has_function_privilege('authenticated',r,'EXECUTE') then
    raise exception 'P2-R02 QA ACL_FALLO: helper financiera perdio EXECUTE authenticated';
  end if;
  if has_function_privilege('anon',r,'EXECUTE') then
    raise exception 'P2-R02 QA ACL_FALLO: helper financiera conserva EXECUTE anon/PUBLIC';
  end if;

  raise notice 'P2_R02_QA_ACL_SMOKE=PASS';
end
$p2_r02_qa_acl_smoke$;

set role authenticated;
select case when count(*)=1 then 1 else 1/0 end as finance_policy_ok
from public.finance_probe;
reset role;

\echo P2_R02_QA_POLICY_SMOKE=PASS
