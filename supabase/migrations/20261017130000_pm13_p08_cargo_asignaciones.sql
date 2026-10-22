-- PM13-P08 — asignación segura de cargos a empleados por local.
-- Solo prepara el contrato servidor para QA; no se aplica automáticamente.

begin;
set local lock_timeout = '10s';
set local statement_timeout = '30s';

do $preflight$
declare
  v_missing text[] := array[]::text[];
begin
  if to_regclass('public.empresas') is null then v_missing := array_append(v_missing, 'empresas'); end if;
  if to_regclass('public.locales') is null then v_missing := array_append(v_missing, 'locales'); end if;
  if to_regclass('public.empleados') is null then v_missing := array_append(v_missing, 'empleados'); end if;
  if to_regclass('public.abc_cargos') is null then v_missing := array_append(v_missing, 'abc_cargos'); end if;
  if to_regprocedure('auth.uid()') is null then v_missing := array_append(v_missing, 'auth.uid'); end if;
  if to_regprocedure('private.pm13_cargo_validar_contexto(text,text)') is null then v_missing := array_append(v_missing, 'pm13_cargo_validar_contexto'); end if;
  if cardinality(v_missing) > 0 then
    raise exception 'PM13_P08_ASIGNACIONES_PREFLIGHT_FALLO:%', array_to_string(v_missing, ',');
  end if;
end $preflight$;

create table if not exists public.abc_cargo_asignaciones (
  id uuid primary key default gen_random_uuid(),
  empresa_id text not null references public.empresas(id) on delete restrict,
  local_id text not null,
  empleado_id text not null references public.empleados(id) on delete restrict,
  cargo_id uuid not null references public.abc_cargos(id) on delete restrict,
  activo boolean not null default true,
  asignado_desde timestamptz not null default now(),
  asignado_hasta timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint abc_cargo_asig_local_fk foreign key (empresa_id, local_id)
    references public.locales(empresa_id, id) on delete restrict,
  constraint abc_cargo_asig_estado_coherente check ((activo = true and asignado_hasta is null) or (activo = false and asignado_hasta is not null)),
  constraint abc_cargo_asig_desde_hasta check (asignado_hasta is null or asignado_hasta >= asignado_desde)
);

create unique index if not exists abc_cargo_asig_activa_uq
  on public.abc_cargo_asignaciones(empresa_id, local_id, empleado_id)
  where activo = true;
create index if not exists abc_cargo_asig_cargo_idx
  on public.abc_cargo_asignaciones(empresa_id, local_id, cargo_id, activo);

alter table public.abc_cargo_asignaciones enable row level security;
revoke all on table public.abc_cargo_asignaciones from public, anon, authenticated, service_role;

create or replace function public.abc_listar_cargos(p_empresa_id text, p_local_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.pm13_cargo_validar_contexto(p_empresa_id, p_local_id);
  return jsonb_build_object(
    'ok', true,
    'empresa_id', p_empresa_id,
    'local_id', p_local_id,
    'cargos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id,
        'empresa_id', c.empresa_id,
        'nombre', c.nombre,
        'descripcion', c.descripcion,
        'activo', c.activo,
        'copiado_de', c.copiado_de,
        'asignados_count', (select count(*) from public.abc_cargo_asignaciones a where a.cargo_id = c.id and a.empresa_id = p_empresa_id and a.local_id = p_local_id and a.activo = true),
        'personas_asignadas', coalesce((
          select jsonb_agg(jsonb_build_object('id', a.empleado_id, 'nombre', e.nombre) order by e.nombre, e.id)
            from public.abc_cargo_asignaciones a
            join public.empleados e on e.id = a.empleado_id
           where a.cargo_id = c.id and a.empresa_id = p_empresa_id and a.local_id = p_local_id and a.activo = true
        ), '[]'::jsonb),
        'created_at', c.created_at,
        'updated_at', c.updated_at
      ) order by c.activo desc, c.nombre_normalizado)
      from public.abc_cargos c
      where c.empresa_id = p_empresa_id
    ), '[]'::jsonb)
  );
end
$$;

create or replace function public.abc_asignar_cargo(
  p_operation_id text,
  p_empresa_id text,
  p_local_id text,
  p_empleado_id text,
  p_cargo_id uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_empleado public.empleados%rowtype;
  v_cargo public.abc_cargos%rowtype;
  v_asignacion public.abc_cargo_asignaciones%rowtype;
begin
  perform private.pm13_cargo_validar_contexto(p_empresa_id, p_local_id);
  select * into v_empleado
    from public.empleados e
   where e.id = p_empleado_id
     and e.empresa_id = p_empresa_id
     and e.local_id = p_local_id
     and e.estado = 'activo'
   for share;
  if not found then raise exception 'cargo_empleado_no_disponible'; end if;
  select * into v_cargo
    from public.abc_cargos c
   where c.id = p_cargo_id
     and c.empresa_id = p_empresa_id
     and c.activo = true
   for share;
  if not found then raise exception 'cargo_no_disponible'; end if;

  if exists (
    select 1 from public.abc_cargo_asignaciones a
     where a.empresa_id = p_empresa_id and a.local_id = p_local_id
       and a.empleado_id = p_empleado_id and a.cargo_id = p_cargo_id and a.activo = true
  ) then
    select * into v_asignacion
      from public.abc_cargo_asignaciones a
     where a.empresa_id = p_empresa_id and a.local_id = p_local_id
       and a.empleado_id = p_empleado_id and a.cargo_id = p_cargo_id and a.activo = true
     order by a.created_at desc limit 1;
    return jsonb_build_object('ok', true, 'ya_asignado', true, 'asignacion', to_jsonb(v_asignacion));
  end if;

  update public.abc_cargo_asignaciones
     set activo = false, asignado_hasta = now(), updated_by = auth.uid(), updated_at = now()
   where empresa_id = p_empresa_id and local_id = p_local_id and empleado_id = p_empleado_id and activo = true;

  insert into public.abc_cargo_asignaciones(empresa_id, local_id, empleado_id, cargo_id, created_by, updated_by)
  values (p_empresa_id, p_local_id, p_empleado_id, p_cargo_id, auth.uid(), auth.uid())
  returning * into v_asignacion;
  perform private.pm13_cargo_auditar('CARGO_ASIGNADO', p_empresa_id, p_local_id, jsonb_build_object('asignacionId', v_asignacion.id, 'empleadoId', p_empleado_id, 'cargoId', p_cargo_id, 'operationId', p_operation_id));
  return jsonb_build_object('ok', true, 'asignacion', to_jsonb(v_asignacion));
exception
  when unique_violation then raise exception 'cargo_asignacion_ya_existe';
end
$$;

create or replace function public.abc_desasignar_cargo(
  p_operation_id text,
  p_empresa_id text,
  p_local_id text,
  p_empleado_id text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  perform private.pm13_cargo_validar_contexto(p_empresa_id, p_local_id);
  update public.abc_cargo_asignaciones
     set activo = false, asignado_hasta = now(), updated_by = auth.uid(), updated_at = now()
   where empresa_id = p_empresa_id and local_id = p_local_id and empleado_id = p_empleado_id and activo = true;
  get diagnostics v_count = row_count;
  perform private.pm13_cargo_auditar('CARGO_DESASIGNADO', p_empresa_id, p_local_id, jsonb_build_object('empleadoId', p_empleado_id, 'operacionId', p_operation_id, 'cambios', v_count));
  return jsonb_build_object('ok', true, 'cambios', v_count);
end
$$;

revoke all on function public.abc_listar_cargos(text, text) from public, anon, authenticated, service_role;
revoke all on function public.abc_asignar_cargo(text, text, text, text, uuid) from public, anon, authenticated, service_role;
revoke all on function public.abc_desasignar_cargo(text, text, text, text) from public, anon, authenticated, service_role;
grant execute on function public.abc_listar_cargos(text, text) to authenticated;
grant execute on function public.abc_asignar_cargo(text, text, text, text, uuid) to authenticated;
grant execute on function public.abc_desasignar_cargo(text, text, text, text) to authenticated;

comment on table public.abc_cargo_asignaciones is 'Asignación histórica de un cargo por empleado y local. Una sola asignación activa por empleado/local.';

commit;
