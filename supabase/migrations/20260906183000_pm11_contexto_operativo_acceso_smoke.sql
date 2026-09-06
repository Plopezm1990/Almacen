-- PM11 · Personal / Empleados · P10 smoke real
-- Contexto operativo mínimo para cuentas autenticadas.
-- Aplicar únicamente en QA hasta autorización expresa. Producción/main no se toca.

create or replace function public.obtener_contexto_operativo()
returns jsonb
language plpgsql
security definer
set search_path = 'public', 'auth', 'private', 'pg_temp'
as $$
declare
  v_uid uuid := auth.uid();
  v_perfil public.perfiles%rowtype;
  v_rol text;
  v_empresa_id text;
  v_local_id text;
  v_todos_locales boolean := false;
  v_locales jsonb := '[]'::jsonb;
  v_empresas jsonb := '[]'::jsonb;
  v_empleado jsonb := null;
  v_empleados_fichaje jsonb := '[]'::jsonb;
  v_modulos jsonb := '[]'::jsonb;
  v_num_empresas integer := 0;
  v_num_roles integer := 0;
begin
  if v_uid is null then
    raise exception 'contexto_sesion_requerida';
  end if;

  select * into v_perfil
    from public.perfiles p
   where p.user_id = v_uid;

  if not found or v_perfil.activo is not true then
    raise exception 'contexto_perfil_inactivo';
  end if;

  select count(distinct m.empresa_id), count(distinct m.rol)
    into v_num_empresas, v_num_roles
    from public.membresias_usuario m
   where m.user_id = v_uid
     and m.activo is true;

  if v_num_empresas = 0 then
    raise exception 'contexto_sin_membresia_activa';
  end if;

  -- El bundle actual usa un rol operativo único. Si una misma cuenta acumula
  -- roles distintos, se falla cerrado hasta que el selector multiempresa/rol
  -- pueda expresar ese contexto de forma explícita.
  if v_num_roles <> 1 then
    raise exception 'contexto_roles_inconsistentes';
  end if;

  select min(m.rol),
         case when v_num_empresas = 1 then min(m.empresa_id) else null end,
         bool_or(m.todos_locales is true)
    into v_rol, v_empresa_id, v_todos_locales
    from public.membresias_usuario m
   where m.user_id = v_uid
     and m.activo is true;

  -- Para cuentas operativas no Propietario el contexto debe ser concreto.
  -- Si hay exactamente un local autorizado, queda fijado como local activo.
  if v_rol <> 'Propietario' then
    select case when count(distinct m.local_id) = 1 then min(m.local_id) else null end
      into v_local_id
      from public.membresias_usuario m
     where m.user_id = v_uid
       and m.activo is true
       and m.todos_locales is false
       and nullif(btrim(m.local_id), '') is not null
       and upper(btrim(m.local_id)) not in ('TODOS', 'TODOS LOS LOCALES');

    if v_local_id is null then
      raise exception 'contexto_local_operativo_ambiguo';
    end if;
  end if;

  -- Catálogo empresarial mínimo. Se toma del bloque histórico de locales,
  -- filtrado siempre por las membresías del usuario. Si no existe catálogo,
  -- se construye un descriptor técnico mínimo desde la membresía.
  with membresias as (
    select m.empresa_id, m.local_id, m.todos_locales
      from public.membresias_usuario m
     where m.user_id = v_uid and m.activo is true
  ), catalogo as (
    select kv.empresa_id,
           elem
      from public.almacen_kv kv
      cross join lateral jsonb_array_elements(
        case when jsonb_typeof(kv.value) = 'array' then kv.value else '[]'::jsonb end
      ) elem
     where kv.key = 'locales'
  ), permitidos as (
    select distinct c.elem
      from catalogo c
      join membresias m
        on m.empresa_id = c.empresa_id
       and (
         m.todos_locales is true
         or (m.local_id is not null and c.elem->>'id' = m.local_id)
       )
     where coalesce((c.elem->>'activo')::boolean, true) is true
       and nullif(btrim(c.elem->>'id'), '') is not null
  )
  select coalesce(jsonb_agg(elem order by elem->>'id'), '[]'::jsonb)
    into v_locales
    from permitidos;

  if jsonb_array_length(v_locales) = 0 then
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'id', m.local_id,
        'nombre', m.local_id,
        'empresaId', m.empresa_id,
        'activo', true
      ) order by m.empresa_id, m.local_id
    ), '[]'::jsonb)
      into v_locales
      from public.membresias_usuario m
     where m.user_id = v_uid
       and m.activo is true
       and m.todos_locales is false
       and nullif(btrim(m.local_id), '') is not null
       and upper(btrim(m.local_id)) not in ('TODOS', 'TODOS LOS LOCALES');
  end if;

  select coalesce(jsonb_agg(distinct jsonb_build_object(
    'id', m.empresa_id,
    'rol', m.rol,
    'todosLocales', m.todos_locales
  )), '[]'::jsonb)
    into v_empresas
    from public.membresias_usuario m
   where m.user_id = v_uid
     and m.activo is true;

  if v_perfil.empleado_id is not null then
    select jsonb_build_object(
      'id', e.id,
      'nombre', e.nombre,
      'empresaId', e.empresa_id,
      'localId', e.local_id,
      'activo', e.estado = 'activo',
      'estado', e.estado
    )
      into v_empleado
      from public.empleados e
     where e.id = v_perfil.empleado_id
       and e.estado = 'activo'
       and exists (
         select 1
           from public.membresias_usuario m
          where m.user_id = v_uid
            and m.activo is true
            and m.empresa_id = e.empresa_id
            and (
              m.todos_locales is true
              or (m.todos_locales is false and m.local_id = e.local_id)
            )
       );

    if v_empleado is null then
      raise exception 'contexto_empleado_vinculado_no_operativo';
    end if;
  end if;

  -- Fichajes de un empleado normal solo necesitan su propia identidad mínima.
  -- Encargado puede seleccionar empleados activos de su local autorizado.
  if v_rol = 'Encargado' then
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', e.id,
      'nombre', e.nombre,
      'empresaId', e.empresa_id,
      'localId', e.local_id,
      'activo', true
    ) order by e.nombre, e.id), '[]'::jsonb)
      into v_empleados_fichaje
      from public.empleados e
     where e.estado = 'activo'
       and exists (
         select 1
           from public.membresias_usuario m
          where m.user_id = v_uid
            and m.activo is true
            and m.todos_locales is false
            and m.empresa_id = e.empresa_id
            and m.local_id = e.local_id
       );
  elsif v_empleado is not null then
    v_empleados_fichaje := jsonb_build_array(v_empleado);
  end if;

  -- Contrato explícito del smoke actual. El resto de roles conserva su mapa
  -- histórico de interfaz; Camarero/a queda reducido a TPV + Fichajes.
  if v_rol = 'Camarero/a' then
    v_modulos := jsonb_build_array('tpv', 'fichajes');
  end if;

  return jsonb_build_object(
    'ok', true,
    'rol', v_rol,
    'empresaId', v_empresa_id,
    'localId', v_local_id,
    'todosLocales', v_todos_locales,
    'empresas', v_empresas,
    'locales', v_locales,
    'empleado', v_empleado,
    'empleadosFichaje', v_empleados_fichaje,
    'modulos', v_modulos
  );
end;
$$;

revoke all on function public.obtener_contexto_operativo() from public, anon;
grant execute on function public.obtener_contexto_operativo() to authenticated;

comment on function public.obtener_contexto_operativo() is
  'PM11 P10: contexto operativo mínimo derivado de perfil/membresías activas; fija el alcance de local de cuentas de empleado y no confía en datos de contexto enviados por el navegador.';
