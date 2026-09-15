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
values (true, repeat('b', 64));

insert into auth.users(id, email) values
  ('685cfc8f-f674-4681-9a81-61d3a26c0287', 'owner@example.test'),
  ('11111111-1111-4111-8111-111111111111', 'other@example.test');

insert into public.perfiles(user_id, rol, nombre, activo) values
  ('685cfc8f-f674-4681-9a81-61d3a26c0287', 'Propietario', 'Owner test', true);

\ir ../supabase/migrations/20260914223200_owner_installation_bootstrap.sql
\ir ../supabase/migrations/20260915043000_ui_context_bridge.sql

select set_config('app.current_uid', '685cfc8f-f674-4681-9a81-61d3a26c0287', false);

select public.bootstrap_owner_instalacion('Empresa inicial', 'Local inicial');

do $$
declare
  r jsonb;
  e jsonb;
  l jsonb;
begin
  r := public.obtener_contexto_instalacion_ui();
  if r->>'state' <> 'ready' or r->>'generation' <> repeat('b', 64) then
    raise exception 'TEST_FAIL: contexto inicial no ready %', r;
  end if;
  if jsonb_array_length(r->'empresas') <> 1 or jsonb_array_length(r->'locales') <> 1 then
    raise exception 'TEST_FAIL: cardinalidad inicial incorrecta %', r;
  end if;
  e := r->'empresas'->0;
  l := r->'locales'->0;
  if e->>'razonSocial' <> 'Empresa inicial' or e->>'marca' <> 'Empresa inicial' then
    raise exception 'TEST_FAIL: empresa bootstrap no adaptada a UI %', e;
  end if;
  if l->>'nombre' <> 'Local inicial' or l->>'empresaId' <> e->>'id' then
    raise exception 'TEST_FAIL: local bootstrap no adaptado a UI %', l;
  end if;
end;
$$;

-- Actualizar metadatos y crear una segunda empresa desde el contrato legacy.
do $$
declare
  r jsonb;
  empresa1 text;
begin
  empresa1 := public.obtener_contexto_instalacion_ui()->'empresas'->0->>'id';
  r := public.guardar_contexto_instalacion_ui(
    'empresas',
    jsonb_build_array(
      jsonb_build_object(
        'id', empresa1,
        'razonSocial', 'Empresa inicial S.L.',
        'marca', 'Inicial',
        'nif', 'B12345678',
        'activo', true
      ),
      jsonb_build_object(
        'id', 'empresa-segunda',
        'razonSocial', 'Empresa segunda S.L.',
        'marca', 'Segunda',
        'activo', true
      )
    )
  );
  if jsonb_array_length(r->'empresas') <> 2 then
    raise exception 'TEST_FAIL: segunda empresa no creada %', r;
  end if;
  if (select count(*) from public.membresias_usuario where user_id = auth.uid() and rol='Propietario' and activo) <> 2 then
    raise exception 'TEST_FAIL: membresía Owner de segunda empresa ausente';
  end if;
  if (select datos->>'nif' from public.empresas where id = empresa1) <> 'B12345678' then
    raise exception 'TEST_FAIL: metadatos de empresa no persistieron';
  end if;
end;
$$;

-- Crear local para la segunda empresa y actualizar el local inicial.
do $$
declare
  r jsonb;
  local1 text;
  empresa1 text;
begin
  r := public.obtener_contexto_instalacion_ui();
  local1 := r->'locales'->0->>'id';
  empresa1 := r->'locales'->0->>'empresaId';

  r := public.guardar_contexto_instalacion_ui(
    'locales',
    jsonb_build_array(
      jsonb_build_object(
        'id', local1,
        'empresaId', empresa1,
        'nombre', 'Local inicial actualizado',
        'direccion', 'Calle Uno',
        'activo', true
      ),
      jsonb_build_object(
        'id', 'local-segundo',
        'empresaId', 'empresa-segunda',
        'nombre', 'Local segundo',
        'direccion', 'Calle Dos',
        'activo', true
      )
    )
  );

  if jsonb_array_length(r->'locales') <> 2 then
    raise exception 'TEST_FAIL: segundo local no creado %', r;
  end if;
  if (select nombre from public.locales where id = local1) <> 'Local inicial actualizado' then
    raise exception 'TEST_FAIL: nombre de local no persistió';
  end if;
  if (select datos->>'direccion' from public.locales where id = 'local-segundo') <> 'Calle Dos' then
    raise exception 'TEST_FAIL: metadatos de local no persistieron';
  end if;
end;
$$;

-- Selección local es validada, pero sigue siendo preferencia del dispositivo.
do $$
declare
  r jsonb;
begin
  r := public.guardar_contexto_instalacion_ui('localActivoId', to_jsonb('local-segundo'::text));
  if r->>'state' <> 'ready' then
    raise exception 'TEST_FAIL: validación localActivoId falló %', r;
  end if;
  begin
    perform public.guardar_contexto_instalacion_ui('localActivoId', to_jsonb('local-ajeno'::text));
    raise exception 'TEST_FAIL: local ajeno debía rechazarse';
  exception when insufficient_privilege then null;
  end;
end;
$$;

-- Un local único no puede quedar desactivado silenciosamente.
do $$
declare
  r jsonb;
  empresa1 text;
  local1 text;
begin
  r := public.obtener_contexto_instalacion_ui();
  empresa1 := r->'empresas'->0->>'id';
  select id into local1 from public.locales where empresa_id = empresa1 limit 1;
  begin
    perform public.guardar_contexto_instalacion_ui(
      'locales',
      jsonb_build_array(jsonb_build_object(
        'id', local1, 'empresaId', empresa1, 'nombre', 'Último', 'activo', false
      ))
    );
    raise exception 'TEST_FAIL: último local activo debía rechazarse';
  exception when invalid_parameter_value then null;
  end;
end;
$$;

-- Segunda identidad sin perfil/membresía no puede leer ni escribir el contexto.
select set_config('app.current_uid', '11111111-1111-4111-8111-111111111111', false);

do $$
begin
  begin
    perform public.obtener_contexto_instalacion_ui();
    raise exception 'TEST_FAIL: identidad no autorizada leyó contexto';
  exception when others then
    if sqlerrm like 'TEST_FAIL:%' then raise; end if;
  end;

  begin
    perform public.guardar_contexto_instalacion_ui('empresas', '[]'::jsonb);
    raise exception 'TEST_FAIL: identidad no autorizada escribió contexto';
  exception when insufficient_privilege then null;
  end;
end;
$$;

select 'ui-context-bridge: OK' as resultado;
