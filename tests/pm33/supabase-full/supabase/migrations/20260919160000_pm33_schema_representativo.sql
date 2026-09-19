-- PM33 P05 -- entorno aislado: subconjunto de esquema representativo del
-- modelo VIGENTE de PROD para las tablas de las que depende
-- public.obtener_contexto_operativo(). Extraído literalmente por
-- introspección (information_schema.columns) durante la auditoría R10,
-- igual que tests/pm33/db/fixtures.sql -- no es un volcado completo del
-- esquema de PROD, y no debe leerse como evidencia de que el resto del
-- esquema se ha verificado aquí. A diferencia de fixtures.sql, este
-- entorno usa Auth (GoTrue) y PostgREST reales -- auth.uid() no se
-- stubea, la extensión pgjwt/GoTrue real la resuelve desde el JWT.
--
-- Modelo de permisos: las tablas base NO se exponen directamente a
-- PostgREST (RLS activado, sin políticas, y se revoca además el acceso
-- directo a anon/authenticated) -- el único punto de acceso autorizado es
-- la función SECURITY DEFINER, igual que en PROD hoy (revoke all on
-- function ... from public, anon; grant execute ... to authenticated,
-- ver el propio candidato P05).

create table public.perfiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  rol text not null,
  empleado_id text,
  activo boolean not null default true
);
alter table public.perfiles enable row level security;
revoke all on public.perfiles from anon, authenticated;

create table public.empresas (
  id text primary key,
  nombre text not null,
  activo boolean not null default true
);
alter table public.empresas enable row level security;
revoke all on public.empresas from anon, authenticated;

create table public.locales (
  id text primary key,
  empresa_id text not null references public.empresas(id),
  nombre text not null,
  activo boolean not null default true
);
alter table public.locales enable row level security;
revoke all on public.locales from anon, authenticated;

create table public.membresias_usuario (
  id bigint primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  empresa_id text not null references public.empresas(id),
  local_id text references public.locales(id),
  todos_locales boolean not null default false,
  rol text not null,
  activo boolean not null default true
);
alter table public.membresias_usuario enable row level security;
revoke all on public.membresias_usuario from anon, authenticated;

create table public.almacen_kv (
  empresa_id text not null references public.empresas(id),
  local_id text not null references public.locales(id),
  key text not null,
  value jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (empresa_id, local_id, key)
);
alter table public.almacen_kv enable row level security;
revoke all on public.almacen_kv from anon, authenticated;
