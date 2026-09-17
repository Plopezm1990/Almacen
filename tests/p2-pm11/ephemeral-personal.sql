\set ON_ERROR_STOP on

create role anon nologin;
create role authenticated nologin;
create schema auth;
create schema private;

grant usage on schema public,auth,private to anon,authenticated;

create or replace function auth.uid() returns uuid
language sql stable
as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
grant execute on function auth.uid() to public;

create table public.empresas(id text primary key,nombre text not null default '',activo boolean not null default true);
create table public.locales(id text primary key,empresa_id text not null,nombre text not null default '',activo boolean not null default true);
create table public.membresias_usuario(
  id bigserial primary key,user_id uuid not null,empresa_id text not null,local_id text,
  todos_locales boolean not null default false,rol text not null,activo boolean not null default true,
  created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table public.perfiles(
  user_id uuid primary key,rol text not null,empleado_id text,created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),nombre text,activo boolean not null default true
);
create table public.auditoria_registro(
  id text primary key,fecha date not null,datos jsonb not null default '{}'::jsonb,creado_en timestamptz not null default now(),
  empresa_id text,local_id text,actor_user_id uuid
);

create or replace function private.la_usuario_activo() returns boolean
language sql stable security definer set search_path=''
as $$ select (select auth.uid()) is not null
 and exists(select 1 from public.membresias_usuario m where m.user_id=(select auth.uid()) and m.activo=true)
 and not exists(select 1 from public.perfiles p where p.user_id=(select auth.uid()) and p.activo=false); $$;
revoke all on function private.la_usuario_activo() from public,anon,authenticated;

-- Utilidades exclusivas del harness.
create or replace function public.p2_pm11_assert(p_ok boolean,p_msg text) returns void
language plpgsql as $$ begin if not coalesce(p_ok,false) then raise exception 'ASSERT:%',p_msg; end if; end $$;
create or replace function public.p2_pm11_expect_error(p_sql text,p_fragment text) returns void
language plpgsql as $$ begin
  begin execute p_sql; exception when others then
    if position(p_fragment in SQLERRM)>0 or (p_fragment='permission denied' and SQLSTATE='42501') then return; end if;
    raise exception 'EXPECTED_ERROR:% GOT:%',p_fragment,SQLERRM;
  end;
  raise exception 'EXPECTED_ERROR_NOT_RAISED:%',p_fragment;
end $$;
grant execute on function public.p2_pm11_assert(boolean,text) to anon,authenticated;
grant execute on function public.p2_pm11_expect_error(text,text) to anon,authenticated;

insert into public.empresas(id,nombre) values('e1','E1'),('e2','E2');
insert into public.locales(id,empresa_id,nombre,activo) values
 ('l1','e1','L1',true),('l2','e1','L2',false),('l3','e1','L3',true),('b1','e2','B1',true);

insert into public.perfiles(user_id,rol,nombre,activo) values
 ('11111111-1111-1111-1111-111111111111','Propietario','Owner A',true),
 ('22222222-2222-2222-2222-222222222222','Encargado','Manager A',true),
 ('33333333-3333-3333-3333-333333333333','Cajero/a','Cashier A',true),
 ('44444444-4444-4444-4444-444444444444','Propietario','Owner B',true),
 ('55555555-5555-5555-5555-555555555555','Propietario','Inactive',false);
insert into public.membresias_usuario(user_id,empresa_id,local_id,todos_locales,rol,activo) values
 ('11111111-1111-1111-1111-111111111111','e1',null,true,'Propietario',true),
 ('22222222-2222-2222-2222-222222222222','e1','l1',false,'Encargado',true),
 ('33333333-3333-3333-3333-333333333333','e1','l1',false,'Cajero/a',true),
 ('44444444-4444-4444-4444-444444444444','e2',null,true,'Propietario',true),
 ('55555555-5555-5555-5555-555555555555','e1',null,true,'Propietario',true);

\ir ../../supabase/migrations/20260917143000_p2_pm11_personal_post_reset.sql

select public.p2_pm11_assert(to_regclass('public.empleados') is not null,'empleados missing');
select public.p2_pm11_assert((select count(*)=1 from pg_policies where schemaname='public' and tablename='empleados'),'employees policy count');
select public.p2_pm11_assert(not has_table_privilege('anon','public.empleados','SELECT'),'anon employees select');
select public.p2_pm11_assert(has_table_privilege('authenticated','public.empleados','SELECT'),'auth employees select');
select public.p2_pm11_assert(not has_table_privilege('authenticated','public.empleados','INSERT'),'direct insert open');
select public.p2_pm11_assert(has_function_privilege('authenticated','public.pm11_alta_empleado(text,text,text,text,jsonb)','EXECUTE'),'alta execute missing');
select public.p2_pm11_assert(not has_function_privilege('anon','public.pm11_alta_empleado(text,text,text,text,jsonb)','EXECUTE'),'anon alta execute');

-- Owner A: alcance multilocal, local inactivo visible pero no mutable, tenant B denegado.
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false);
set role authenticated;
select public.p2_pm11_assert(private.pm11_puede_ver_personal('e1','l1'),'owner cannot view l1');
select public.p2_pm11_assert(private.pm11_puede_ver_personal('e1','l2'),'owner cannot view inactive l2');
select public.p2_pm11_assert(private.pm11_puede_mutar_personal('e1','l1'),'owner cannot mutate l1');
select public.p2_pm11_assert(not private.pm11_puede_mutar_personal('e1','l2'),'inactive local mutable');
select public.p2_pm11_assert(not private.pm11_puede_ver_personal('e2','b1'),'cross company visible');

select public.pm11_alta_empleado('e1','l1','emp-a','Empleado A','{"pm13AltaOperationId":"op-a","horasSemanales":40}'::jsonb);
select public.p2_pm11_assert((select count(*)=1 from public.empleados where id='emp-a'),'owner alta failed');
select public.p2_pm11_assert((public.pm11_alta_empleado('e1','l1','emp-a','Empleado A','{"pm13AltaOperationId":"op-a","horasSemanales":40}'::jsonb)->>'yaCreado')::boolean,'alta replay not idempotent');
select public.p2_pm11_expect_error($q$select public.pm11_alta_empleado('e2','b1','bad','Bad','{}'::jsonb)$q$,'personal_contexto_no_autorizado');
select public.p2_pm11_expect_error($q$insert into public.empleados(id,empresa_id,local_id,estado,nombre) values('direct','e1','l1','activo','Direct')$q$,'permission denied');
select public.p2_pm11_expect_error($q$select public.pm11_alta_empleado('e1','l2','closed','Closed','{}'::jsonb)$q$,'personal_contexto_no_autorizado');
reset role;

-- Manager A puede gestionar su local concreto, no otros.
select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',false);
set role authenticated;
select public.p2_pm11_assert(private.pm11_puede_mutar_personal('e1','l1'),'manager cannot mutate own local');
select public.p2_pm11_assert(not private.pm11_puede_mutar_personal('e1','l3'),'manager can mutate other local');
select public.pm11_editar_empleado('e1','l1','emp-a','{"puesto":"barra"}'::jsonb,'Empleado A2');
select public.p2_pm11_expect_error($q$select public.pm11_alta_empleado('e1','l3','bad2','Bad2','{}'::jsonb)$q$,'personal_contexto_no_autorizado');
reset role;

-- Cajero: ni lectura de personal ni mutación.
select set_config('request.jwt.claim.sub','33333333-3333-3333-3333-333333333333',false);
set role authenticated;
select public.p2_pm11_assert((select count(*)=0 from public.empleados),'cashier sees personnel');
select public.p2_pm11_expect_error($q$select public.pm11_alta_empleado('e1','l1','bad3','Bad3','{}'::jsonb)$q$,'personal_contexto_no_autorizado');
reset role;

-- Owner B crea su empleado; luego Owner A no debe verlo.
select set_config('request.jwt.claim.sub','44444444-4444-4444-4444-444444444444',false);
set role authenticated;
select public.pm11_alta_empleado('e2','b1','emp-b','Empleado B','{}'::jsonb);
select public.p2_pm11_assert((select count(*)=1 from public.empleados),'owner B tenant count');
reset role;

select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false);
set role authenticated;
select public.p2_pm11_assert((select count(*)=1 from public.empleados),'owner A cross-tenant leak');
select public.pm11_baja_empleado('e1','l1','emp-a','test');
select public.p2_pm11_assert((select estado='inactivo' from public.empleados where id='emp-a'),'baja failed');
select public.pm11_reactivar_empleado('e1','l1','emp-a');
select public.p2_pm11_assert((select estado='activo' from public.empleados where id='emp-a'),'reactivate failed');
reset role;

-- Usuario marcado inactivo: helper y RPC fallan cerrado.
select set_config('request.jwt.claim.sub','55555555-5555-5555-5555-555555555555',false);
set role authenticated;
select public.p2_pm11_assert(not private.pm11_puede_ver_personal('e1','l1'),'inactive user can view');
select public.p2_pm11_expect_error($q$select public.pm11_alta_empleado('e1','l1','bad4','Bad4','{}'::jsonb)$q$,'personal_contexto_no_autorizado');
reset role;

-- Auditoría: alta A + edición + alta B + baja + reactivación = 5; replay no duplica.
select public.p2_pm11_assert((select count(*)=5 from public.auditoria_registro),'audit count/replay mismatch');
select public.p2_pm11_assert((select count(*)=4 from public.auditoria_registro where empresa_id='e1' and local_id='l1'),'audit tenant A mismatch');
select public.p2_pm11_assert((select count(*)=1 from public.auditoria_registro where empresa_id='e2' and local_id='b1'),'audit tenant B mismatch');

-- Anon no tiene lectura ni ejecución de RPC.
set role anon;
select public.p2_pm11_expect_error($q$select count(*) from public.empleados$q$,'permission denied');
select public.p2_pm11_expect_error($q$select public.pm11_alta_empleado('e1','l1','anon','Anon','{}'::jsonb)$q$,'permission denied');
reset role;

select 'P2_PM11_EPHEMERAL_OK=1' as result;