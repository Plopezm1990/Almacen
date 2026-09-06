-- PM11 · Personal / Empleados · P09
-- Finalización transaccional DB para creación segura de cuenta de empleado.
-- Aplicar únicamente en QA hasta autorización expresa. Producción/main no se toca.

create or replace function public.pm11_finalizar_creacion_cuenta_empleado(
  p_actor_user_id uuid,
  p_user_id uuid,
  p_empresa_id text,
  p_local_id text,
  p_empleado_id text,
  p_nombre text,
  p_rol text
) returns jsonb
language plpgsql
security definer
set search_path = 'public', 'auth', 'private', 'pg_temp'
as $$
declare
  v_empleado public.empleados%rowtype;
  v_perfil public.perfiles%rowtype;
  v_audit_id text;
begin
  if p_actor_user_id is null or p_user_id is null then
    raise exception 'cuenta_actor_o_usuario_no_resuelto';
  end if;
  if p_actor_user_id = p_user_id then
    raise exception 'cuenta_objetivo_actor_no_permitida';
  end if;
  if nullif(btrim(p_empresa_id), '') is null
     or nullif(btrim(p_local_id), '') is null
     or upper(btrim(p_local_id)) in ('TODOS', 'TODOS LOS LOCALES') then
    raise exception 'cuenta_contexto_local_invalido';
  end if;
  if nullif(btrim(p_empleado_id), '') is null or nullif(btrim(p_nombre), '') is null then
    raise exception 'cuenta_datos_empleado_incompletos';
  end if;
  if p_rol not in ('Encargado', 'Básico', 'Camarero/a', 'Cajero/a', 'Churrero/a') then
    raise exception 'cuenta_rol_no_permitido';
  end if;

  if not exists (
    select 1
      from public.perfiles p
     where p.user_id = p_actor_user_id
       and p.activo = true
  ) or not exists (
    select 1
      from public.membresias_usuario m
     where m.user_id = p_actor_user_id
       and m.activo = true
       and m.empresa_id = p_empresa_id
       and m.rol = 'Propietario'
       and (m.todos_locales = true or (m.todos_locales = false and m.local_id = p_local_id))
  ) then
    raise exception 'cuenta_creacion_no_autorizada';
  end if;

  if not private.pm11_local_activo(p_empresa_id, p_local_id) then
    raise exception 'cuenta_local_inactivo';
  end if;

  select * into v_empleado
    from public.empleados e
   where e.id = p_empleado_id
   for update;

  if not found then
    raise exception 'empleado_no_encontrado';
  end if;
  if v_empleado.empresa_id <> p_empresa_id or v_empleado.local_id <> p_local_id then
    raise exception 'empleado_contexto_no_coincide';
  end if;
  if v_empleado.estado <> 'activo' then
    raise exception 'empleado_no_activo_para_crear_cuenta';
  end if;

  if not exists (select 1 from auth.users u where u.id = p_user_id) then
    raise exception 'auth_usuario_objetivo_no_existe';
  end if;

  select * into v_perfil
    from public.perfiles p
   where p.user_id = p_user_id
   for update;

  if found then
    if v_perfil.empleado_id = p_empleado_id
       and v_perfil.activo = true
       and v_perfil.rol = p_rol
       and exists (
         select 1 from public.membresias_usuario m
          where m.user_id = p_user_id
            and m.activo = true
            and m.empresa_id = p_empresa_id
            and m.local_id = p_local_id
            and m.todos_locales = false
            and m.rol = p_rol
       )
       and not exists (
         select 1 from public.membresias_usuario m
          where m.user_id = p_user_id
            and m.activo = true
            and (
              m.empresa_id <> p_empresa_id
              or m.local_id is distinct from p_local_id
              or m.todos_locales = true
              or m.rol <> p_rol
            )
       ) then
      return jsonb_build_object(
        'ok', true,
        'yaCreada', true,
        'userId', p_user_id,
        'empleadoId', p_empleado_id,
        'rol', p_rol
      );
    end if;
    raise exception 'cuenta_objetivo_ya_configurada';
  end if;

  if exists (select 1 from public.membresias_usuario m where m.user_id = p_user_id) then
    raise exception 'cuenta_objetivo_tiene_membresias_previas';
  end if;

  if exists (
    select 1 from public.perfiles p
     where p.empleado_id = p_empleado_id
       and p.user_id <> p_user_id
  ) then
    raise exception 'empleado_cuenta_ya_vinculada';
  end if;

  insert into public.membresias_usuario(
    user_id, empresa_id, local_id, todos_locales, rol, activo
  ) values (
    p_user_id, p_empresa_id, p_local_id, false, p_rol, true
  );

  insert into public.perfiles(
    user_id, rol, nombre, empleado_id, activo
  ) values (
    p_user_id, p_rol, btrim(p_nombre), p_empleado_id, true
  );

  v_audit_id := gen_random_uuid()::text;
  insert into public.auditoria_registro(
    id, fecha, datos, empresa_id, local_id, actor_user_id
  ) values (
    v_audit_id,
    current_date,
    jsonb_build_object(
      'id', v_audit_id,
      'accion', 'Personal · crear cuenta empleado',
      'empleadoId', p_empleado_id,
      'empresaId', p_empresa_id,
      'localId', p_local_id,
      'actorUserId', p_actor_user_id,
      'cuentaUserId', p_user_id,
      'rol', p_rol
    ),
    p_empresa_id,
    p_local_id,
    p_actor_user_id
  );

  return jsonb_build_object(
    'ok', true,
    'yaCreada', false,
    'userId', p_user_id,
    'empleadoId', p_empleado_id,
    'rol', p_rol
  );
end;
$$;

-- La finalización usa service_role porque la Edge Function ya verificó el JWT del
-- Propietario. No queda expuesta a clientes authenticated ni anon.
revoke all on function public.pm11_finalizar_creacion_cuenta_empleado(uuid, uuid, text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.pm11_finalizar_creacion_cuenta_empleado(uuid, uuid, text, text, text, text, text)
  to service_role;
