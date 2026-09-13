-- PM26 P08g -- catalogo backend de empresas y locales, con autoridad
-- real. PROPUESTA. NO APLICADA EN NINGUN ENTORNO. Vive fuera de
-- supabase/migrations.
--
-- Resuelve la precondicion documentada en P08e (informe, seccion 3.2,
-- paso 1): sin un catalogo backend contra el que validar empresa_id y
-- local_id, ninguna membresia de membresias_usuario es comprobable, y
-- crearla equivaldria a confiar en el estado del navegador -- exactamente
-- el Defecto L.
--
-- Diseno deliberadamente minimo:
--   - RLS activada en las dos tablas.
--   - CERO politicas y CERO GRANT de escritura a authenticated/anon:
--     la unica via de escritura es SQL administrativo (Supabase SQL
--     editor conectado como propietario de la base, o service_role),
--     nunca el cliente. Sin esto, un Propietario podria escribir su
--     propia fila de empresa o local y fabricar la autorizacion --
--     justo lo que este catalogo existe para impedir.
--   - CERO SELECT concedido a authenticated: nada en el cliente
--     necesita leer estas tablas hoy, y no hay motivo para exponer el
--     catalogo completo de empresas a cualquier usuario autenticado.
--
-- No depende de la migracion del Defecto L ni la modifica: se puede
-- aplicar de forma independiente, antes, sin tocar prefiltros_candidatos.

begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

create table if not exists public.empresas (
  id text primary key,
  nombre text not null,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.locales (
  id text primary key,
  empresa_id text not null references public.empresas(id),
  nombre text not null,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.empresas enable row level security;
alter table public.locales enable row level security;

-- Sin GRANT de escritura ni de lectura a authenticated/anon. Una tabla
-- nueva no concede nada a esos roles por defecto, pero se revoca de
-- forma explicita para que quede documentado y sea a prueba de
-- defaults futuros de Postgres/Supabase.
revoke all on public.empresas from authenticated, anon, public;
revoke all on public.locales from authenticated, anon, public;

commit;
