CREATE OR REPLACE FUNCTION public.estampar_propiedad_suscripcion_push()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_rol text;
  v_activo boolean;
  v_empleado_id text;
  v_local_empleado text;
  v_local_unico text;
  v_num_locales integer := 0;
  v_local_valido boolean := false;
begin
  -- Las operaciones internas con service_role no tienen auth.uid(). En ese
  -- caso no se inventa identidad y se conserva lo que ya traiga la fila.
  if v_uid is null then
    return new;
  end if;

  select p.rol, p.activo, p.empleado_id
    into v_rol, v_activo, v_empleado_id
  from public.perfiles p
  where p.user_id = v_uid
  limit 1;

  if not found or v_activo is distinct from true then
    raise exception 'Perfil no activo' using errcode = '42501';
  end if;

  if tg_op = 'UPDATE' and new.endpoint is distinct from old.endpoint then
    raise exception 'No se puede cambiar el endpoint de una suscripción' using errcode = '42501';
  end if;

  -- Para reclamar una fila antigua sin propietario, el navegador debe aportar
  -- exactamente las mismas claves criptográficas que ya estaban guardadas.
  if tg_op = 'UPDATE' and old.user_id is null then
    if new.p256dh is distinct from old.p256dh or new.auth is distinct from old.auth then
      raise exception 'No se puede reclamar una suscripción antigua con claves distintas' using errcode = '42501';
    end if;
  end if;

  -- La identidad nunca se confía al JSON enviado por el navegador.
  new.user_id := v_uid;

  -- Para cuentas ligadas a un empleado, el local se deriva del propio registro
  -- del empleado. El cliente no puede elegir otro local.
  if v_empleado_id is not null then
    select elem->>'localId'
      into v_local_empleado
    from jsonb_array_elements(
      coalesce((select value from public.almacen_kv where key = 'empleados'), '[]'::jsonb)
    ) elem
    where elem->>'id' = v_empleado_id
    limit 1;

    new.local_id := nullif(v_local_empleado, '');
    return new;
  end if;

  -- Propietario/Encargado: si el futuro frontend envía un local, se acepta
  -- únicamente si existe entre los locales de productos o en la lista de
  -- locales. Si no envía ninguno y toda la empresa usa un único local, se
  -- infiere automáticamente.
  if new.local_id is not null and btrim(new.local_id) <> '' then
    select exists (
      select 1
      from jsonb_array_elements(
        coalesce((select value from public.almacen_kv where key = 'productos'), '[]'::jsonb)
      ) elem
      where elem->>'localId' = new.local_id
    ) or exists (
      select 1
      from jsonb_array_elements(
        coalesce((select value from public.almacen_kv where key = 'locales'), '[]'::jsonb)
      ) elem
      where elem->>'id' = new.local_id
    ) into v_local_valido;

    if not v_local_valido then
      raise exception 'Local de suscripción no válido' using errcode = '42501';
    end if;
  else
    select count(*), min(local_id)
      into v_num_locales, v_local_unico
    from (
      select distinct nullif(elem->>'localId', '') as local_id
      from jsonb_array_elements(
        coalesce((select value from public.almacen_kv where key = 'productos'), '[]'::jsonb)
      ) elem
      where nullif(elem->>'localId', '') is not null
    ) s;

    new.local_id := case when v_num_locales = 1 then v_local_unico else null end;
  end if;

  return new;
end;
$function$
