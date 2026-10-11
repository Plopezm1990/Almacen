\set ON_ERROR_STOP on

create role anon nologin;
create role authenticated nologin;
grant usage on schema public to anon,authenticated;

create table public.empleados(
  id text primary key,
  empresa_id text not null,
  local_id text not null,
  estado text not null,
  nombre text,
  datos jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  baja_at timestamptz,
  reactivado_at timestamptz,
  anonimizado_at timestamptz
);
alter table public.empleados enable row level security;
grant select on public.empleados to authenticated;
create policy pm11_empleados_select_gestion on public.empleados for select to authenticated using(true);

create table public.fichajes_registro(
  id text primary key,
  fecha date not null,
  datos jsonb not null default '{}'::jsonb,
  creado_en timestamptz not null default now()
);
alter table public.fichajes_registro enable row level security;
grant select on public.fichajes_registro to authenticated;
create policy pm13_fichajes_select_scope on public.fichajes_registro for select to authenticated using(true);

create or replace function public.pm11_alta_empleado(text,text,text,text,jsonb)
returns jsonb language sql as $$ select '{}'::jsonb $$;
create or replace function public.pm11_editar_empleado(text,text,text,jsonb,text)
returns jsonb language sql as $$ select '{}'::jsonb $$;
create or replace function public.pm11_baja_empleado(text,text,text,text)
returns jsonb language sql as $$ select '{}'::jsonb $$;
create or replace function public.pm11_reactivar_empleado(text,text,text)
returns jsonb language sql as $$ select '{}'::jsonb $$;
create or replace function public.pm13_fichar(text,text,text,text)
returns jsonb language sql as $$ select '{}'::jsonb $$;
create or replace function public.pm13_fichaje_manual(text,text,date,text,text,text,text)
returns jsonb language sql as $$ select '{}'::jsonb $$;
create or replace function public.pm13_corregir_fichaje(text,date,text,text,text,text)
returns jsonb language sql as $$ select '{}'::jsonb $$;
create or replace function public.pm13_anular_fichaje(text,text,text)
returns jsonb language sql as $$ select '{}'::jsonb $$;

revoke all on function public.pm11_alta_empleado(text,text,text,text,jsonb) from public,anon,authenticated;
revoke all on function public.pm11_editar_empleado(text,text,text,jsonb,text) from public,anon,authenticated;
revoke all on function public.pm11_baja_empleado(text,text,text,text) from public,anon,authenticated;
revoke all on function public.pm11_reactivar_empleado(text,text,text) from public,anon,authenticated;
revoke all on function public.pm13_fichar(text,text,text,text) from public,anon,authenticated;
revoke all on function public.pm13_fichaje_manual(text,text,date,text,text,text,text) from public,anon,authenticated;
revoke all on function public.pm13_corregir_fichaje(text,date,text,text,text,text) from public,anon,authenticated;
revoke all on function public.pm13_anular_fichaje(text,text,text) from public,anon,authenticated;

grant execute on function public.pm11_alta_empleado(text,text,text,text,jsonb) to authenticated;
grant execute on function public.pm11_editar_empleado(text,text,text,jsonb,text) to authenticated;
grant execute on function public.pm11_baja_empleado(text,text,text,text) to authenticated;
grant execute on function public.pm11_reactivar_empleado(text,text,text) to authenticated;
grant execute on function public.pm13_fichar(text,text,text,text) to authenticated;
grant execute on function public.pm13_fichaje_manual(text,text,date,text,text,text,text) to authenticated;
grant execute on function public.pm13_corregir_fichaje(text,date,text,text,text,text) to authenticated;
grant execute on function public.pm13_anular_fichaje(text,text,text) to authenticated;

\ir ../../../supabase/migrations/20260922170000_p2_p06_server_authority_capabilities_release_current.sql

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

\ir ../../../supabase/migrations/20260922170000_p2_p06_server_authority_capabilities_release_current.sql

select 'P2_P06_EPHEMERAL_OK=1' as result;
