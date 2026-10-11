-- Fixture de esquema y datos para probar public.obtener_contexto_operativo()
-- contra Postgres real.
--
-- ALCANCE DELIBERADO: esto NO es un volcado del esquema completo de
-- producción. Es el subconjunto mínimo de tablas y columnas de las que esta
-- función depende (perfiles, empresas, locales, membresias_usuario,
-- almacen_kv), extraído literalmente por introspección
-- (information_schema.columns / pg_proc.prosrc) durante la auditoría R10 del
-- Proyecto A. Se documenta así para que nadie lo confunda con evidencia de
-- que el resto del esquema también se ha verificado aquí.
--
-- auth.uid() se sustituye por un stub que lee una GUC de sesión
-- (request.jwt.claim.sub), fijada por cada escenario de prueba vía
-- set_config(). No usa pgjwt ni PostgREST real.

create schema if not exists auth;
create schema if not exists private;

create or replace function auth.uid() returns uuid
language sql stable
as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

create table public.perfiles (
  user_id uuid primary key,
  rol text not null,
  empleado_id text,
  activo boolean not null default true
);

create table public.empresas (
  id text primary key,
  nombre text not null,
  activo boolean not null default true
);

create table public.locales (
  id text primary key,
  empresa_id text not null references public.empresas(id),
  nombre text not null,
  activo boolean not null default true
);

create table public.membresias_usuario (
  id bigint primary key,
  user_id uuid not null,
  empresa_id text not null references public.empresas(id),
  local_id text references public.locales(id),
  todos_locales boolean not null default false,
  rol text not null,
  activo boolean not null default true
);

create table public.almacen_kv (
  empresa_id text not null references public.empresas(id),
  local_id text not null references public.locales(id),
  key text not null,
  value jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (empresa_id, local_id, key)
);

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon;
  end if;
end $$;

-- ----------------------------------------------------------------------
-- Datos con señuelos inequívocos por empresa/local, para poder detectar
-- contaminación cruzada leyendo el propio contenido de la respuesta, no
-- solo contando filas.
-- ----------------------------------------------------------------------

insert into public.empresas (id, nombre, activo) values
  ('emp-A', 'Empresa A', true),
  ('emp-B', 'Empresa B', true),
  ('emp-C-baja', 'Empresa C (dada de baja)', false);

insert into public.locales (id, empresa_id, nombre, activo) values
  ('loc-A', 'emp-A', 'Local A', true),
  ('loc-A2', 'emp-A', 'Local A2', true),
  ('loc-B', 'emp-B', 'Local B', true),
  ('loc-C-baja', 'emp-C-baja', 'Local C (baja)', false);

insert into public.almacen_kv (empresa_id, local_id, key, value) values
  ('emp-A', 'loc-A', 'empleados', '[
     {"id":"ea-1","nombre":"SEÑUELO-A-Cajera-Ana","puesto":"Caja","rol":"Cajero/a","activo":true},
     {"id":"ea-2","nombre":"SEÑUELO-A-Churrero-Bruno","puesto":"Obrador","rol":"Churrero/a","activo":true},
     {"id":"ea-3","nombre":"SEÑUELO-A-Encargado-Clara","puesto":"Encargada","rol":"Encargado","activo":true},
     {"id":"ea-4","nombre":"SEÑUELO-A-Bajado-Diego","puesto":"Caja","rol":"Cajero/a","activo":false}
   ]'::jsonb),
  ('emp-B', 'loc-B', 'empleados', '[
     {"id":"eb-1","nombre":"SEÑUELO-B-Cajera-Elena","puesto":"Caja","rol":"Cajero/a","activo":true},
     {"id":"eb-2","nombre":"SEÑUELO-B-Encargado-Fran","puesto":"Encargado","rol":"Encargado","activo":true}
   ]'::jsonb);

insert into public.almacen_kv (empresa_id, local_id, key, value) values
  ('emp-A', 'loc-A', 'proveedores', '[{"id":"pa-1","nombre":"SEÑUELO-PROVEEDOR-A"}]'::jsonb),
  ('emp-A', 'loc-A2', 'proveedores', '[{"id":"pa2-1","nombre":"SEÑUELO-PROVEEDOR-A2"}]'::jsonb),
  ('emp-B', 'loc-B', 'proveedores', '[{"id":"pb-1","nombre":"SEÑUELO-PROVEEDOR-B"}]'::jsonb);

insert into public.almacen_kv (empresa_id, local_id, key, value) values
  ('emp-A', 'loc-A', 'fichasCosto', '[{"id":"fa-1","nombre":"SEÑUELO-RECETA-A","rendimiento":10,"componentes":[]}]'::jsonb),
  ('emp-B', 'loc-B', 'fichasCosto', '[{"id":"fb-1","nombre":"SEÑUELO-RECETA-B","rendimiento":10,"componentes":[]}]'::jsonb);

insert into public.almacen_kv (empresa_id, local_id, key, value) values
  ('emp-A', 'loc-A', 'encargos', '[{"id":"enc-a-1","cobros":[{"fecha":"2026-01-01","medioPago":"Efectivo","importe":111.11}]}]'::jsonb),
  ('emp-B', 'loc-B', 'encargos', '[{"id":"enc-b-1","cobros":[{"fecha":"2026-01-01","medioPago":"Efectivo","importe":222.22}]}]'::jsonb),
  ('emp-C-baja', 'loc-C-baja', 'empleados', '[{"id":"ec-1","nombre":"SEÑUELO-C-Cajero-Zeta","puesto":"Caja","rol":"Cajero/a","activo":true}]'::jsonb);

-- Perfiles / usuarios de prueba. UUIDs restringidos a dígitos hexadecimales
-- válidos (0-9, a-f): "m", "x", "z" no son hex y rompen el cast a uuid.
insert into public.perfiles (user_id, rol, empleado_id, activo) values
  ('00000000-0000-0000-0000-0000000a0a01', 'Cajero/a',  'ea-1', true),      -- Cajera de A
  ('00000000-0000-0000-0000-0000000a0a02', 'Churrero/a','ea-2', true),      -- Churrero de A
  ('00000000-0000-0000-0000-0000000a0a03', 'Encargado', 'ea-3', true),      -- Encargada de A (sin membresía, resuelve por KV)
  ('00000000-0000-0000-0000-0000000b0b01', 'Cajero/a',  'eb-1', true),      -- Cajera de B
  ('00000000-0000-0000-0000-0000000b0b02', 'Encargado', 'eb-2', true),      -- Encargado de B
  ('00000000-0000-0000-0000-00000000eeee', 'Cajero/a',  null,   true),      -- Multi-local: dos membresías, sin empleado_id
  ('00000000-0000-0000-0000-000000000dea', 'Cajero/a',  'no-existe', true), -- empleado_id no resoluble en ningún local
  ('00000000-0000-0000-0000-0000000000ba', 'Cajero/a',  null,   true),      -- sin empleado_id y sin membresía: contexto no determinable
  ('00000000-0000-0000-0000-0000000000ca', 'Camarero/a','ea-4', true),      -- rol no gestionado por esta RPC (no debe exigir contexto)
  ('00000000-0000-0000-0000-0000000000aa', 'Cajero/a',  'ea-4', false),     -- perfil inactivo
  ('00000000-0000-0000-0000-0000000000cb', 'Cajero/a',  'ec-1', true);      -- referencia a local dado de baja

insert into public.membresias_usuario (id, user_id, empresa_id, local_id, todos_locales, rol, activo) values
  (1, '00000000-0000-0000-0000-00000000eeee', 'emp-A', 'loc-A',  false, 'Cajero/a', true),
  (2, '00000000-0000-0000-0000-00000000eeee', 'emp-A', 'loc-A2', false, 'Cajero/a', true);
