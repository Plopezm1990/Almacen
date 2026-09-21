-- P2-R03C · prueba funcional PostgreSQL 16 efímera
\set ON_ERROR_STOP on

create role anon nologin;
create role authenticated nologin;

create schema auth;
create schema private;
grant usage on schema auth, private to authenticated;

create function auth.uid() returns uuid
language sql stable
as $$
  select nullif(current_setting('app.current_uid',true),'')::uuid;
$$;
grant execute on function auth.uid() to authenticated;

create table public.locales(
  id text primary key,
  empresa_id text not null,
  activo boolean not null default true
);

create table public.membresias_usuario(
  user_id uuid not null,
  empresa_id text not null,
  local_id text,
  todos_locales boolean not null default false,
  rol text not null,
  activo boolean not null default true
);

-- Estado legacy mínimo observado: seis columnas, sin contrato tenant/contexto.
create table public.errores_sistema(
  id text primary key,
  fecha timestamptz not null default now(),
  mensaje text not null,
  pantalla text,
  pila text,
  dispositivo text
);

create function private.la_usuario_activo() returns boolean
language sql stable security definer
set search_path=''
as $$
  select (select auth.uid()) is not null
     and exists(
       select 1
         from public.membresias_usuario m
        where m.user_id=(select auth.uid())
          and m.activo=true
     );
$$;

-- Simula deriva post-reset: política arbitraria y privilegios excesivos.
alter table public.errores_sistema enable row level security;
create policy "post reset broad all"
  on public.errores_sistema
  for all
  to authenticated
  using (true)
  with check (true);
create policy "errores - propietario lee"
  on public.errores_sistema
  for select
  to authenticated
  using (true);
grant all privileges on table public.errores_sistema to authenticated;

insert into public.locales(id,empresa_id) values
('l1','e1'),('l2','e2'),('l3','e1');

insert into public.membresias_usuario(user_id,empresa_id,local_id,todos_locales,rol,activo) values
('11111111-1111-1111-1111-111111111111','e1',null,true,'Propietario',true),
('22222222-2222-2222-2222-222222222222','e2',null,true,'Propietario',true),
('33333333-3333-3333-3333-333333333333','e1','l1',false,'Camarero',true),
('44444444-4444-4444-4444-444444444444','e1','l3',false,'Encargado',false);

\ir ../../supabase/migrations/20260917111500_p2_r03c_errores_sistema_post_reset.sql

create function private.p2_r03c_assert(p_condition boolean,p_name text)
returns text
language plpgsql
as $$
begin
  if coalesce(p_condition,false) is not true then
    raise exception 'P2_R03C_ASSERT_FAIL:%',p_name;
  end if;
  return p_name||'=1';
end;
$$;

-- Catálogo, políticas y ACL.
select private.p2_r03c_assert(
  exists(select 1 from information_schema.columns where table_schema='public' and table_name='errores_sistema' and column_name='empresa_id' and data_type='text')
  and exists(select 1 from information_schema.columns where table_schema='public' and table_name='errores_sistema' and column_name='local_id' and data_type='text')
  and exists(select 1 from information_schema.columns where table_schema='public' and table_name='errores_sistema' and column_name='url' and data_type='text')
  and exists(select 1 from information_schema.columns where table_schema='public' and table_name='errores_sistema' and column_name='vista' and data_type='text')
  and exists(select 1 from information_schema.columns where table_schema='public' and table_name='errores_sistema' and column_name='detalle' and data_type='text')
  and exists(select 1 from information_schema.columns where table_schema='public' and table_name='errores_sistema' and column_name='contexto' and data_type='jsonb'),
  'CONTRACT_COLUMNS_OK'
);

select private.p2_r03c_assert(
  (select relrowsecurity from pg_class where oid='public.errores_sistema'::regclass)
  and (select count(*) from pg_policies where schemaname='public' and tablename='errores_sistema')=2
  and exists(select 1 from pg_policies where schemaname='public' and tablename='errores_sistema' and policyname='errores_sistema_p2_r03c_select' and cmd='SELECT')
  and exists(select 1 from pg_policies where schemaname='public' and tablename='errores_sistema' and policyname='errores_sistema_p2_r03c_insert' and cmd='INSERT')
  and not exists(select 1 from pg_policies where schemaname='public' and tablename='errores_sistema' and policyname in ('post reset broad all','errores - propietario lee')),
  'RLS_POLICIES_OK'
);

select private.p2_r03c_assert(
  has_table_privilege('authenticated','public.errores_sistema','SELECT')
  and has_table_privilege('authenticated','public.errores_sistema','INSERT')
  and not has_table_privilege('authenticated','public.errores_sistema','UPDATE')
  and not has_table_privilege('authenticated','public.errores_sistema','DELETE')
  and not has_table_privilege('authenticated','public.errores_sistema','TRUNCATE')
  and not has_table_privilege('anon','public.errores_sistema','SELECT')
  and not has_table_privilege('anon','public.errores_sistema','INSERT'),
  'TABLE_ACL_OK'
);

select private.p2_r03c_assert(
  has_function_privilege('authenticated','private.p2_r03c_puede_insertar_error(text,text)','EXECUTE')
  and has_function_privilege('authenticated','private.p2_r03c_puede_leer_error(text,text)','EXECUTE')
  and not has_function_privilege('anon','private.p2_r03c_puede_insertar_error(text,text)','EXECUTE')
  and not has_function_privilege('anon','private.p2_r03c_puede_leer_error(text,text)','EXECUTE'),
  'HELPER_ACL_OK'
);

-- Propietario e1: inserción tenant/local válida y telemetría company-level válida.
set role authenticated;
set app.current_uid='11111111-1111-1111-1111-111111111111';

insert into public.errores_sistema(
  id,mensaje,pantalla,pila,dispositivo,empresa_id,local_id,url,vista,detalle,contexto
) values (
  'err-owner','fallo owner','TPV','stack','ua','e1','l1','/tpv','tpv','detalle',
  '{"origen":"ephemeral"}'::jsonb
);

insert into public.errores_sistema(
  id,mensaje,empresa_id,local_id,url,vista,detalle,contexto
) values (
  'err-company','fallo company','e1',null,'/inicio','inicio','sin local','{}'::jsonb
);

select private.p2_r03c_assert(
  (select count(*) from public.errores_sistema)=2
  and (select contexto->>'origen' from public.errores_sistema where id='err-owner')='ephemeral',
  'OWNER_WRITE_READ_OK'
);

-- Empresa cruzada: debe fallar por WITH CHECK.
do $$
begin
  begin
    insert into public.errores_sistema(id,mensaje,empresa_id,local_id)
    values ('err-cross','cross tenant','e2','l2');
    raise exception 'P2_R03C_EXPECTED_CROSS_TENANT_NOT_RAISED';
  exception
    when insufficient_privilege then null;
  end;
end;
$$;

-- local_id existente pero perteneciente a otra empresa: debe fallar incluso con todos_locales.
do $$
begin
  begin
    insert into public.errores_sistema(id,mensaje,empresa_id,local_id)
    values ('err-mismatch','local mismatch','e1','l2');
    raise exception 'P2_R03C_EXPECTED_LOCAL_MISMATCH_NOT_RAISED';
  exception
    when insufficient_privilege then null;
  end;
end;
$$;

-- empresa_id nulo ya no es una vía de escape post-reset.
do $$
begin
  begin
    insert into public.errores_sistema(id,mensaje,empresa_id,local_id)
    values ('err-null-company','sin empresa',null,null);
    raise exception 'P2_R03C_EXPECTED_NULL_EMPRESA_NOT_RAISED';
  exception
    when insufficient_privilege then null;
  end;
end;
$$;

-- Usuario operativo: puede registrar dentro de su local, pero no leer el historial.
set app.current_uid='33333333-3333-3333-3333-333333333333';
insert into public.errores_sistema(id,mensaje,empresa_id,local_id,vista,contexto)
values ('err-staff','fallo staff','e1','l1','tpv','{}'::jsonb);

select private.p2_r03c_assert(
  (select count(*) from public.errores_sistema)=0,
  'STAFF_CANNOT_READ_OK'
);

do $$
begin
  begin
    insert into public.errores_sistema(id,mensaje,empresa_id,local_id)
    values ('err-staff-other-local','otro local','e1','l3');
    raise exception 'P2_R03C_EXPECTED_STAFF_OTHER_LOCAL_NOT_RAISED';
  exception
    when insufficient_privilege then null;
  end;
end;
$$;

-- Filas de otro tenant y legacy sin tenant se conservan pero quedan fail-closed.
reset role;
insert into public.errores_sistema(id,mensaje,empresa_id,local_id)
values ('err-e2','fallo e2','e2','l2');
insert into public.errores_sistema(id,mensaje,empresa_id,local_id)
values ('err-legacy-null','legacy',null,null);

set role authenticated;
set app.current_uid='11111111-1111-1111-1111-111111111111';
select private.p2_r03c_assert(
  (select count(*) from public.errores_sistema)=3
  and (select count(*) from public.errores_sistema where empresa_id='e2')=0
  and (select count(*) from public.errores_sistema where empresa_id is null)=0,
  'OWNER_TENANT_VISIBILITY_OK'
);

set app.current_uid='22222222-2222-2222-2222-222222222222';
select private.p2_r03c_assert(
  (select count(*) from public.errores_sistema)=1
  and (select count(*) from public.errores_sistema where id='err-e2')=1,
  'SECOND_OWNER_ISOLATION_OK'
);

-- Membresía inactiva: ni leer ni insertar.
set app.current_uid='44444444-4444-4444-4444-444444444444';
select private.p2_r03c_assert(
  (select count(*) from public.errores_sistema)=0,
  'INACTIVE_CANNOT_READ_OK'
);

do $$
begin
  begin
    insert into public.errores_sistema(id,mensaje,empresa_id,local_id)
    values ('err-inactive','inactive','e1','l3');
    raise exception 'P2_R03C_EXPECTED_INACTIVE_INSERT_NOT_RAISED';
  exception
    when insufficient_privilege then null;
  end;
end;
$$;

reset role;
select 'P2_R03C_EPHEMERAL_OK=1' as result;
