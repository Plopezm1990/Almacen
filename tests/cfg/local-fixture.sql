-- Solo para la réplica local (PostgreSQL 16 con la cadena de migraciones ABC aplicada): el contrato
-- cfg1-contract.sql necesita estos cuatro usuarios en auth.users. En QA ya existen.
insert into auth.users(id) values
  ('16c79749-a206-47d9-8d56-fbc7a4a49eb7'),
  ('5003adca-2e30-477e-8afd-ffb3037b034e'),
  ('eb0bca7b-b366-4d72-80e1-0b02e9bdd666'),
  ('73967f0c-3474-443d-ad83-9f20b94204c3')
on conflict do nothing;

-- Esquema mínimo para las funciones reales de membresía de QA (private.la_usuario_activo usa perfiles y empleados).
create table if not exists public.perfiles(user_id uuid primary key, activo boolean not null default true, empleado_id uuid);
-- Columnas que existen en QA y que usa abc_listar_roles_retirados (pieza 5); opcionales para el resto de contratos.
alter table public.perfiles add column if not exists nombre text;
alter table public.perfiles add column if not exists rol text;
alter table public.perfiles add column if not exists updated_at timestamp with time zone not null default now();
create table if not exists public.empleados(id uuid primary key, empresa_id text, local_id text, estado text);
insert into public.perfiles(user_id, activo, empleado_id) values
  ('16c79749-a206-47d9-8d56-fbc7a4a49eb7', true, null),
  ('5003adca-2e30-477e-8afd-ffb3037b034e', true, null),
  ('eb0bca7b-b366-4d72-80e1-0b02e9bdd666', true, null),
  ('73967f0c-3474-443d-ad83-9f20b94204c3', true, null)
on conflict do nothing;

-- Funciones reales de QA (sustituyen a los marcadores de prueba del CI para este contrato).
create or replace function private.la_usuario_activo() returns boolean language sql stable security definer set search_path to 'public','auth','private','pg_temp' as $$
  select exists (
    select 1 from public.perfiles p
     where p.user_id = auth.uid() and p.activo = true
       and ((p.empleado_id is null and exists (select 1 from public.membresias_usuario m where m.user_id = p.user_id and m.activo = true))
         or (p.empleado_id is not null and exists (select 1 from public.empleados e join public.membresias_usuario m on m.user_id = p.user_id and m.activo = true and m.empresa_id = e.empresa_id and (m.todos_locales = true or (m.todos_locales = false and m.local_id = e.local_id)) where e.id = p.empleado_id and e.estado = 'activo')))
  );
$$;
create or replace function private.la_tiene_local(p_empresa text, p_local text) returns boolean language sql stable security definer set search_path to 'public','auth','private','pg_temp' as $$
  select private.la_usuario_activo() and nullif(btrim(p_local), '') is not null and upper(btrim(p_local)) <> 'TODOS'
     and exists (select 1 from public.membresias_usuario m where m.user_id = auth.uid() and m.empresa_id = p_empresa and m.activo = true and (m.todos_locales = true or m.local_id = p_local));
$$;
create or replace function private.la_tiene_empresa(p_empresa text) returns boolean language sql stable security definer set search_path to 'public','auth','private','pg_temp' as $$
  select private.la_usuario_activo() and exists (select 1 from public.membresias_usuario m where m.user_id = auth.uid() and m.empresa_id = p_empresa and m.activo = true);
$$;
