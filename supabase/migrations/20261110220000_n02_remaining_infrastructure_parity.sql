-- N-02: paridad QA de guards de infraestructura presentes en producción.
--
-- Medición de solo lectura del 2026-11-10: producción tenía estos cinco
-- helpers y cuatro triggers; QA tenía las tablas, pero no los objetos.
-- Los cuerpos proceden de pg_get_functiondef() de producción. Se excluyen
-- deliberadamente anular_venta_tpv, descontar_stock* y las sobrecargas
-- históricas de registrar_auditoria: son funciones legacy de operaciones
-- sensibles y requieren una decisión de alcance independiente.
-- Esta migración no inserta datos ni ejecuta operaciones de negocio.

create or replace function private.es_propietario_activo()
returns boolean
language sql
stable security definer
set search_path to 'public', 'pg_temp'
as $function$
  select exists (
    select 1
    from public.perfiles p
    where p.user_id = (select auth.uid())
      and p.activo = true
      and p.rol = 'Propietario'
  );
$function$;

create or replace function private.pm13_cargo_guard_nombre()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if new.nombre_normalizado = any (array['propietario','encargado','cajero/a','camarero/a','churrero/a','básico','estándar']) then
    raise exception 'cargo_nombre_reservado';
  end if;
  return new;
end
$function$;

create or replace function private.pm13_cargo_guard_propietario()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if exists (
    select 1
      from public.perfiles p
      join public.membresias_usuario m on m.user_id = p.user_id
     where p.empleado_id = new.empleado_id
       and p.activo = true
       and p.rol = 'Propietario'
       and m.empresa_id = new.empresa_id
       and m.activo = true
       and m.rol = 'Propietario'
       and (m.todos_locales = true or m.local_id = new.local_id)
  ) then
    raise exception 'cargo_propietario_no_asignable';
  end if;
  return new;
end
$function$;

create or replace function public.completar_local_movimiento()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_local_id text;
  v_empresa text;
begin
  if coalesce(new.datos->>'localId','') <> '' then
    return new;
  end if;

  v_empresa := coalesce(
    nullif(btrim(coalesce(new.empresa_id,'')),''),
    nullif(btrim(coalesce(new.datos->>'empresaId','')),''),
    case when auth.uid() is null then null else private.plataforma_empresa_del_llamante() end
  );
  if v_empresa is null then
    return new;
  end if;

  select elem->>'localId'
    into v_local_id
  from public.almacen_kv k,
       lateral jsonb_array_elements(coalesce(k.value,'[]'::jsonb)) elem
  where k.key='productos'
    and k.empresa_id = v_empresa
    and elem->>'id' = new.datos->>'productoId'
    and coalesce(elem->>'localId','') <> ''
  limit 1;

  if v_local_id is not null then
    new.datos := jsonb_set(new.datos, '{localId}', to_jsonb(v_local_id), true);
  end if;
  return new;
end;
$function$;

create or replace function public.estampar_propiedad_suscripcion_push()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_rol text;
  v_activo boolean;
  v_empleado_id text;
  v_local_empleado text;
  v_local_unico text;
  v_num_locales integer := 0;
  v_local_valido boolean := false;
  v_empresa text;
begin
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

  v_empresa := private.plataforma_empresa_del_llamante();

  if tg_op = 'UPDATE' and new.endpoint is distinct from old.endpoint then
    raise exception 'No se puede cambiar el endpoint de una suscripción' using errcode = '42501';
  end if;

  if tg_op = 'UPDATE' and old.user_id is null then
    if new.p256dh is distinct from old.p256dh or new.auth is distinct from old.auth then
      raise exception 'No se puede reclamar una suscripción antigua con claves distintas' using errcode = '42501';
    end if;
  end if;

  new.user_id := v_uid;

  if v_empleado_id is not null then
    select elem->>'localId'
      into v_local_empleado
    from jsonb_array_elements(
      coalesce((select value from public.almacen_kv where key = 'empleados' and empresa_id = v_empresa), '[]'::jsonb)
    ) elem
    where elem->>'id' = v_empleado_id
    limit 1;

    new.local_id := nullif(v_local_empleado, '');
    return new;
  end if;

  if new.local_id is not null and btrim(new.local_id) <> '' then
    select exists (
      select 1
      from jsonb_array_elements(
        coalesce((select value from public.almacen_kv where key = 'productos' and empresa_id = v_empresa), '[]'::jsonb)
      ) elem
      where elem->>'localId' = new.local_id
    ) or exists (
      select 1
      from jsonb_array_elements(
        coalesce((select value from public.almacen_kv where key = 'locales' and empresa_id = v_empresa), '[]'::jsonb)
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
        coalesce((select value from public.almacen_kv where key = 'productos' and empresa_id = v_empresa), '[]'::jsonb)
      ) elem
      where nullif(elem->>'localId', '') is not null
    ) s;

    new.local_id := case when v_num_locales = 1 then v_local_unico else null end;
  end if;

  return new;
end;
$function$;

revoke all on function private.es_propietario_activo() from public, anon, service_role;
revoke all on function private.pm13_cargo_guard_nombre() from public, anon, authenticated, service_role;
revoke all on function private.pm13_cargo_guard_propietario() from public, anon, authenticated, service_role;
revoke all on function public.completar_local_movimiento() from public, anon, authenticated, service_role;
revoke all on function public.estampar_propiedad_suscripcion_push() from public, anon, authenticated, service_role;
grant execute on function private.es_propietario_activo() to authenticated;
grant execute on function private.es_propietario_activo() to postgres;
grant execute on function private.pm13_cargo_guard_nombre() to postgres;
grant execute on function private.pm13_cargo_guard_propietario() to postgres;
grant execute on function public.completar_local_movimiento() to postgres;
grant execute on function public.estampar_propiedad_suscripcion_push() to postgres;

do $migration$
begin
  if not exists (
    select 1 from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where not t.tgisinternal and n.nspname = 'public'
      and c.relname = 'abc_cargos' and t.tgname = 'pm13_cargo_guard_nombre'
  ) then
    create trigger pm13_cargo_guard_nombre
      before insert or update of nombre, nombre_normalizado on public.abc_cargos
      for each row execute function private.pm13_cargo_guard_nombre();
  end if;

  if not exists (
    select 1 from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where not t.tgisinternal and n.nspname = 'public'
      and c.relname = 'abc_cargo_asignaciones' and t.tgname = 'pm13_cargo_guard_propietario'
  ) then
    create trigger pm13_cargo_guard_propietario
      before insert or update of empleado_id, empresa_id, local_id, cargo_id on public.abc_cargo_asignaciones
      for each row execute function private.pm13_cargo_guard_propietario();
  end if;

  if not exists (
    select 1 from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where not t.tgisinternal and n.nspname = 'public'
      and c.relname = 'movimientos_registro' and t.tgname = 'movimientos_completar_local'
  ) then
    create trigger movimientos_completar_local
      before insert or update of datos on public.movimientos_registro
      for each row execute function public.completar_local_movimiento();
  end if;

  if not exists (
    select 1 from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where not t.tgisinternal and n.nspname = 'public'
      and c.relname = 'suscripciones_push' and t.tgname = 'suscripciones_push_estampar_propiedad'
  ) then
    create trigger suscripciones_push_estampar_propiedad
      before insert or update on public.suscripciones_push
      for each row execute function public.estampar_propiedad_suscripcion_push();
  end if;
end;
$migration$;
