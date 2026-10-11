\set ON_ERROR_STOP on

create role anon nologin;
create role authenticated nologin;

create schema auth;
create schema private;

create table auth.users (
  id uuid primary key,
  email text,
  deleted_at timestamptz
);

create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('app.current_uid', true), '')::uuid
$$;

create table private.la_instalacion_estado (
  singleton boolean primary key default true check (singleton),
  generation text not null,
  created_at timestamptz not null default now()
);

create table public.perfiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  rol text not null default 'Básico',
  empleado_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  nombre text,
  activo boolean not null default true
);

create table public.empresas (
  id text primary key,
  nombre text not null,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.locales (
  id text primary key,
  empresa_id text not null references public.empresas(id),
  nombre text not null,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.membresias_usuario (
  id bigint primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  empresa_id text not null,
  local_id text,
  todos_locales boolean not null default false,
  rol text not null,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pm12_prod_membresia_empresa check (nullif(btrim(empresa_id), '') is not null),
  constraint pm12_prod_membresia_local check (
    (todos_locales = true and local_id is null)
    or (todos_locales = false and nullif(btrim(local_id), '') is not null)
  )
);

create unique index pm12_prod_membresia_scope
  on public.membresias_usuario (user_id, empresa_id, coalesce(local_id, '__TODOS__'));

insert into private.la_instalacion_estado(singleton, generation)
values (true, repeat('a', 64));

insert into auth.users(id, email)
values ('685cfc8f-f674-4681-9a81-61d3a26c0287', 'owner@example.test');

insert into public.perfiles(user_id, rol, nombre, activo)
values ('685cfc8f-f674-4681-9a81-61d3a26c0287', 'Propietario', 'Owner test', true);

\ir ../supabase/migrations/20260914223200_owner_installation_bootstrap.sql

select set_config('app.current_uid', '685cfc8f-f674-4681-9a81-61d3a26c0287', false);

do $$
declare
  r jsonb;
begin
  r := public.obtener_estado_instalacion();
  if r->>'state' <> 'needs_setup' then
    raise exception 'TEST_FAIL: estado inicial esperado needs_setup, recibido %', r;
  end if;
end;
$$;

do $$
declare
  r1 jsonb;
  r2 jsonb;
  c_emp bigint;
  c_loc bigint;
  c_mem bigint;
begin
  r1 := public.bootstrap_owner_instalacion('Empresa inicial', 'Local inicial');
  if r1->>'state' <> 'ready' or coalesce((r1->>'idempotent')::boolean, true) <> false then
    raise exception 'TEST_FAIL: primer bootstrap inválido %', r1;
  end if;

  r2 := public.bootstrap_owner_instalacion('Empresa inicial', 'Local inicial');
  if r2->>'state' <> 'ready' or coalesce((r2->>'idempotent')::boolean, false) <> true then
    raise exception 'TEST_FAIL: reintento no idempotente %', r2;
  end if;
  if r1->>'empresa_id' <> r2->>'empresa_id' or r1->>'local_id' <> r2->>'local_id' then
    raise exception 'TEST_FAIL: IDs cambiaron en reintento';
  end if;

  select count(*) into c_emp from public.empresas;
  select count(*) into c_loc from public.locales;
  select count(*) into c_mem from public.membresias_usuario;
  if c_emp <> 1 or c_loc <> 1 or c_mem <> 1 then
    raise exception 'TEST_FAIL: duplicados tras reintento emp=% loc=% mem=%', c_emp, c_loc, c_mem;
  end if;

  if public.obtener_estado_instalacion()->>'state' <> 'ready' then
    raise exception 'TEST_FAIL: estado final no es ready';
  end if;
end;
$$;

-- Atomicidad: un fallo forzado en la tercera escritura debe deshacer también
-- empresa y local, sin dejar un bootstrap parcial.
truncate table public.membresias_usuario, public.locales, public.empresas;

create or replace function public.test_fallar_membresia()
returns trigger
language plpgsql
as $$
begin
  raise exception 'TEST_MEMBERSHIP_FAILURE';
end;
$$;

create trigger test_fallar_membresia
before insert on public.membresias_usuario
for each row execute function public.test_fallar_membresia();

do $$
begin
  begin
    perform public.bootstrap_owner_instalacion('Empresa rollback', 'Local rollback');
    raise exception 'TEST_FAIL: el bootstrap debía fallar';
  exception
    when others then
      if position('TEST_MEMBERSHIP_FAILURE' in sqlerrm) = 0 then
        raise;
      end if;
  end;

  if exists (select 1 from public.empresas)
     or exists (select 1 from public.locales)
     or exists (select 1 from public.membresias_usuario) then
    raise exception 'TEST_FAIL: el fallo dejó datos parciales';
  end if;
end;
$$;

drop trigger test_fallar_membresia on public.membresias_usuario;
drop function public.test_fallar_membresia();

select 'bootstrap-owner-post-reset: OK' as resultado;
