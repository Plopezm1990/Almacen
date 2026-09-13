-- PM27 / C13
-- Correccion minima de SECURITY DEFINER con contexto tenant autoritativo.
-- Alcance: retirar ejecucion autenticada de dos RPC legacy globales y
-- mantener obtener_contexto_operativo() compatible, derivando empresa/local
-- exclusivamente de membresias activas del usuario autenticado.

begin;

-- Preflight: esta migracion solo es valida sobre el contrato PM21/PM26 esperado.
do $preflight$
begin
  if pg_catalog.to_regclass('public.perfiles') is null then
    raise exception 'PM27_C13_PREFLIGHT: falta public.perfiles';
  end if;
  if pg_catalog.to_regclass('public.membresias_usuario') is null then
    raise exception 'PM27_C13_PREFLIGHT: falta public.membresias_usuario';
  end if;
  if pg_catalog.to_regclass('public.almacen_kv') is null then
    raise exception 'PM27_C13_PREFLIGHT: falta public.almacen_kv';
  end if;
  if pg_catalog.to_regprocedure('private.la_usuario_activo()') is null then
    raise exception 'PM27_C13_PREFLIGHT: falta private.la_usuario_activo()';
  end if;
  if pg_catalog.to_regprocedure('private.la_tiene_empresa(text)') is null then
    raise exception 'PM27_C13_PREFLIGHT: falta private.la_tiene_empresa(text)';
  end if;
  if pg_catalog.to_regprocedure('private.la_tiene_local(text,text)') is null then
    raise exception 'PM27_C13_PREFLIGHT: falta private.la_tiene_local(text,text)';
  end if;
end
$preflight$;

-- Las RPC legacy operan sobre almacen_kv global y no reciben empresa/local.
-- No se inventa un tenant ni se confia en localId embebido por el cliente:
-- se conserva el objeto para rollback/control historico, pero se retira su
-- superficie ejecutable desde navegador autenticado.
do $legacy$
begin
  if pg_catalog.to_regprocedure('public.descontar_stock_carrito(jsonb,text)') is not null then
    revoke all on function public.descontar_stock_carrito(jsonb,text) from public;
    revoke all on function public.descontar_stock_carrito(jsonb,text) from anon;
    revoke all on function public.descontar_stock_carrito(jsonb,text) from authenticated;
  end if;

  if pg_catalog.to_regprocedure('public.anular_venta_tpv(text,text)') is not null then
    revoke all on function public.anular_venta_tpv(text,text) from public;
    revoke all on function public.anular_venta_tpv(text,text) from anon;
    revoke all on function public.anular_venta_tpv(text,text) from authenticated;
  end if;
end
$legacy$;

create or replace function public.obtener_contexto_operativo()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_perfil_rol text;
  v_membresia_rol text;
  v_num_empresas integer := 0;
  v_num_roles integer := 0;
  v_num_locales_concretos integer := 0;
  v_empresa_id text := null;
  v_local_id text := null;
  v_todos_locales boolean := false;
  v_empresas jsonb := '[]'::jsonb;
  v_locales jsonb := '[]'::jsonb;
begin
  if v_uid is null then
    raise exception 'contexto_sesion_requerida' using errcode = '42501';
  end if;

  if not private.la_usuario_activo() then
    raise exception 'contexto_usuario_no_activo' using errcode = '42501';
  end if;

  select p.rol
    into v_perfil_rol
    from public.perfiles p
   where p.user_id = v_uid
     and p.activo is true
   limit 1;

  if v_perfil_rol is null then
    raise exception 'contexto_perfil_inactivo' using errcode = '42501';
  end if;

  select pg_catalog.count(distinct m.empresa_id),
         pg_catalog.count(distinct m.rol),
         pg_catalog.min(m.rol),
         coalesce(pg_catalog.bool_or(m.todos_locales is true), false)
    into v_num_empresas, v_num_roles, v_membresia_rol, v_todos_locales
    from public.membresias_usuario m
   where m.user_id = v_uid
     and m.activo is true;

  if v_num_empresas = 0 then
    raise exception 'contexto_sin_membresia_activa' using errcode = '42501';
  end if;

  if v_num_roles <> 1 or v_membresia_rol is distinct from v_perfil_rol then
    raise exception 'contexto_roles_inconsistentes' using errcode = '42501';
  end if;

  if v_num_empresas = 1 then
    select pg_catalog.min(m.empresa_id)
      into v_empresa_id
      from public.membresias_usuario m
     where m.user_id = v_uid
       and m.activo is true;
  end if;

  -- Un local solo es autoritativo si existe exactamente uno concreto y no
  -- hay ninguna membresia todos_locales que vuelva ambigua la seleccion.
  if not v_todos_locales then
    select pg_catalog.count(distinct m.local_id),
           case
             when pg_catalog.count(distinct m.local_id) = 1 then pg_catalog.min(m.local_id)
             else null
           end
      into v_num_locales_concretos, v_local_id
      from public.membresias_usuario m
     where m.user_id = v_uid
       and m.activo is true
       and m.todos_locales is false
       and nullif(pg_catalog.btrim(m.local_id), '') is not null
       and pg_catalog.upper(pg_catalog.btrim(m.local_id)) not in ('TODOS', 'TODOS LOS LOCALES');
  end if;

  -- Empresas: nunca se aceptan IDs del navegador; salen de membresias activas.
  select coalesce(
           pg_catalog.jsonb_agg(
             pg_catalog.jsonb_build_object(
               'id', x.empresa_id,
               'rol', x.rol,
               'todosLocales', x.todos_locales
             )
           ),
           '[]'::jsonb
         )
    into v_empresas
    from (
      select m.empresa_id,
             pg_catalog.min(m.rol) as rol,
             pg_catalog.bool_or(m.todos_locales is true) as todos_locales
        from public.membresias_usuario m
       where m.user_id = v_uid
         and m.activo is true
       group by m.empresa_id
    ) x;

  -- El almacen legacy no tiene columnas empresa_id/local_id. Para el catalogo
  -- de locales solo se aceptan elementos que declaran empresaId y cuyo par
  -- empresa/local esta cubierto por una membresia activa. No se exponen otros
  -- blobs legacy (empleados, proveedores, fichas, encargos) porque no existe
  -- en produccion una pertenencia tenant verificable para esas colecciones.
  with membresias as (
    select m.empresa_id, m.local_id, m.todos_locales
      from public.membresias_usuario m
     where m.user_id = v_uid
       and m.activo is true
  ), catalogo as (
    select elem
      from public.almacen_kv k
      cross join lateral pg_catalog.jsonb_array_elements(
        case
          when pg_catalog.jsonb_typeof(k.value) = 'array' then k.value
          else '[]'::jsonb
        end
      ) elem
     where k.key = 'locales'
  ), permitidos as (
    select distinct c.elem
      from catalogo c
      join membresias m
        on m.empresa_id = nullif(pg_catalog.btrim(c.elem->>'empresaId'), '')
       and (
         m.todos_locales is true
         or (
           m.todos_locales is false
           and m.local_id = nullif(pg_catalog.btrim(c.elem->>'id'), '')
         )
       )
     where nullif(pg_catalog.btrim(c.elem->>'id'), '') is not null
       and nullif(pg_catalog.btrim(c.elem->>'empresaId'), '') is not null
       and coalesce(pg_catalog.lower(c.elem->>'activo') <> 'false', true)
  )
  select coalesce(pg_catalog.jsonb_agg(p.elem), '[]'::jsonb)
    into v_locales
    from permitidos p;

  -- Si el catalogo legacy no permite demostrar los locales, solo se puede
  -- devolver como fallback una membresia a local concreto. Una membresia
  -- todos_locales sin catalogo verificable permanece sin seleccion arbitraria.
  if pg_catalog.jsonb_array_length(v_locales) = 0 then
    select coalesce(
             pg_catalog.jsonb_agg(
               pg_catalog.jsonb_build_object(
                 'id', x.local_id,
                 'nombre', x.local_id,
                 'empresaId', x.empresa_id,
                 'activo', true
               )
             ),
             '[]'::jsonb
           )
      into v_locales
      from (
        select distinct m.empresa_id, m.local_id
          from public.membresias_usuario m
         where m.user_id = v_uid
           and m.activo is true
           and m.todos_locales is false
           and nullif(pg_catalog.btrim(m.local_id), '') is not null
           and pg_catalog.upper(pg_catalog.btrim(m.local_id)) not in ('TODOS', 'TODOS LOS LOCALES')
      ) x;
  end if;

  return pg_catalog.jsonb_build_object(
    'ok', true,
    'rol', v_membresia_rol,
    'empresaId', v_empresa_id,
    'localId', v_local_id,
    'todosLocales', v_todos_locales,
    'empresas', v_empresas,
    'locales', v_locales,
    'empleado', null,
    'empleadosFichaje', '[]'::jsonb,
    'proveedores', '[]'::jsonb,
    'fichasProduccion', '[]'::jsonb,
    'cobrosEncargos', '[]'::jsonb,
    'modulos', '[]'::jsonb
  );
end;
$function$;

-- Contrato API: la RPC de contexto sigue disponible para el frontend
-- autenticado; PUBLIC/anon permanecen fuera.
revoke all on function public.obtener_contexto_operativo() from public;
revoke all on function public.obtener_contexto_operativo() from anon;
revoke all on function public.obtener_contexto_operativo() from authenticated;
grant execute on function public.obtener_contexto_operativo() to authenticated;

commit;
