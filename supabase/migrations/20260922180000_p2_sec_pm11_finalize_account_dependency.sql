-- P2-SEC · versionado de dependencia server-side para crear-cuenta-empleado.
-- La función ya está certificada en QA y PROD con el mismo hash.
-- Esta migración no toca datos existentes: reconstruye el contrato exacto y su ACL mínima.

begin;
set local lock_timeout='5s';
set local statement_timeout='30s';

do $preflight$
declare
  v_missing text[] := array[]::text[];
  v_other_overloads integer := 0;
begin
  if to_regclass('public.empleados') is null then v_missing := array_append(v_missing,'public.empleados'); end if;
  if to_regclass('public.perfiles') is null then v_missing := array_append(v_missing,'public.perfiles'); end if;
  if to_regclass('public.membresias_usuario') is null then v_missing := array_append(v_missing,'public.membresias_usuario'); end if;
  if to_regclass('public.auditoria_registro') is null then v_missing := array_append(v_missing,'public.auditoria_registro'); end if;
  if to_regclass('auth.users') is null then v_missing := array_append(v_missing,'auth.users'); end if;
  if to_regprocedure('private.pm11_local_activo(text,text)') is null then v_missing := array_append(v_missing,'private.pm11_local_activo(text,text)'); end if;

  if not exists(select 1 from pg_roles where rolname='service_role') then
    v_missing := array_append(v_missing,'service_role');
  end if;
  if not exists(select 1 from pg_roles where rolname='authenticated') then
    v_missing := array_append(v_missing,'authenticated');
  end if;
  if not exists(select 1 from pg_roles where rolname='anon') then
    v_missing := array_append(v_missing,'anon');
  end if;

  select count(*) into v_other_overloads
  from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public'
    and p.proname='pm11_finalizar_creacion_cuenta_empleado'
    and p.oid <> coalesce(
      to_regprocedure('public.pm11_finalizar_creacion_cuenta_empleado(uuid,uuid,text,text,text,text,text)')::oid,
      0
    );

  if v_other_overloads <> 0 then
    v_missing := array_append(v_missing,'pm11_finalizar_creacion_cuenta_empleado_overload_conflict');
  end if;

  if cardinality(v_missing)>0 then
    raise exception 'P2_SEC_PM11_FINALIZE_PREFLIGHT_FALLO:%',array_to_string(v_missing,',');
  end if;
end
$preflight$;

CREATE OR REPLACE FUNCTION public.pm11_finalizar_creacion_cuenta_empleado(p_actor_user_id uuid, p_user_id uuid, p_empresa_id text, p_local_id text, p_empleado_id text, p_nombre text, p_rol text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'private', 'pg_temp'
AS $function$
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
$function$;

revoke all on function public.pm11_finalizar_creacion_cuenta_empleado(uuid,uuid,text,text,text,text,text)
from public, anon, authenticated, service_role;
grant execute on function public.pm11_finalizar_creacion_cuenta_empleado(uuid,uuid,text,text,text,text,text)
to service_role;

do $postflight$
declare
  v_oid oid := to_regprocedure('public.pm11_finalizar_creacion_cuenta_empleado(uuid,uuid,text,text,text,text,text)')::oid;
  v_hash text;
begin
  if v_oid is null then
    raise exception 'P2_SEC_PM11_FINALIZE_POSTFLIGHT_FALLO:funcion_ausente';
  end if;

  if not (select p.prosecdef from pg_proc p where p.oid=v_oid) then
    raise exception 'P2_SEC_PM11_FINALIZE_POSTFLIGHT_FALLO:no_security_definer';
  end if;

  if coalesce((select array_to_string(p.proconfig,',') from pg_proc p where p.oid=v_oid),'')
     <> 'search_path=public, auth, private, pg_temp' then
    raise exception 'P2_SEC_PM11_FINALIZE_POSTFLIGHT_FALLO:search_path';
  end if;

  if has_function_privilege('public',v_oid,'EXECUTE')
     or has_function_privilege('anon',v_oid,'EXECUTE')
     or has_function_privilege('authenticated',v_oid,'EXECUTE')
     or not has_function_privilege('service_role',v_oid,'EXECUTE') then
    raise exception 'P2_SEC_PM11_FINALIZE_POSTFLIGHT_FALLO:acl';
  end if;

  select md5(pg_get_functiondef(v_oid)) into v_hash;
  if v_hash <> '354cd3754c4e09f56d0645a7599baf88' then
    raise exception 'P2_SEC_PM11_FINALIZE_POSTFLIGHT_FALLO:hash:%',v_hash;
  end if;
end
$postflight$;

commit;
