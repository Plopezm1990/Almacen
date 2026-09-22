\set ON_ERROR_STOP on

create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
grant usage on schema public to anon,authenticated,service_role;

create table public.prefiltro_limites(
  clave text primary key check (clave ~ '^[0-9a-f]{64}$'),
  ventana_inicio timestamptz not null,
  intentos integer not null check (intentos >= 1),
  actualizado_en timestamptz not null
);
alter table public.prefiltro_limites enable row level security;

grant select,insert,update,delete on public.prefiltro_limites to service_role;
revoke all on public.prefiltro_limites from public,anon,authenticated;

\ir ../../../supabase/migrations/20260922080500_p2_sec_prefiltro_rate_limit_rpc.sql

create or replace function public.p2_sec_assert(p_ok boolean,p_msg text)
returns void language plpgsql as $$
begin
  if not coalesce(p_ok,false) then raise exception 'ASSERT:%',p_msg; end if;
end $$;

select public.p2_sec_assert(
  to_regprocedure('public.registrar_intento_prefiltro(text)') is not null,
  'rate limit rpc missing'
);
select public.p2_sec_assert(
  not (select prosecdef from pg_proc where oid=to_regprocedure('public.registrar_intento_prefiltro(text)')),
  'rate limit rpc must be security invoker'
);
select public.p2_sec_assert(
  coalesce((select array_to_string(proconfig,',') from pg_proc where oid=to_regprocedure('public.registrar_intento_prefiltro(text)')),'') like '%search_path=""%',
  'rate limit rpc search_path not empty'
);
select public.p2_sec_assert(
  has_function_privilege('service_role','public.registrar_intento_prefiltro(text)','EXECUTE'),
  'service_role execute missing'
);
select public.p2_sec_assert(
  not has_function_privilege('authenticated','public.registrar_intento_prefiltro(text)','EXECUTE'),
  'authenticated execute open'
);
select public.p2_sec_assert(
  not has_function_privilege('anon','public.registrar_intento_prefiltro(text)','EXECUTE'),
  'anon execute open'
);
select public.p2_sec_assert(
  not has_function_privilege('public','public.registrar_intento_prefiltro(text)','EXECUTE'),
  'public execute open'
);

set role service_role;
select public.p2_sec_assert(
  public.registrar_intento_prefiltro(repeat('a',64))=1,
  'first rate-limit increment must be 1'
);
select public.p2_sec_assert(
  public.registrar_intento_prefiltro(repeat('a',64))=2,
  'second rate-limit increment must be 2'
);
reset role;

do $$
begin
  begin
    perform public.registrar_intento_prefiltro('clave-invalida');
    raise exception 'invalid key was accepted';
  exception
    when others then
      if sqlerrm='invalid key was accepted' then raise; end if;
      if sqlerrm not like '%Clave de rate limit no válida%' then raise; end if;
  end;
end $$;

\ir ../../../supabase/migrations/20260922080500_p2_sec_prefiltro_rate_limit_rpc.sql

select 'P2_EDGE_SECURITY_RATE_LIMIT_EPHEMERAL_OK=1' as result;
