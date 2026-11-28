-- ABC F6 — ciclo de vida de cargos personalizados en QA.
-- Desactivar es reversible; eliminar conserva trazabilidad y revoca el acceso.

begin;
set local lock_timeout = '10s';
set local statement_timeout = '30s';

do $preflight$
declare
  v_missing text[] := array[]::text[];
begin
  if to_regclass('public.abc_cargos') is null then v_missing := array_append(v_missing, 'abc_cargos'); end if;
  if to_regclass('public.abc_cargo_asignaciones') is null then v_missing := array_append(v_missing, 'abc_cargo_asignaciones'); end if;
  if to_regclass('public.auditoria_registro') is null then v_missing := array_append(v_missing, 'auditoria_registro'); end if;
  if to_regprocedure('private.pm13_cargo_validar_contexto(text,text)') is null then v_missing := array_append(v_missing, 'pm13_cargo_validar_contexto'); end if;
  if to_regprocedure('private.pm13_cargo_auditar(text,text,text,jsonb)') is null then v_missing := array_append(v_missing, 'pm13_cargo_auditar'); end if;
  if cardinality(v_missing) > 0 then
    raise exception 'ABC_F6_CICLO_CARGOS_PREFLIGHT_FALLO:%', array_to_string(v_missing, ',');
  end if;
end $preflight$;

alter table public.abc_cargos
  add column if not exists eliminado boolean not null default false,
  add column if not exists eliminado_en timestamptz,
  add column if not exists eliminado_por uuid references auth.users(id) on delete set null;

drop index if exists public.abc_cargos_empresa_nombre_uq;
create unique index if not exists abc_cargos_empresa_nombre_activo_uq
  on public.abc_cargos(empresa_id, nombre_normalizado)
  where eliminado = false;

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
        'eliminado', c.eliminado,
        'eliminado_en', c.eliminado_en,
        'copiado_de', c.copiado_de,
        'asignados_count', (select count(*) from public.abc_cargo_asignaciones a where a.cargo_id = c.id and a.empresa_id = p_empresa_id and a.local_id = p_local_id and a.activo = true),
        'personas_asignadas', coalesce((
          select jsonb_agg(jsonb_build_object('id', a.empleado_id, 'nombre', e.nombre) order by e.nombre, e.id)
            from public.abc_cargo_asignaciones a
            join public.empleados e on e.id = a.empleado_id
           where a.cargo_id = c.id and a.empresa_id = p_empresa_id and a.local_id = p_local_id and a.activo = true
        ), '[]'::jsonb),
        'pantallas_consulta', coalesce((
          select jsonb_agg(cp.capacidad_consulta order by cp.capacidad_consulta)
            from public.abc_cargo_pantallas cp
           where cp.empresa_id = p_empresa_id and cp.cargo_id = c.id
        ), '[]'::jsonb),
        'created_at', c.created_at,
        'updated_at', c.updated_at
      ) order by c.eliminado asc, c.activo desc, c.nombre_normalizado)
      from public.abc_cargos c
      where c.empresa_id = p_empresa_id
    ), '[]'::jsonb)
  );
end
$$;

create or replace function public.abc_crear_cargo(
  p_operation_id text,
  p_empresa_id text,
  p_local_id text,
  p_nombre text,
  p_descripcion text default ''
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_nombre text := btrim(coalesce(p_nombre, ''));
  v_normalizado text := private.pm13_cargo_normalizar_nombre(p_nombre);
  v_descripcion text := btrim(coalesce(p_descripcion, ''));
  v_cargo public.abc_cargos%rowtype;
begin
  perform private.pm13_cargo_validar_contexto(p_empresa_id, p_local_id);
  if nullif(v_nombre, '') is null then raise exception 'cargo_nombre_requerido'; end if;
  if char_length(v_nombre) > 80 then raise exception 'cargo_nombre_demasiado_largo'; end if;
  if char_length(v_descripcion) > 500 then raise exception 'cargo_descripcion_demasiado_larga'; end if;
  if exists (select 1 from public.abc_cargos where empresa_id = p_empresa_id and nombre_normalizado = v_normalizado and eliminado = false) then
    raise exception 'cargo_nombre_ya_existe';
  end if;
  insert into public.abc_cargos(empresa_id, nombre, nombre_normalizado, descripcion, created_by, updated_by)
  values (p_empresa_id, v_nombre, v_normalizado, v_descripcion, auth.uid(), auth.uid())
  returning * into v_cargo;
  perform private.pm13_cargo_auditar('CARGO_CREADO', p_empresa_id, p_local_id, jsonb_build_object('cargoId', v_cargo.id, 'nombre', v_cargo.nombre, 'operationId', p_operation_id));
  return jsonb_build_object('ok', true, 'cargo', to_jsonb(v_cargo));
exception
  when unique_violation then raise exception 'cargo_nombre_ya_existe';
end
$$;

create or replace function public.abc_editar_cargo(
  p_operation_id text,
  p_empresa_id text,
  p_local_id text,
  p_cargo_id uuid,
  p_nombre text,
  p_descripcion text default ''
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_nombre text := btrim(coalesce(p_nombre, ''));
  v_normalizado text := private.pm13_cargo_normalizar_nombre(p_nombre);
  v_descripcion text := btrim(coalesce(p_descripcion, ''));
  v_cargo public.abc_cargos%rowtype;
begin
  perform private.pm13_cargo_validar_contexto(p_empresa_id, p_local_id);
  if p_cargo_id is null then raise exception 'cargo_id_requerido'; end if;
  if nullif(v_nombre, '') is null then raise exception 'cargo_nombre_requerido'; end if;
  if char_length(v_nombre) > 80 then raise exception 'cargo_nombre_demasiado_largo'; end if;
  if char_length(v_descripcion) > 500 then raise exception 'cargo_descripcion_demasiado_larga'; end if;
  select * into v_cargo from public.abc_cargos where id = p_cargo_id and empresa_id = p_empresa_id for update;
  if not found then raise exception 'cargo_no_encontrado'; end if;
  if v_cargo.eliminado then raise exception 'cargo_eliminado'; end if;
  if exists (select 1 from public.abc_cargos where empresa_id = p_empresa_id and nombre_normalizado = v_normalizado and eliminado = false and id <> p_cargo_id) then
    raise exception 'cargo_nombre_ya_existe';
  end if;
  update public.abc_cargos
     set nombre = v_nombre, nombre_normalizado = v_normalizado, descripcion = v_descripcion, updated_by = auth.uid(), updated_at = now()
   where id = p_cargo_id
  returning * into v_cargo;
  perform private.pm13_cargo_auditar('CARGO_EDITADO', p_empresa_id, p_local_id, jsonb_build_object('cargoId', v_cargo.id, 'nombre', v_cargo.nombre, 'operationId', p_operation_id));
  return jsonb_build_object('ok', true, 'cargo', to_jsonb(v_cargo));
exception
  when unique_violation then raise exception 'cargo_nombre_ya_existe';
end
$$;

create or replace function public.abc_duplicar_cargo(
  p_operation_id text,
  p_empresa_id text,
  p_local_id text,
  p_cargo_id uuid,
  p_nombre text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_origen public.abc_cargos%rowtype;
  v_cargo public.abc_cargos%rowtype;
  v_nombre text;
  v_normalizado text;
begin
  perform private.pm13_cargo_validar_contexto(p_empresa_id, p_local_id);
  select * into v_origen from public.abc_cargos where id = p_cargo_id and empresa_id = p_empresa_id for share;
  if not found then raise exception 'cargo_no_encontrado'; end if;
  if v_origen.eliminado then raise exception 'cargo_eliminado'; end if;
  v_nombre := btrim(coalesce(nullif(p_nombre, ''), v_origen.nombre || ' copia'));
  v_normalizado := private.pm13_cargo_normalizar_nombre(v_nombre);
  if char_length(v_nombre) > 80 then raise exception 'cargo_nombre_demasiado_largo'; end if;
  if exists (select 1 from public.abc_cargos where empresa_id = p_empresa_id and nombre_normalizado = v_normalizado and eliminado = false) then
    raise exception 'cargo_nombre_ya_existe';
  end if;
  insert into public.abc_cargos(empresa_id, nombre, nombre_normalizado, descripcion, copiado_de, created_by, updated_by)
  values (p_empresa_id, v_nombre, v_normalizado, v_origen.descripcion, v_origen.id, auth.uid(), auth.uid())
  returning * into v_cargo;
  perform private.pm13_cargo_auditar('CARGO_DUPLICADO', p_empresa_id, p_local_id, jsonb_build_object('cargoId', v_cargo.id, 'copiadoDe', v_origen.id, 'nombre', v_cargo.nombre, 'permisosClonados', false, 'operationId', p_operation_id));
  return jsonb_build_object('ok', true, 'cargo', to_jsonb(v_cargo), 'permisos_clonados', false);
exception
  when unique_violation then raise exception 'cargo_nombre_ya_existe';
end
$$;

create or replace function public.abc_desactivar_cargo(
  p_operation_id text,
  p_empresa_id text,
  p_local_id text,
  p_cargo_id uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_cargo public.abc_cargos%rowtype;
  v_asignados bigint;
begin
  perform private.pm13_cargo_validar_contexto(p_empresa_id, p_local_id);
  select * into v_cargo from public.abc_cargos where id = p_cargo_id and empresa_id = p_empresa_id for update;
  if not found then raise exception 'cargo_no_encontrado'; end if;
  if v_cargo.eliminado then raise exception 'cargo_eliminado'; end if;
  select count(distinct a.empleado_id) into v_asignados
    from public.abc_cargo_asignaciones a
   where a.empresa_id = p_empresa_id and a.cargo_id = p_cargo_id and a.activo = true;
  if not v_cargo.activo then return jsonb_build_object('ok', true, 'ya_inactivo', true, 'personas_afectadas', v_asignados, 'cargo', to_jsonb(v_cargo)); end if;
  update public.abc_cargos
     set activo = false, updated_by = auth.uid(), updated_at = now()
   where id = p_cargo_id
  returning * into v_cargo;
  perform private.pm13_cargo_auditar('CARGO_DESACTIVADO', p_empresa_id, p_local_id, jsonb_build_object('cargoId', p_cargo_id, 'personasAfectadas', v_asignados, 'operationId', p_operation_id));
  return jsonb_build_object('ok', true, 'personas_afectadas', v_asignados, 'cargo', to_jsonb(v_cargo));
end
$$;

create or replace function public.abc_reactivar_cargo(
  p_operation_id text,
  p_empresa_id text,
  p_local_id text,
  p_cargo_id uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_cargo public.abc_cargos%rowtype;
begin
  perform private.pm13_cargo_validar_contexto(p_empresa_id, p_local_id);
  select * into v_cargo from public.abc_cargos where id = p_cargo_id and empresa_id = p_empresa_id for update;
  if not found then raise exception 'cargo_no_encontrado'; end if;
  if v_cargo.eliminado then raise exception 'cargo_eliminado_no_reactivable'; end if;
  update public.abc_cargos
     set activo = true, updated_by = auth.uid(), updated_at = now()
   where id = p_cargo_id
  returning * into v_cargo;
  perform private.pm13_cargo_auditar('CARGO_REACTIVADO', p_empresa_id, p_local_id, jsonb_build_object('cargoId', p_cargo_id, 'operationId', p_operation_id));
  return jsonb_build_object('ok', true, 'cargo', to_jsonb(v_cargo));
end
$$;

create or replace function public.abc_eliminar_cargo(
  p_operation_id text,
  p_empresa_id text,
  p_local_id text,
  p_cargo_id uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_cargo public.abc_cargos%rowtype;
  v_personas bigint;
begin
  perform private.pm13_cargo_validar_contexto(p_empresa_id, p_local_id);
  select * into v_cargo from public.abc_cargos where id = p_cargo_id and empresa_id = p_empresa_id for update;
  if not found then raise exception 'cargo_no_encontrado'; end if;
  if v_cargo.eliminado then return jsonb_build_object('ok', true, 'ya_eliminado', true, 'personas_afectadas', 0, 'cargo', to_jsonb(v_cargo)); end if;
  select count(distinct a.empleado_id) into v_personas
    from public.abc_cargo_asignaciones a
   where a.empresa_id = p_empresa_id and a.cargo_id = p_cargo_id and a.activo = true;
  update public.abc_cargo_asignaciones
     set activo = false, asignado_hasta = now(), updated_by = auth.uid(), updated_at = now()
   where empresa_id = p_empresa_id and cargo_id = p_cargo_id and activo = true;
  update public.abc_cargos
     set activo = false, eliminado = true, eliminado_en = now(), eliminado_por = auth.uid(), updated_by = auth.uid(), updated_at = now()
   where id = p_cargo_id
  returning * into v_cargo;
  perform private.pm13_cargo_auditar('CARGO_ELIMINADO', p_empresa_id, p_local_id, jsonb_build_object('cargoId', p_cargo_id, 'personasAfectadas', v_personas, 'operationId', p_operation_id));
  return jsonb_build_object('ok', true, 'personas_afectadas', v_personas, 'cargo', to_jsonb(v_cargo));
end
$$;

revoke all on function public.abc_listar_cargos(text, text) from public, anon, authenticated, service_role;
revoke all on function public.abc_crear_cargo(text, text, text, text, text) from public, anon, authenticated, service_role;
revoke all on function public.abc_editar_cargo(text, text, text, uuid, text, text) from public, anon, authenticated, service_role;
revoke all on function public.abc_duplicar_cargo(text, text, text, uuid, text) from public, anon, authenticated, service_role;
revoke all on function public.abc_desactivar_cargo(text, text, text, uuid) from public, anon, authenticated, service_role;
revoke all on function public.abc_reactivar_cargo(text, text, text, uuid) from public, anon, authenticated, service_role;
revoke all on function public.abc_eliminar_cargo(text, text, text, uuid) from public, anon, authenticated, service_role;
grant execute on function public.abc_listar_cargos(text, text) to authenticated;
grant execute on function public.abc_crear_cargo(text, text, text, text, text) to authenticated;
grant execute on function public.abc_editar_cargo(text, text, text, uuid, text, text) to authenticated;
grant execute on function public.abc_duplicar_cargo(text, text, text, uuid, text) to authenticated;
grant execute on function public.abc_desactivar_cargo(text, text, text, uuid) to authenticated;
grant execute on function public.abc_reactivar_cargo(text, text, text, uuid) to authenticated;
grant execute on function public.abc_eliminar_cargo(text, text, text, uuid) to authenticated;

comment on column public.abc_cargos.eliminado is 'Eliminación lógica: conserva permisos, asignaciones históricas y auditoría, pero no concede acceso ni se puede reactivar desde el panel.';
comment on function public.abc_eliminar_cargo(text, text, text, uuid) is 'Eliminación lógica de un cargo personalizado solo por Propietario; cierra asignaciones activas y conserva trazabilidad.';

-- Si una cuenta tuvo una asignación personalizada y esta se desactiva o elimina,
-- no debe recuperar pantallas del rol técnico histórico por una ruta de respaldo.
create or replace function public.pm13_listar_pantallas_efectivas(
  p_empresa_id text,
  p_local_id text,
  p_empleado_id text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_member public.membresias_usuario%rowtype;
  v_profile public.perfiles%rowtype;
  v_employee public.empleados%rowtype;
  v_assignment public.abc_cargo_asignaciones%rowtype;
  v_empleado_id text;
  v_pantallas jsonb;
begin
  if auth.uid() is null or nullif(btrim(coalesce(p_empresa_id, '')), '') is null or nullif(btrim(coalesce(p_local_id, '')), '') is null then
    return jsonb_build_object('ok', true, 'permitido', false, 'motivo', 'contexto_no_autorizado', 'pantallas', '[]'::jsonb);
  end if;
  select * into v_member
    from public.membresias_usuario m
   where m.user_id = auth.uid() and m.empresa_id = p_empresa_id and m.activo = true
     and ((m.todos_locales = false and m.local_id = p_local_id) or (m.todos_locales = true and m.local_id is null))
   order by case when m.todos_locales = false then 0 else 1 end, m.id desc
   limit 1;
  if not found or not exists (select 1 from public.locales l where l.id = p_local_id and l.empresa_id = p_empresa_id and l.activo = true) then
    return jsonb_build_object('ok', true, 'permitido', false, 'motivo', 'membresia_no_autorizada', 'pantallas', '[]'::jsonb);
  end if;
  if v_member.rol = 'Propietario' then
    select coalesce(jsonb_agg(jsonb_build_object('capacidad_consulta', c.capacidad_consulta, 'permitida', true) order by c.capacidad_consulta), '[]'::jsonb)
      into v_pantallas from private.pm13_p04_catalogo_consulta() c;
    return jsonb_build_object('ok', true, 'permitido', true, 'fuente', 'propietario_protegido', 'pantallas', v_pantallas);
  end if;
  select * into v_profile from public.perfiles p where p.user_id = auth.uid() and p.activo = true order by p.updated_at desc limit 1;
  v_empleado_id := coalesce(nullif(p_empleado_id, ''), v_profile.empleado_id);
  if v_empleado_id is null or v_profile.empleado_id is distinct from v_empleado_id then
    return jsonb_build_object('ok', true, 'permitido', false, 'motivo', 'empleado_no_vinculado', 'pantallas', '[]'::jsonb);
  end if;
  select * into v_employee from public.empleados e
   where e.id = v_empleado_id and e.empresa_id = p_empresa_id and e.local_id = p_local_id and e.estado = 'activo';
  if not found then
    return jsonb_build_object('ok', true, 'permitido', false, 'motivo', 'empleado_no_disponible', 'pantallas', '[]'::jsonb);
  end if;
  select a.* into v_assignment
    from public.abc_cargo_asignaciones a
    join public.abc_cargos c on c.id = a.cargo_id and c.empresa_id = a.empresa_id and c.activo = true and c.eliminado = false
   where a.empresa_id = p_empresa_id and a.local_id = p_local_id and a.empleado_id = v_employee.id and a.activo = true
   order by a.asignado_desde desc, a.created_at desc limit 1;
  if found then
    select coalesce(jsonb_agg(jsonb_build_object(
      'capacidad_consulta', catalogo.capacidad_consulta,
      'permitida', exists (select 1 from public.abc_cargo_pantallas cp where cp.empresa_id = p_empresa_id and cp.cargo_id = v_assignment.cargo_id and cp.capacidad_consulta = catalogo.capacidad_consulta)
    ) order by catalogo.capacidad_consulta), '[]'::jsonb)
      into v_pantallas from private.pm13_p04_catalogo_consulta() catalogo;
    return jsonb_build_object('ok', true, 'permitido', true, 'fuente', 'cargo', 'cargo_id', v_assignment.cargo_id, 'pantallas', v_pantallas);
  end if;
  if exists (select 1 from public.abc_cargo_asignaciones a where a.empresa_id = p_empresa_id and a.local_id = p_local_id and a.empleado_id = v_employee.id) then
    return jsonb_build_object('ok', true, 'permitido', false, 'motivo', 'cargo_no_asignado', 'pantallas', '[]'::jsonb);
  end if;
  if v_member.rol not in ('Encargado', 'Cajero/a', 'Camarero/a') then
    return jsonb_build_object('ok', true, 'permitido', false, 'motivo', 'cargo_no_asignado', 'pantallas', '[]'::jsonb);
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'capacidad_consulta', catalogo.capacidad,
    'permitida', case v_member.rol
      when 'Encargado' then coalesce(lo.permitido, em.permitido, catalogo.encargado)
      when 'Cajero/a' then coalesce(lo.permitido, em.permitido, catalogo.cajero)
      else coalesce(lo.permitido, em.permitido, catalogo.camarero)
    end
  ) order by catalogo.capacidad), '[]'::jsonb)
    into v_pantallas
    from private.abc_rol_pantalla_catalogo() catalogo
    left join public.abc_pantallas_rol lo on lo.empresa_id = p_empresa_id and lo.local_id = p_local_id and lo.rol = v_member.rol and lo.capacidad = catalogo.capacidad
    left join public.abc_pantallas_rol em on em.empresa_id = p_empresa_id and em.local_id is null and em.rol = v_member.rol and em.capacidad = catalogo.capacidad;
  return jsonb_build_object('ok', true, 'permitido', true, 'fuente', 'rol_tecnico_compatibilidad', 'pantallas', v_pantallas);
end
$$;

revoke all on function public.pm13_listar_pantallas_efectivas(text,text,text) from public, anon, authenticated, service_role;
grant execute on function public.pm13_listar_pantallas_efectivas(text,text,text) to authenticated;

commit;
