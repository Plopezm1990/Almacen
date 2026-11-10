-- Fixture mínimo y desechable para M-01. Se carga antes de la migración.
create schema if not exists private;
create schema if not exists auth;
create schema if not exists extensions;

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role; end if;
end $$;

create extension if not exists pgcrypto with schema extensions;

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

create table public.almacen_kv(
  key text primary key,
  value jsonb not null default '{}'::jsonb
);

create or replace function auth.uid() returns uuid
language sql stable as $$ select nullif(current_setting('m01.uid', true), '')::uuid $$;

create or replace function private.pm11_puede_mutar_personal(text, text)
returns boolean language sql stable as $$ select true $$;

create or replace function private.pm11_puede_ver_personal(text, text)
returns boolean language sql stable as $$ select true $$;

create or replace function private.pm11_validar_datos_laborales(jsonb)
returns void language plpgsql as $$ begin return; end $$;

create or replace function private.pm11_auditar_empleado(text, text, text, text, jsonb)
returns void language plpgsql as $$ begin return; end $$;

insert into public.empleados(id, empresa_id, local_id, estado, nombre, datos)
values ('EMP-LEGACY', 'EMP-A', 'LOCAL-A', 'activo', 'Legacy',
        jsonb_build_object('id', 'EMP-LEGACY', 'pin', 'sha256-legacy'));

insert into public.almacen_kv(key, value)
values ('empleados', jsonb_build_array(jsonb_build_object('id', 'EMP-LEGACY', 'pin', 'sha256-legacy')));
