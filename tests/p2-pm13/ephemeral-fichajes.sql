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
create table public.fichajes_registro(
  id text primary key,
  fecha date not null,
  datos jsonb not null default '{}'::jsonb,
  creado_en timestamptz not null default now()
);

create or replace function private.la_usuario_activo() returns boolean
language sql stable security definer set search_path=''
as $$ select (select auth.uid()) is not null
 and exists(select 1 from public.membresias_usuario m where m.user_id=(select auth.uid()) and m.activo=true)
 and not exists(select 1 from public.perfiles p where p.user_id=(select auth.uid()) and p.activo=false); $$;
revoke all on function private.la_usuario_activo() from public,anon,authenticated;

create or replace function public.p2_pm13_assert(p_ok boolean,p_msg text) returns void
language plpgsql as $$ begin if not coalesce(p_ok,false) then raise exception 'ASSERT:%',p_msg; end if; end $$;
create or replace function public.p2_pm13_expect_error(p_sql text,p_fragment text) returns void
language plpgsql as $$ begin
  begin execute p_sql; exception when others then
    if position(p_fragment in SQLERRM)>0 or (p_fragment='permission denied' and SQLSTATE='42501') then return; end if;
    raise exception 'EXPECTED_ERROR:% GOT:%',p_fragment,SQLERRM;
  end;
  raise exception 'EXPECTED_ERROR_NOT_RAISED:%',p_fragment;
end $$;
grant execute on function public.p2_pm13_assert(boolean,text) to anon,authenticated;
grant execute on function public.p2_pm13_expect_error(text,text) to anon,authenticated;

insert into public.empresas(id,nombre) values('e1','E1'),('e2','E2');
insert into public.locales(id,empresa_id,nombre,activo) values
 ('l1','e1','L1',true),('l2','e1','L2',false),('b1','e2','B1',true);
insert into public.perfiles(user_id,rol,nombre,activo) values
 ('11111111-1111-1111-1111-111111111111','Propietario','Owner A',true),
 ('22222222-2222-2222-2222-222222222222','Encargado','Manager A',true),
 ('33333333-3333-3333-3333-333333333333','Cajero/a','Cashier A',true),
 ('44444444-4444-4444-4444-444444444444','Propietario','Owner B',true);
insert into public.membresias_usuario(user_id,empresa_id,local_id,todos_locales,rol,activo) values
 ('11111111-1111-1111-1111-111111111111','e1',null,true,'Propietario',true),
 ('22222222-2222-2222-2222-222222222222','e1','l1',false,'Encargado',true),
 ('33333333-3333-3333-3333-333333333333','e1','l1',false,'Cajero/a',true),
 ('44444444-4444-4444-4444-444444444444','e2',null,true,'Propietario',true);

-- Simula el estado post-reset real: ACL y políticas históricas demasiado amplias.
alter table public.fichajes_registro enable row level security;
grant select,insert,update,delete on public.fichajes_registro to authenticated;
create policy "fichajes - leer" on public.fichajes_registro for select to authenticated using(true);
create policy "fichajes - insertar" on public.fichajes_registro for insert to authenticated with check(true);
create policy "fichajes - corregir" on public.fichajes_registro for update to authenticated using(true) with check(true);
create policy "fichajes - borrar" on public.fichajes_registro for delete to authenticated using(true);

\ir ../../supabase/migrations/20260917143000_p2_pm11_personal_post_reset.sql

select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false);
set role authenticated;
select public.pm11_alta_empleado('e1','l1','emp-a','Empleado A','{}'::jsonb);
select public.pm11_alta_empleado('e1','l1','emp-conc','Empleado Concurrente','{}'::jsonb);
reset role;

select set_config('request.jwt.claim.sub','44444444-4444-4444-4444-444444444444',false);
set role authenticated;
select public.pm11_alta_empleado('e2','b1','emp-b','Empleado B','{}'::jsonb);
reset role;

-- Fixture privilegiada para comprobar cierre por local inactivo.
insert into public.empleados(id,empresa_id,local_id,estado,nombre,datos)
values('emp-inactive','e1','l2','activo','Empleado Local Inactivo','{"id":"emp-inactive","empresaId":"e1","localId":"l2","nombre":"Empleado Local Inactivo","activo":true,"estado":"activo"}'::jsonb);

update public.perfiles set empleado_id='emp-a' where user_id='33333333-3333-3333-3333-333333333333';

\ir ../../supabase/migrations/20260917173000_p2_pm13_fichajes_post_reset.sql
\ir ../../supabase/migrations/20260917182000_p2_pm13_fichajes_self_rls_fix.sql

-- DDL/ACL/RLS final.
select public.p2_pm13_assert((select count(*)=1 from pg_policies where schemaname='public' and tablename='fichajes_registro'),'legacy policies remain');
select public.p2_pm13_assert((select policyname='pm13_fichajes_select_scope' and cmd='SELECT' from pg_policies where schemaname='public' and tablename='fichajes_registro'),'scoped select policy missing');
select public.p2_pm13_assert(has_table_privilege('authenticated','public.fichajes_registro','SELECT'),'authenticated select missing');
select public.p2_pm13_assert(not has_table_privilege('authenticated','public.fichajes_registro','INSERT'),'direct insert still open');
select public.p2_pm13_assert(not has_table_privilege('authenticated','public.fichajes_registro','UPDATE'),'direct update still open');
select public.p2_pm13_assert(not has_table_privilege('authenticated','public.fichajes_registro','DELETE'),'direct delete still open');
select public.p2_pm13_assert(not has_table_privilege('anon','public.fichajes_registro','SELECT'),'anon select open');
select public.p2_pm13_assert(has_function_privilege('authenticated','public.pm13_fichar(text,text,text,text)','EXECUTE'),'fichar execute missing');
select public.p2_pm13_assert(not has_function_privilege('anon','public.pm13_fichar(text,text,text,text)','EXECUTE'),'anon fichar execute');
select public.p2_pm13_assert(has_function_privilege('authenticated','private.pm13_fichaje_actor_es_empleado(text)','EXECUTE'),'RLS self helper execute missing');
select public.p2_pm13_assert((select count(*)=1 from pg_indexes where schemaname='public' and tablename='fichajes_registro' and indexname='pm13_fichajes_operation_id_uq'),'global op index missing');

-- Owner A: histórico manual, secuencia, operationId global, corrección y replay estricto.
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false);
set role authenticated;
select public.p2_pm13_assert((public.pm13_fichaje_manual('emp-a','l1',current_date-1,'09:00','entrada','manual-in','turno')->>'ok')::boolean,'manual entry failed');
select public.p2_pm13_assert((public.pm13_fichaje_manual('emp-a','l1',current_date-1,'17:00','salida','manual-out','turno')->>'ok')::boolean,'manual exit failed');
select public.p2_pm13_assert((public.pm13_fichaje_manual('emp-a','l1',current_date-1,'17:00','salida','manual-out','turno')->>'replay')::boolean,'manual replay failed');
select public.p2_pm13_expect_error($q$select public.pm13_fichaje_manual('emp-conc','l1',current_date-2,'08:00','entrada','manual-in','otro')$q$,'fichaje_operation_id_conflicto');
select public.p2_pm13_expect_error($q$select public.pm13_fichaje_manual('emp-inactive','l2',current_date-1,'09:00','entrada','inactive-local','x')$q$,'fichaje_empleado_no_activo_o_fuera_de_local');
select public.p2_pm13_assert((public.pm13_corregir_fichaje((select id from public.fichajes_registro where datos->>'operationId'='manual-out'),current_date-1,'18:00','salida','corr-1','ajuste')->>'ok')::boolean,'correction failed');
select public.p2_pm13_assert((public.pm13_corregir_fichaje((select id from public.fichajes_registro where datos->>'operationId'='manual-out'),current_date-1,'18:00','salida','corr-1','ajuste')->>'replay')::boolean,'correction replay failed');
select public.p2_pm13_expect_error($q$select public.pm13_corregir_fichaje((select id from public.fichajes_registro where datos->>'operationId'='manual-out'),current_date-1,'19:00','salida','corr-1','ajuste')$q$,'fichaje_correccion_operation_id_conflicto');
select public.p2_pm13_assert((select jsonb_array_length(datos->'historialCorrecciones')=1 from public.fichajes_registro where datos->>'operationId'='manual-out'),'correction replay duplicated history');
reset role;

-- Autoservicio: Cajero vinculado a emp-a puede ficharse, pero no mutar fichajes manualmente.
select set_config('request.jwt.claim.sub','33333333-3333-3333-3333-333333333333',false);
set role authenticated;
select public.p2_pm13_assert((public.pm13_fichar('emp-a','l1','entrada','self-entry')->>'ok')::boolean,'self entry failed');
select public.p2_pm13_assert((public.pm13_fichar('emp-a','l1','entrada','self-entry')->>'replay')::boolean,'self replay failed');
select public.p2_pm13_assert((select count(*)=1 from public.fichajes_registro where datos->>'operationId'='self-entry'),'self replay duplicated');
select public.p2_pm13_assert((public.pm13_fichar('emp-a','l1','entrada','self-entry-2')->>'codigo')='FICHAJE_YA_ABIERTO','sequence duplicate entry accepted');
select public.p2_pm13_expect_error($q$select public.pm13_fichaje_manual('emp-a','l1',current_date-1,'08:00','entrada','cashier-manual','x')$q$,'fichaje_manual_no_autorizado');
select public.p2_pm13_expect_error($q$insert into public.fichajes_registro(id,fecha,datos) values('direct',current_date,'{}'::jsonb)$q$,'permission denied');
reset role;

-- Owner A puede anular el fichaje abierto sin romper la secuencia histórica; replay estricto.
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false);
set role authenticated;
select public.p2_pm13_assert((public.pm13_anular_fichaje((select id from public.fichajes_registro where datos->>'operationId'='self-entry'),'annul-1','error de fichaje')->>'ok')::boolean,'annul failed');
select public.p2_pm13_assert((public.pm13_anular_fichaje((select id from public.fichajes_registro where datos->>'operationId'='self-entry'),'annul-1','error de fichaje')->>'replay')::boolean,'annul replay failed');
select public.p2_pm13_expect_error($q$select public.pm13_anular_fichaje((select id from public.fichajes_registro where datos->>'operationId'='self-entry'),'annul-2','otro')$q$,'fichaje_ya_anulado');
reset role;

-- Aislamiento tenant/local de lectura.
select set_config('request.jwt.claim.sub','44444444-4444-4444-4444-444444444444',false);
set role authenticated;
select public.p2_pm13_assert((select count(*)=0 from public.fichajes_registro),'cross-tenant read leak');
reset role;

-- Incluso manipulando el vínculo de perfil, una membresía de e2 no puede auto-fichar a emp-a/e1.
update public.perfiles set empleado_id='emp-a' where user_id='44444444-4444-4444-4444-444444444444';
select set_config('request.jwt.claim.sub','44444444-4444-4444-4444-444444444444',false);
set role authenticated;
select public.p2_pm13_expect_error($q$select public.pm13_fichar('emp-a','l1','entrada','spoof-cross-tenant')$q$,'fichaje_actor_no_autorizado');
reset role;
update public.perfiles set empleado_id=null where user_id='44444444-4444-4444-4444-444444444444';

select 'P2_PM13_EPHEMERAL_OK=1' as result;
