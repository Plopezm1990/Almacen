-- P2-SEC · preflight server-side para crear una cuenta de empleado.
--
-- crear-cuenta-empleado usa service_role para Auth, pero service_role no debe
-- tener SELECT directo sobre las tablas empresariales. Esta RPC devuelve solo
-- el empleado solicitado y el estado de su cuenta después de validar al
-- Propietario y el alcance del local.

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
  if to_regclass('auth.users') is null then v_missing := array_append(v_missing,'auth.users'); end if;
  if to_regprocedure('private.pm11_local_activo(text,text)') is null then v_missing := array_append(v_missing,'private.pm11_local_activo(text,text)'); end if;
  if not exists(select 1 from pg_roles where rolname='service_role') then v_missing := array_append(v_missing,'service_role'); end if;
  if not exists(select 1 from pg_roles where rolname='anon') then v_missing := array_append(v_missing,'anon'); end if;
  if not exists(select 1 from pg_roles where rolname='authenticated') then v_missing := array_append(v_missing,'authenticated'); end if;

  select count(*) into v_other_overloads
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public'
     and p.proname='pm11_preparar_cuenta_empleado'
     and p.oid <> coalesce(to_regprocedure('public.pm11_preparar_cuenta_empleado(uuid,text)')::oid,0);
  if v_other_overloads <> 0 then v_missing := array_append(v_missing,'pm11_preparar_cuenta_empleado_overload_conflict'); end if;

  if cardinality(v_missing)>0 then
    raise exception 'P2_SEC_PM11_PREPARE_PREFLIGHT_FALLO:%',array_to_string(v_missing,',');
  end if;
end
$preflight$;

create or replace function public.pm11_preparar_cuenta_empleado(
  p_actor_user_id uuid,
  p_empleado_id text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'auth', 'private', 'pg_temp'
as $function$
declare
  v_empleado record;
  v_cuenta record;
  v_email text;
begin
  if p_actor_user_id is null or nullif(btrim(p_empleado_id),'') is null then
    return jsonb_build_object('ok',false,'codigo','datos_invalidos');
  end if;

  if not exists (
    select 1 from public.perfiles p
     where p.user_id = p_actor_user_id and p.activo = true
  ) then
    return jsonb_build_object('ok',false,'codigo','perfil_no_activo');
  end if;

  select e.id,e.empresa_id,e.local_id,e.estado,e.nombre
    into v_empleado
    from public.empleados e
   where e.id = btrim(p_empleado_id);
  if not found then
    return jsonb_build_object('ok',false,'codigo','empleado_no_encontrado');
  end if;

  if not exists (
    select 1 from public.membresias_usuario m
     where m.user_id = p_actor_user_id
       and m.activo = true
       and m.empresa_id = v_empleado.empresa_id
       and m.rol = 'Propietario'
       and (m.todos_locales = true or (m.todos_locales = false and m.local_id = v_empleado.local_id))
  ) then
    return jsonb_build_object('ok',false,'codigo','sin_alcance');
  end if;

  if not private.pm11_local_activo(v_empleado.empresa_id,v_empleado.local_id) then
    return jsonb_build_object('ok',false,'codigo','local_inactivo');
  end if;
  if v_empleado.estado <> 'activo' then
    return jsonb_build_object('ok',false,'codigo','empleado_no_activo');
  end if;

  select p.user_id,p.rol,p.activo
    into v_cuenta
    from public.perfiles p
   where p.empleado_id = v_empleado.id
   limit 1;

  if not found or v_cuenta.user_id is null then
    return jsonb_build_object(
      'ok',true,
      'estado','disponible',
      'empleado',jsonb_build_object(
        'id',v_empleado.id,
        'empresa_id',v_empleado.empresa_id,
        'local_id',v_empleado.local_id,
        'estado',v_empleado.estado,
        'nombre',v_empleado.nombre
      )
    );
  end if;

  select u.email into v_email from auth.users u where u.id = v_cuenta.user_id;
  return jsonb_build_object(
    'ok',true,
    'estado','vinculado',
    'empleado',jsonb_build_object(
      'id',v_empleado.id,
      'empresa_id',v_empleado.empresa_id,
      'local_id',v_empleado.local_id,
      'estado',v_empleado.estado,
      'nombre',v_empleado.nombre
    ),
    'cuenta',jsonb_build_object(
      'userId',v_cuenta.user_id,
      'rol',v_cuenta.rol,
      'activo',v_cuenta.activo,
      'email',coalesce(v_email,'')
    )
  );
end;
$function$;

revoke all on function public.pm11_preparar_cuenta_empleado(uuid,text)
  from public,anon,authenticated,service_role;
grant execute on function public.pm11_preparar_cuenta_empleado(uuid,text) to service_role;

do $postflight$
declare
  v_oid oid := to_regprocedure('public.pm11_preparar_cuenta_empleado(uuid,text)')::oid;
begin
  if v_oid is null then raise exception 'P2_SEC_PM11_PREPARE_POSTFLIGHT_FALLO:funcion_ausente'; end if;
  if not (select p.prosecdef from pg_proc p where p.oid=v_oid) then raise exception 'P2_SEC_PM11_PREPARE_POSTFLIGHT_FALLO:no_security_definer'; end if;
  if coalesce((select array_to_string(p.proconfig,',') from pg_proc p where p.oid=v_oid),'') <> 'search_path=public, auth, private, pg_temp' then
    raise exception 'P2_SEC_PM11_PREPARE_POSTFLIGHT_FALLO:search_path';
  end if;
  if has_function_privilege('public',v_oid,'EXECUTE')
     or has_function_privilege('anon',v_oid,'EXECUTE')
     or has_function_privilege('authenticated',v_oid,'EXECUTE')
     or not has_function_privilege('service_role',v_oid,'EXECUTE') then
    raise exception 'P2_SEC_PM11_PREPARE_POSTFLIGHT_FALLO:acl';
  end if;
end
$postflight$;

commit;
