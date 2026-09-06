-- PM11 · Personal / Empleados · P04
-- Entidad SQL autoritativa de identidad/ciclo de vida y RLS de lectura de gestión.
-- Aplicar únicamente en QA hasta autorización expresa. Producción/main no se toca.

create table if not exists public.empleados (
  id text primary key,
  empresa_id text not null,
  local_id text not null,
  estado text not null default 'activo',
  nombre text,
  datos jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  baja_at timestamptz,
  reactivado_at timestamptz,
  anonimizado_at timestamptz,

  constraint pm11_empleado_id_no_vacio
    check (nullif(btrim(id), '') is not null),
  constraint pm11_empleado_empresa_no_vacia
    check (nullif(btrim(empresa_id), '') is not null),
  constraint pm11_empleado_local_concreto
    check (
      nullif(btrim(local_id), '') is not null
      and upper(btrim(local_id)) not in ('TODOS', 'TODOS LOS LOCALES')
    ),
  constraint pm11_empleado_estado_valido
    check (estado in ('activo', 'inactivo', 'anonimizado')),
  constraint pm11_empleado_nombre_segun_estado
    check (
      (estado = 'anonimizado' and nombre is null)
      or
      (estado in ('activo', 'inactivo') and nullif(btrim(nombre), '') is not null)
    ),
  constraint pm11_empleado_baja_coherente
    check (estado <> 'inactivo' or baja_at is not null),
  constraint pm11_empleado_anonimizacion_coherente
    check (
      (estado = 'anonimizado' and baja_at is not null and anonimizado_at is not null)
      or
      (estado <> 'anonimizado' and anonimizado_at is null)
    ),
  constraint pm11_empleado_reactivacion_coherente
    check (reactivado_at is null or baja_at is not null)
);

comment on table public.empleados is
  'PM11: autoridad SQL de identidad, empresa/local y ciclo de vida del empleado. La ficha laboral ampliada puede convivir temporalmente en datos/almacen_kv durante la migración progresiva.';

create index if not exists pm11_empleados_scope_estado
  on public.empleados (empresa_id, local_id, estado, id);

-- Guard estructural: la identidad y el contexto no se pueden reescribir mediante UPDATE.
-- Un traslado interlocal futuro tendrá que introducir una operación explícita y adaptar
-- este guard de forma controlada; no se habilita un cambio silencioso de local en P04.
create or replace function private.pm11_empleados_guard()
returns trigger
language plpgsql
set search_path = 'public', 'private', 'pg_temp'
as $$
begin
  if tg_op = 'UPDATE' then
    if new.id is distinct from old.id then
      raise exception 'empleado_id_inmutable';
    end if;
    if new.empresa_id is distinct from old.empresa_id then
      raise exception 'empleado_empresa_inmutable';
    end if;
    if new.local_id is distinct from old.local_id then
      raise exception 'empleado_local_cambio_requiere_traslado';
    end if;
    if new.created_at is distinct from old.created_at then
      raise exception 'empleado_created_at_inmutable';
    end if;

    if old.estado = 'activo' and new.estado not in ('activo', 'inactivo') then
      raise exception 'empleado_transicion_estado_invalida';
    elsif old.estado = 'inactivo' and new.estado not in ('inactivo', 'activo', 'anonimizado') then
      raise exception 'empleado_transicion_estado_invalida';
    elsif old.estado = 'anonimizado' and new.estado <> 'anonimizado' then
      raise exception 'empleado_anonimizado_terminal';
    end if;

    new.updated_at := now();
  end if;
  return new;
end;
$$;

revoke all on function private.pm11_empleados_guard() from public, anon, authenticated;

drop trigger if exists pm11_empleados_guard on public.empleados;
create trigger pm11_empleados_guard
before update on public.empleados
for each row execute function private.pm11_empleados_guard();

-- La autorización de Personal se apoya en la membresía (ámbito + rol), no en
-- perfiles.rol. Esto evita que una alteración del perfil propio pueda ampliar
-- el alcance de RLS de empleados.
create or replace function private.pm11_puede_ver_personal(
  p_empresa_id text,
  p_local_id text
) returns boolean
language sql
stable security definer
set search_path = 'public', 'auth', 'private', 'pg_temp'
as $$
  select private.la_usuario_activo()
     and nullif(btrim(p_empresa_id), '') is not null
     and nullif(btrim(p_local_id), '') is not null
     and upper(btrim(p_local_id)) not in ('TODOS', 'TODOS LOS LOCALES')
     and exists (
       select 1
         from public.membresias_usuario m
        where m.user_id = auth.uid()
          and m.empresa_id = p_empresa_id
          and m.activo = true
          and (
            (m.rol = 'Propietario' and (m.todos_locales = true or m.local_id = p_local_id))
            or
            (m.rol = 'Encargado' and m.todos_locales = false and m.local_id = p_local_id)
          )
     );
$$;

revoke all on function private.pm11_puede_ver_personal(text, text) from public, anon;
grant execute on function private.pm11_puede_ver_personal(text, text) to authenticated;

alter table public.empleados enable row level security;

drop policy if exists pm11_empleados_select_gestion on public.empleados;
create policy pm11_empleados_select_gestion
on public.empleados
for select
to authenticated
using (private.pm11_puede_ver_personal(empresa_id, local_id));

-- P04 no abre mutaciones directas. Alta/edición/baja/reactivación/anonimización
-- llegarán por operaciones transaccionales en puntos posteriores.
revoke all on public.empleados from anon, authenticated;
grant select on public.empleados to authenticated;
