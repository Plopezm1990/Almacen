-- PM33 P02: corrige regresión introducida por P01 para roles no gestionados
-- por el bloque de aislamiento obligatorio (p.ej. Camarero/a).
--
-- HALLAZGO (revisión de cierre, reproducido contra Postgres real con el
-- mismo fixture de P01): P01 solo calcula (v_empresa_id, v_local_id) dentro
-- del `if v_rol in ('Encargado','Cajero/a','Churrero/a')`. La rama
-- `elsif v_empleado_id is not null` (usada por CUALQUIER rol con
-- empleado_id, incluido Camarero/a, para resolver su propio registro de
-- empleado) filtra por `k.empresa_id = v_empresa_id and k.local_id =
-- v_local_id`. Para un rol fuera de esas tres, esas variables quedan NULL,
-- la comparación es NULL (=desconocida) para toda fila, y `empleado` /
-- `empleadosFichaje` vuelven vacíos donde antes (función vigente en PROD,
-- sin acotar) sí se devolvía el propio empleado. Confirmado: Camarero/a con
-- empleado_id 'ea-4' recibe empleado=null / empleadosFichaje=[] con P01,
-- frente a su propio registro con la función hoy vigente en PROD.
--
-- Impacto funcional real: fuente.js (fichajesDelPropioEmpleado ->
-- empleadoDelContexto) usa contexto.empleado / el único elemento de
-- empleadosFichaje para que un empleado que NO es Encargado vea sus propios
-- fichajes. Sin este parche, cualquier rol fuera de las tres gestionadas
-- (Camarero/a es el caso real hoy) pierde esa función tras promover P01.
--
-- CORRECCIÓN MÍNIMA: se resuelve (v_empresa_id, v_local_id) también para
-- estos roles, en modo "best effort" y SIN exigir nada nuevo:
--   - Si el contexto SÍ es deducible (una membresía no-todos-locales, o el
--     propio registro en almacen_kv vía empleado_id), se usa para acotar la
--     búsqueda del empleado por empresa/local -- mejora de aislamiento
--     también para este camino, que P01 dejó sin acotar en el caso general.
--   - Si NO es deducible (0 candidatos, o >1 ambiguos), NO se lanza
--     excepción: se conserva el comportamiento previo (búsqueda por
--     empleado_id sin acotar por empresa/local), igual que la función hoy
--     vigente en PROD. Esto es deliberado: estos roles nunca pasaron por el
--     bloque de rechazo obligatorio de P01 y no deben empezar a hacerlo por
--     un efecto colateral de esta corrección -- evita romper a usuarios
--     legítimos cuyo contexto no se pueda deducir automáticamente.
--
-- No cambia nada para Encargado/Cajero/a/Churrero/a (su bloque obligatorio
-- de P01 no se toca) ni para Propietario. No aplicado a Supabase ni a
-- producción. Preparado en rama de trabajo para revisión/autorización.

create or replace function public.obtener_contexto_operativo(p_local_id text default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'auth', 'private', 'pg_temp'
as $function$
declare
  v_uid uuid := auth.uid();
  v_rol text;
  v_empleado_id text;
  v_empresa_id text;
  v_local_id text;
  v_candidatos int;
  v_empleado jsonb := null;
  v_empleados_fichaje jsonb := '[]'::jsonb;
  v_proveedores jsonb := '[]'::jsonb;
  v_fichas jsonb := '[]'::jsonb;
  v_cobros jsonb := '[]'::jsonb;
begin
  if v_uid is null then
    raise exception 'No autenticado' using errcode = '42501';
  end if;

  select p.rol, p.empleado_id::text
    into v_rol, v_empleado_id
  from public.perfiles p
  where p.user_id = v_uid
    and p.activo = true
  limit 1;

  if v_rol is null then
    raise exception 'Perfil no activo' using errcode = '42501';
  end if;

  if v_rol in ('Encargado', 'Cajero/a', 'Churrero/a') then

    if p_local_id is not null then
      select m.empresa_id into v_empresa_id
      from public.membresias_usuario m
      where m.user_id = v_uid
        and m.activo = true
        and (
          m.local_id = p_local_id
          or (m.todos_locales = true and exists (
                select 1 from public.locales l
                 where l.id = p_local_id and l.empresa_id = m.empresa_id and l.activo = true
              ))
        )
      limit 1;

      if v_empresa_id is not null then
        v_local_id := p_local_id;
      elsif v_empleado_id is not null then
        select k.empresa_id into v_empresa_id
        from public.almacen_kv k, lateral jsonb_array_elements(coalesce(k.value, '[]'::jsonb)) e
        where k.key = 'empleados'
          and k.local_id = p_local_id
          and e->>'id' = v_empleado_id
          and coalesce((e->>'activo')::boolean, true) = true
        limit 1;
        if v_empresa_id is not null then
          v_local_id := p_local_id;
        end if;
      end if;

      if v_empresa_id is null then
        raise exception 'Contexto no autorizado' using errcode = '42501';
      end if;
    else
      select count(*) into v_candidatos
      from (
        select m.empresa_id, m.local_id
        from public.membresias_usuario m
        where m.user_id = v_uid
          and m.activo = true
          and m.todos_locales = false
          and m.local_id is not null
        union
        select k.empresa_id, k.local_id
        from public.almacen_kv k, lateral jsonb_array_elements(coalesce(k.value, '[]'::jsonb)) e
        where k.key = 'empleados'
          and v_empleado_id is not null
          and e->>'id' = v_empleado_id
          and coalesce((e->>'activo')::boolean, true) = true
      ) candidatos;

      if v_candidatos = 0 then
        raise exception 'Contexto operativo no determinable' using errcode = '42501';
      elsif v_candidatos > 1 then
        raise exception 'Contexto operativo ambiguo: especifique p_local_id' using errcode = '42501';
      end if;

      select c.empresa_id, c.local_id into v_empresa_id, v_local_id
      from (
        select m.empresa_id, m.local_id
        from public.membresias_usuario m
        where m.user_id = v_uid
          and m.activo = true
          and m.todos_locales = false
          and m.local_id is not null
        union
        select k.empresa_id, k.local_id
        from public.almacen_kv k, lateral jsonb_array_elements(coalesce(k.value, '[]'::jsonb)) e
        where k.key = 'empleados'
          and v_empleado_id is not null
          and e->>'id' = v_empleado_id
          and coalesce((e->>'activo')::boolean, true) = true
      ) c;
    end if;

    if not exists (
      select 1
      from public.locales l
      join public.empresas e on e.id = l.empresa_id and e.activo = true
      where l.id = v_local_id and l.empresa_id = v_empresa_id and l.activo = true
    ) then
      raise exception 'Local inactivo o inexistente' using errcode = '42501';
    end if;

  elsif v_empleado_id is not null then
    -- Roles fuera del conjunto anterior (p.ej. Camarero/a): no se les exige
    -- contexto (no leen los listados por tenant más abajo). Si su contexto
    -- es deducible de forma INEQUÍVOCA (exactamente un candidato, mismo
    -- criterio que el bloque obligatorio) se usa para acotar su propio
    -- registro de empleado. Si hay cero candidatos o más de uno (ambiguo),
    -- v_empresa_id/v_local_id quedan en null a propósito: la búsqueda de
    -- empleado más abajo cae al comportamiento previo (sin acotar), igual
    -- que la función hoy vigente en PROD. Nunca se lanza excepción aquí.
    select count(*) into v_candidatos
    from (
      select m.empresa_id, m.local_id
      from public.membresias_usuario m
      where m.user_id = v_uid
        and m.activo = true
        and m.todos_locales = false
        and m.local_id is not null
      union
      select k.empresa_id, k.local_id
      from public.almacen_kv k, lateral jsonb_array_elements(coalesce(k.value, '[]'::jsonb)) e
      where k.key = 'empleados'
        and e->>'id' = v_empleado_id
        and coalesce((e->>'activo')::boolean, true) = true
    ) candidatos;

    if v_candidatos = 1 then
      select c.empresa_id, c.local_id into v_empresa_id, v_local_id
      from (
        select m.empresa_id, m.local_id
        from public.membresias_usuario m
        where m.user_id = v_uid
          and m.activo = true
          and m.todos_locales = false
          and m.local_id is not null
        union
        select k.empresa_id, k.local_id
        from public.almacen_kv k, lateral jsonb_array_elements(coalesce(k.value, '[]'::jsonb)) e
        where k.key = 'empleados'
          and e->>'id' = v_empleado_id
          and coalesce((e->>'activo')::boolean, true) = true
      ) c;
    end if;
  end if;

  if v_rol = 'Encargado' then
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', e->>'id',
          'nombre', e->>'nombre',
          'puesto', e->>'puesto',
          'rol', e->>'rol',
          'activo', coalesce((e->>'activo')::boolean, true)
        ) order by e->>'nombre'
      ),
      '[]'::jsonb
    )
    into v_empleados_fichaje
    from public.almacen_kv k,
         lateral jsonb_array_elements(coalesce(k.value, '[]'::jsonb)) e
    where k.key = 'empleados'
      and k.empresa_id = v_empresa_id
      and k.local_id = v_local_id
      and coalesce((e->>'activo')::boolean, true) = true;
  elsif v_empleado_id is not null then
    select jsonb_build_object(
      'id', e->>'id',
      'nombre', e->>'nombre',
      'puesto', e->>'puesto',
      'rol', coalesce(e->>'rol', v_rol),
      'activo', coalesce((e->>'activo')::boolean, true)
    )
    into v_empleado
    from public.almacen_kv k,
         lateral jsonb_array_elements(coalesce(k.value, '[]'::jsonb)) e
    where k.key = 'empleados'
      and e->>'id' = v_empleado_id
      and (v_empresa_id is null or (k.empresa_id = v_empresa_id and k.local_id = v_local_id))
    limit 1;
    if v_empleado is not null then
      v_empleados_fichaje := jsonb_build_array(v_empleado);
    end if;
  end if;

  if v_rol in ('Cajero/a', 'Churrero/a') then
    select coalesce(
      jsonb_agg(jsonb_build_object('id', p->>'id', 'nombre', p->>'nombre') order by p->>'nombre'),
      '[]'::jsonb
    )
    into v_proveedores
    from public.almacen_kv k,
         lateral jsonb_array_elements(coalesce(k.value, '[]'::jsonb)) p
    where k.key = 'proveedores'
      and k.empresa_id = v_empresa_id
      and k.local_id = v_local_id;
  end if;

  if v_rol = 'Churrero/a' then
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', f->>'id',
          'nombre', f->>'nombre',
          'rendimiento', f->'rendimiento',
          'productoVinculadoId', f->>'productoVinculadoId',
          'componentes', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'productoId', c->>'productoId',
                'cantidad', c->'cantidad',
                'nombre', c->>'nombre',
                'unidad', c->>'unidad'
              )
            )
            from jsonb_array_elements(coalesce(f->'componentes', '[]'::jsonb)) c
          ), '[]'::jsonb),
          'empaque', f->'empaque'
        ) order by f->>'nombre'
      ),
      '[]'::jsonb
    )
    into v_fichas
    from public.almacen_kv k,
         lateral jsonb_array_elements(coalesce(k.value, '[]'::jsonb)) f
    where k.key = 'fichasCosto'
      and k.empresa_id = v_empresa_id
      and k.local_id = v_local_id;
  end if;

  if v_rol = 'Cajero/a' then
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'fecha', c->>'fecha',
          'medioPago', coalesce(c->>'medioPago', 'Efectivo'),
          'importe', c->'importe'
        ) order by c->>'fecha'
      ),
      '[]'::jsonb
    )
    into v_cobros
    from public.almacen_kv k,
         lateral jsonb_array_elements(coalesce(k.value, '[]'::jsonb)) e,
         lateral jsonb_array_elements(coalesce(e->'cobros', '[]'::jsonb)) c
    where k.key = 'encargos'
      and k.empresa_id = v_empresa_id
      and k.local_id = v_local_id;
  end if;

  return jsonb_build_object(
    'rol', v_rol,
    'empresaId', v_empresa_id,
    'localId', v_local_id,
    'empleado', v_empleado,
    'empleadosFichaje', v_empleados_fichaje,
    'proveedores', v_proveedores,
    'fichasProduccion', v_fichas,
    'cobrosEncargos', v_cobros
  );
end;
$function$;

revoke all on function public.obtener_contexto_operativo(text) from public, anon;
grant execute on function public.obtener_contexto_operativo(text) to authenticated;
