-- Esquema mínimo y datos señuelo para el contrato A-01
-- (tests/pm11/db/a01-baja-revoca-acceso-contract.mjs).
--
-- Reproduce el estado ANTERIOR a la migración
-- 20261108100000_a01_baja_empleado_revoca_acceso.sql: la guarda tal y como
-- está hoy en producción, y un empleado ya dado de baja que conserva su
-- membresía activa. El contrato carga después la migración y comprueba el
-- cambio de comportamiento.
--
-- No crea ni destruye la base: la prepara el arnés.

create schema if not exists private;
create schema if not exists auth;

-- Roles que Supabase trae de serie.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role; end if;
end $$;

create table public.empleados(
  id text primary key,
  empresa_id text not null,
  local_id text not null,
  estado text not null,
  nombre text,
  datos jsonb not null default '{}'::jsonb,
  baja_at timestamptz,
  reactivado_at timestamptz
);

create table public.perfiles(
  user_id uuid primary key,
  activo boolean not null default true,
  empleado_id text,
  rol text
);

create table public.membresias_usuario(
  id bigint generated always as identity primary key,
  user_id uuid not null,
  empresa_id text not null,
  local_id text,
  todos_locales boolean not null default false,
  rol text,
  activo boolean not null default true,
  updated_at timestamptz not null default now()
);

create table public.auditoria_registro(
  id bigint generated always as identity primary key,
  accion text,
  empleado_id text,
  empresa_id text,
  local_id text,
  datos jsonb
);

-- Sustitutos de las piezas que la migración invoca y que no entran en este
-- contrato: la identidad y la autorización de la acción se dan por buenas,
-- porque lo que se audita aquí es la revocación del acceso, no el permiso
-- para darla de baja.
create or replace function auth.uid() returns uuid
language sql stable as $$ select nullif(current_setting('a01.uid', true), '')::uuid $$;

create or replace function private.pm13_p05_accion_autorizada(text, text, text, text, text)
returns boolean language sql stable as $$ select true $$;

create or replace function private.pm11_auditar_empleado(p_accion text, p_empleado text, p_empresa text, p_local text, p_datos jsonb)
returns void language sql as $$
  insert into public.auditoria_registro(accion, empleado_id, empresa_id, local_id, datos)
  values (p_accion, p_empleado, p_empresa, p_local, p_datos);
$$;

-- La guarda tal cual está desplegada hoy en producción: no mira al empleado.
create or replace function private.la_usuario_activo() returns boolean
language sql stable security definer set search_path to ''
as $$
  select (select auth.uid()) is not null
     and exists(select 1 from public.membresias_usuario m where m.user_id = (select auth.uid()) and m.activo = true)
     and not exists(select 1 from public.perfiles p where p.user_id = (select auth.uid()) and p.activo = false);
$$;

-- Datos señuelo.
--  EMP-1: camarero en activo de EMP-A/A1, que además es socio de EMP-C.
--  EMP-2: empleado de otra empresa; no debe verse afectado por nada.
--  EMP-3: baja anterior a la migración que conserva el acceso.
insert into public.empleados(id, empresa_id, local_id, estado, nombre) values
  ('EMP-1', 'EMP-A', 'A1', 'activo',   'Camarero de prueba'),
  ('EMP-2', 'EMP-B', 'B1', 'activo',   'Empleado de otra empresa'),
  ('EMP-3', 'EMP-A', 'A1', 'inactivo', 'Baja antigua con acceso vivo');

insert into public.perfiles(user_id, activo, empleado_id, rol) values
  ('11111111-1111-4111-8111-111111111111', true, 'EMP-1', 'Camarero/a'),
  ('22222222-2222-4222-8222-222222222222', true, 'EMP-2', 'Camarero/a'),
  ('33333333-3333-4333-8333-333333333333', true, 'EMP-3', 'Camarero/a');

insert into public.membresias_usuario(user_id, empresa_id, local_id, todos_locales, rol, activo) values
  ('11111111-1111-4111-8111-111111111111', 'EMP-A', 'A1',  false, 'Camarero/a',  true),
  ('11111111-1111-4111-8111-111111111111', 'EMP-C', null,  true,  'Propietario', true),
  ('22222222-2222-4222-8222-222222222222', 'EMP-B', 'B1',  false, 'Camarero/a',  true),
  ('33333333-3333-4333-8333-333333333333', 'EMP-A', 'A1',  false, 'Camarero/a',  true);
