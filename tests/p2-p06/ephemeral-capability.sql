\set ON_ERROR_STOP on

create role anon nologin;
create role authenticated nologin;

grant usage on schema public to anon,authenticated;

create table public.empleados(id text primary key);
create table public.fichajes_registro(id text primary key);

create or replace function public.pm11_alta_empleado(text,text,text,text,jsonb)
returns jsonb language sql as $$ select '{}'::jsonb $$;
create or replace function public.pm11_editar_empleado(text,text,jsonb)
returns jsonb language sql as $$ select '{}'::jsonb $$;
create or replace function public.pm13_fichar(text,text,text,text)
returns jsonb language sql as $$ select '{}'::jsonb $$;
create or replace function public.pm13_fichaje_manual(text,text,date,text,text,text,text)
returns jsonb language sql as $$ select '{}'::jsonb $$;

\ir ../../supabase/migrations/20260917194000_p2_p06_server_authority_capabilities.sql

create or replace function public.p2_p06_assert(p_ok boolean,p_msg text)
returns void language plpgsql as $$
begin
  if not coalesce(p_ok,false) then raise exception 'ASSERT:%',p_msg; end if;
end $$;

select public.p2_p06_assert(
  has_function_privilege('authenticated','public.p2_server_authority_capabilities()','EXECUTE'),
  'authenticated capability execute missing'
);
select public.p2_p06_assert(
  not has_function_privilege('anon','public.p2_server_authority_capabilities()','EXECUTE'),
  'anon capability execute open'
);
select public.p2_p06_assert(
  not has_function_privilege('public','public.p2_server_authority_capabilities()','EXECUTE'),
  'public capability execute open'
);

set role authenticated;
select public.p2_p06_assert((public.p2_server_authority_capabilities()->>'personal')='pm11','personal capability');
select public.p2_p06_assert((public.p2_server_authority_capabilities()->>'fichajes')='pm13','fichajes capability');
select public.p2_p06_assert((public.p2_server_authority_capabilities()->>'legacyPersistence')::boolean=false,'legacy flag');
reset role;

select 'P2_P06_EPHEMERAL_OK=1' as result;
