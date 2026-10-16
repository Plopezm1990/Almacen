CREATE OR REPLACE FUNCTION public.pm11_preparar_cuenta_empleado(p_actor_user_id uuid, p_empleado_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'private', 'pg_temp'
AS $function$
declare
  v_empleado record;
  v_cuenta record;
  v_email text;
begin
  if p_actor_user_id is null or nullif(btrim(p_empleado_id),'') is null then
    return jsonb_build_object('ok',false,'codigo','datos_invalidos');
  end if;
  if not exists (select 1 from public.perfiles p where p.user_id=p_actor_user_id and p.activo=true) then
    return jsonb_build_object('ok',false,'codigo','perfil_no_activo');
  end if;
  select e.id,e.empresa_id,e.local_id,e.estado,e.nombre into v_empleado
    from public.empleados e where e.id=btrim(p_empleado_id);
  if not found then return jsonb_build_object('ok',false,'codigo','empleado_no_disponible'); end if;
  if not exists (
    select 1 from public.membresias_usuario m
     where m.user_id=p_actor_user_id and m.activo=true
       and m.empresa_id=v_empleado.empresa_id and m.rol='Propietario'
       and (m.todos_locales=true or (m.todos_locales=false and m.local_id=v_empleado.local_id))
  ) then return jsonb_build_object('ok',false,'codigo','empleado_no_disponible'); end if;
  if not private.pm11_local_activo(v_empleado.empresa_id,v_empleado.local_id) then
    return jsonb_build_object('ok',false,'codigo','local_inactivo');
  end if;
  if v_empleado.estado <> 'activo' then return jsonb_build_object('ok',false,'codigo','empleado_no_activo'); end if;
  select p.user_id,p.rol,p.activo into v_cuenta
    from public.perfiles p where p.empleado_id=v_empleado.id limit 1;
  if not found or v_cuenta.user_id is null then
    return jsonb_build_object('ok',true,'estado','disponible','empleado',jsonb_build_object(
      'id',v_empleado.id,'empresa_id',v_empleado.empresa_id,'local_id',v_empleado.local_id,
      'estado',v_empleado.estado,'nombre',v_empleado.nombre));
  end if;
  select u.email into v_email from auth.users u where u.id=v_cuenta.user_id;
  return jsonb_build_object('ok',true,'estado','vinculado','empleado',jsonb_build_object(
    'id',v_empleado.id,'empresa_id',v_empleado.empresa_id,'local_id',v_empleado.local_id,
    'estado',v_empleado.estado,'nombre',v_empleado.nombre),'cuenta',jsonb_build_object(
    'userId',v_cuenta.user_id,'rol',v_cuenta.rol,'activo',v_cuenta.activo,'email',coalesce(v_email,'')));
end;
$function$;
