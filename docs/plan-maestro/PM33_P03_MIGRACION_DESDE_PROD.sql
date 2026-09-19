-- PM33 P03 — Migración completa desde el estado real de PROD.
--
-- Probado con Postgres real (16.13) partiendo de la función de 0
-- argumentos EXACTA hoy vigente en PROD (capturada por pg_get_functiondef
-- el 19/09/2026, reproducida en prod_original_function.sql), no solo
-- sobre una base vacía. Resultado íntegro del ensayo: ver HALLAZGOS_P02.md
-- sección "Migración P03 -- transición desde PROD real".
--
-- Dependencias/permisos verificados contra PROD real el 19/09/2026 (solo
-- lectura, sin aplicar nada): única sobrecarga existente (0 args), grants
-- authenticated=EXECUTE / anon y public sin permiso, ninguna otra
-- función/vista/trigger de `public` referencia el nombre en su cuerpo,
-- pg_depend vacío. La migración es autocontenida.
--
-- ===========================================================================
-- PREFLIGHT (solo lectura -- ejecutar y revisar ANTES de aplicar nada)
-- ===========================================================================
-- Si el resultado de estas dos consultas no coincide con lo documentado
-- arriba, DETENERSE: el estado real no es el asumido.

select p.oid::regprocedure as firma, p.pronargs
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'obtener_contexto_operativo'
order by p.pronargs;

select classid::regclass::text as clase, objid, deptype
from pg_depend
where refobjid in (
  select p.oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'obtener_contexto_operativo'
);

-- ===========================================================================
-- APPLY -- una única transacción. DDL transaccional: si algo falla, se
-- revierte todo el bloque, no hay estado intermedio posible.
-- ===========================================================================
begin;

-- PM33 P03: corrige un defecto de diseño de seguridad introducido por P02
-- y devuelto a revisión antes de solicitar autorización de aplicación.
--
-- CAMBIOS SOBRE P02 (ver HALLAZGOS_P02.md para el detalle de P01->P02):
--
-- 1. P02 introducía, para roles fuera de Encargado/Cajero/a/Churrero/a
--    (Camarero/a es el caso real hoy), un fallback SIN ACOTAR por
--    empresa/local cuando el contexto no era deducible de forma
--    inequívoca: `(v_empresa_id is null or (k.empresa_id = v_empresa_id
--    and k.local_id = v_local_id))`. Eso reintroduce, para la búsqueda de
--    un único empleado, el mismo patrón de fondo que R10: si el mismo
--    `empleado_id` existe en almacen_kv de MÁS de una empresa (colisión de
--    id entre tenants -- no descartada, solo no observada hoy en PROD),
--    P02 podía devolver el registro de OTRA empresa. P03 elimina ese
--    fallback por completo: si el contexto no resuelve de forma
--    inequívoca, no se lee ningún registro de empleado. Ningún camino de
--    esta función vuelve a hacer una lectura de `almacen_kv` sin acotar
--    por `(empresa_id, local_id)` ya autorizado.
-- 2. Se retira todo uso de `limit 1`/`limit 2` para resolver una
--    ambigüedad de identidad. La resolución de contexto usa conteo
--    explícito (0 / 1 / >1) y solo lee datos cuando el conteo es
--    exactamente 1 -- igual que ya hacía el bloque obligatorio de P01/P02,
--    extendido ahora también al camino de autoservicio de empleado. La
--    lectura final del propio registro de empleado también cuenta
--    coincidencias dentro del `(empresa_id, local_id)` ya resuelto antes
--    de leer: si hubiera más de una fila con el mismo id dentro del mismo
--    local (dato corrupto, no debería ocurrir por diseño de la aplicación
--    pero no se asume), tampoco se adivina cuál servir.
-- 3. Se acota también por `p_local_id` para estos roles cuando el llamante
--    lo pasa explícitamente (antes se ignoraba fuera del bloque
--    obligatorio), con el mismo criterio de autorización que el bloque
--    obligatorio: membresía activa no-todos-locales que cubra ese local, o
--    el propio registro de empleado en ese local. Sin membresía/registro
--    que lo respalde, no se sirve dato -- nunca "el que se pidió, porque
--    se pidió".
-- 4. Se comprueba que el local/empresa resuelto para estos roles sigue
--    activo (misma comprobación que ya tenía el bloque obligatorio); si no
--    lo está, se trata como contexto no resuelto.
--
-- Ninguno de estos cambios toca el bloque obligatorio de
-- Encargado/Cajero/a/Churrero/a (idéntico a P01/P02) ni exige contexto a
-- los roles que antes no lo tenían: simplemente, cuando ese contexto no es
-- deducible de forma segura, esos roles reciben `empleado: null` /
-- `empleadosFichaje: []` en vez de una excepción -- igual que P02 -- pero
-- NUNCA un registro de otra empresa/local.
--
-- 5. CRÍTICO, encontrado en esta revisión: P02, tal como quedó redactado,
--    NO incluía el `drop function if exists
--    public.obtener_contexto_operativo();` que sí llevaba P01. Aplicado
--    directamente sobre el estado real de PROD (que hoy solo tiene la
--    sobrecarga de 0 argumentos, confirmado por consulta a pg_proc el
--    19/09/2026), `create or replace function
--    obtener_contexto_operativo(p_local_id text default null)` habría
--    creado una SEGUNDA sobrecarga sin retirar la primera. El único call
--    site real (fuente.js) invoca sin argumentos, y Postgres prefiere la
--    coincidencia exacta de aridad (0 argumentos, la versión defectuosa)
--    sobre la de 1 argumento con valor por defecto: aplicar P02 tal cual
--    habría sido un no-op en producción real. Se restaura el `drop`.
--
-- Confirmado por consulta a PROD el 19/09/2026 (ver
-- migracion_p03_desde_prod.sql): ninguna otra función, vista o trigger de
-- `public` referencia `obtener_contexto_operativo` en su cuerpo ni depende
-- de ella (pg_depend vacío) -- la migración es autocontenida.

drop function if exists public.obtener_contexto_operativo();

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
  v_coincidencias int;
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

    -- ------------------------------------------------------------------
    -- Bloque obligatorio: idéntico a P01/P02. Rechaza explícitamente
    -- (excepción) cuando el contexto no es deducible o el local pedido no
    -- está autorizado. No se toca en P03.
    -- ------------------------------------------------------------------

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
    -- ------------------------------------------------------------------
    -- P03: roles fuera del bloque obligatorio (Camarero/a es el caso real
    -- hoy). No se les exige contexto -- nunca se lanza excepción en esta
    -- rama -- pero si NO se resuelve de forma inequívoca y segura, no se
    -- lee ningún dato: v_empresa_id/v_local_id quedan en null y la
    -- lectura de más abajo, al estar siempre acotada por ellos, no
    -- devuelve nada. Sin fallback sin acotar.
    -- ------------------------------------------------------------------

    if p_local_id is not null then
      -- Local pedido explícitamente: debe estar respaldado por membresía
      -- propia o por el propio registro de empleado en ESE local. Mismo
      -- criterio de autorización que el bloque obligatorio, sin excepción
      -- si no se cumple (rol no gestionado: silencio, no rechazo).
      select count(*) into v_coincidencias
      from (
        select 1
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
        union all
        select 1
        from public.almacen_kv k, lateral jsonb_array_elements(coalesce(k.value, '[]'::jsonb)) e
        where k.key = 'empleados'
          and k.local_id = p_local_id
          and e->>'id' = v_empleado_id
      ) autorizacion;
      -- Nota: a diferencia del bloque obligatorio, aquí NO se exige que el
      -- propio registro de empleado esté "activo" para autoservirse su
      -- contexto -- igual que la función hoy vigente en PROD y que P02,
      -- que tampoco lo exigían. El caso real (T14: Camarero/a con
      -- empleado_id apuntando a un registro marcado activo=false) debe
      -- seguir funcionando sin regresión; ese campo no es lo que decide
      -- autorización aquí, solo delimita qué se muestra en los listados
      -- agregados de otros roles (Encargado).

      if v_coincidencias > 0 then
        select l.empresa_id into v_empresa_id
        from public.locales l
        where l.id = p_local_id;
        if v_empresa_id is not null then
          v_local_id := p_local_id;
        end if;
      end if;
      -- v_coincidencias = 0 -> v_empresa_id/v_local_id quedan null: local
      -- ajeno, no autorizado. Sin excepción, sin dato.
    else
      -- Sin local pedido: exige exactamente un candidato, igual criterio
      -- de conteo que el bloque obligatorio (nunca "el primero").
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
        ) c;
      end if;
      -- v_candidatos = 0 o > 1 -> quedan null: no deducible o ambiguo. Sin
      -- excepción, sin dato (nunca se adivina ni se mezcla).
    end if;

    -- El local/empresa resuelto, si lo hay, tiene que seguir activo. Si no
    -- lo está, se trata exactamente igual que "no resuelto": sin dato.
    if v_empresa_id is not null and not exists (
      select 1
      from public.locales l
      join public.empresas e on e.id = l.empresa_id and e.activo = true
      where l.id = v_local_id and l.empresa_id = v_empresa_id and l.activo = true
    ) then
      v_empresa_id := null;
      v_local_id := null;
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
  elsif v_empleado_id is not null and v_empresa_id is not null then
    -- P03: SIEMPRE acotado por (v_empresa_id, v_local_id) ya autorizado
    -- (mandatorio o resuelto de forma inequívoca más arriba). Nunca hay
    -- una rama que lea sin ese filtro. Se cuenta antes de leer para no
    -- usar LIMIT 1 sobre una posible ambigüedad de datos dentro del mismo
    -- local (no debería ocurrir por diseño de la aplicación, pero no se
    -- asume: si ocurriera, se sirve null, no una fila arbitraria).
    select count(*) into v_coincidencias
    from public.almacen_kv k,
         lateral jsonb_array_elements(coalesce(k.value, '[]'::jsonb)) e
    where k.key = 'empleados'
      and k.empresa_id = v_empresa_id
      and k.local_id = v_local_id
      and e->>'id' = v_empleado_id;

    if v_coincidencias = 1 then
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
        and k.empresa_id = v_empresa_id
        and k.local_id = v_local_id
        and e->>'id' = v_empleado_id;
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

commit;

-- ===========================================================================
-- POSTFLIGHT (solo lectura -- ejecutar inmediatamente después del commit)
-- ===========================================================================

-- Debe quedar EXACTAMENTE una sobrecarga, con 1 argumento (p_local_id).
-- Si aparece más de una fila, o pronargs<>1, la versión vulnerable de 0
-- argumentos sigue siendo alcanzable: NO CONTINUAR, investigar.
select p.oid::regprocedure as firma, p.pronargs, pg_get_function_arguments(p.oid) as args
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'obtener_contexto_operativo';

-- Grants: authenticated debe poder ejecutar; anon y public, no.
select p.oid::regprocedure::text as firma,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_execute,
  has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute,
  has_function_privilege('public', p.oid, 'EXECUTE') as public_execute
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'obtener_contexto_operativo';

-- Prueba funcional de humo: SOLO en un entorno con datos señuelo conocidos
-- (fixtures.sql), NUNCA con datos reales. En PROD, este paso se sustituye
-- por una prueba de humo manual con un usuario de prueba real autenticado
-- vía la aplicación -- no fabricado aquí.

-- ===========================================================================
-- ROLLBACK -- solo como medida de emergencia: reintroduce el defecto R10.
-- Restaura EXACTAMENTE el cuerpo capturado de PROD el 19/09/2026 y retira
-- la sobrecarga nueva.
-- ===========================================================================
-- begin;
--   CREATE OR REPLACE FUNCTION public.obtener_contexto_operativo()
--    RETURNS jsonb
--    LANGUAGE plpgsql
--    SECURITY DEFINER
--    SET search_path TO 'public'
--   AS $function$
--   declare
--     v_uid uuid := auth.uid();
--     v_rol text;
--     v_empleado_id text;
--     v_empleado jsonb := null;
--     v_empleados_fichaje jsonb := '[]'::jsonb;
--     v_proveedores jsonb := '[]'::jsonb;
--     v_fichas jsonb := '[]'::jsonb;
--     v_cobros jsonb := '[]'::jsonb;
--   begin
--     if v_uid is null then
--       raise exception 'No autenticado' using errcode = '42501';
--     end if;
--   
--     select p.rol, p.empleado_id::text
--       into v_rol, v_empleado_id
--     from public.perfiles p
--     where p.user_id = v_uid
--       and p.activo = true
--     limit 1;
--   
--     if v_rol is null then
--       raise exception 'Perfil no activo' using errcode = '42501';
--     end if;
--   
--     if v_rol = 'Encargado' then
--       select coalesce(
--         jsonb_agg(
--           jsonb_build_object(
--             'id', e->>'id',
--             'nombre', e->>'nombre',
--             'puesto', e->>'puesto',
--             'rol', e->>'rol',
--             'activo', coalesce((e->>'activo')::boolean, true)
--           ) order by e->>'nombre'
--         ),
--         '[]'::jsonb
--       )
--       into v_empleados_fichaje
--       from public.almacen_kv k,
--            lateral jsonb_array_elements(coalesce(k.value, '[]'::jsonb)) e
--       where k.key = 'empleados'
--         and coalesce((e->>'activo')::boolean, true) = true;
--     elsif v_empleado_id is not null then
--       select jsonb_build_object(
--         'id', e->>'id',
--         'nombre', e->>'nombre',
--         'puesto', e->>'puesto',
--         'rol', coalesce(e->>'rol', v_rol),
--         'activo', coalesce((e->>'activo')::boolean, true)
--       )
--       into v_empleado
--       from public.almacen_kv k,
--            lateral jsonb_array_elements(coalesce(k.value, '[]'::jsonb)) e
--       where k.key = 'empleados'
--         and e->>'id' = v_empleado_id
--       limit 1;
--       if v_empleado is not null then
--         v_empleados_fichaje := jsonb_build_array(v_empleado);
--       end if;
--     end if;
--   
--     if v_rol in ('Cajero/a', 'Churrero/a') then
--       select coalesce(
--         jsonb_agg(jsonb_build_object('id', p->>'id', 'nombre', p->>'nombre') order by p->>'nombre'),
--         '[]'::jsonb
--       )
--       into v_proveedores
--       from public.almacen_kv k,
--            lateral jsonb_array_elements(coalesce(k.value, '[]'::jsonb)) p
--       where k.key = 'proveedores';
--     end if;
--   
--     if v_rol = 'Churrero/a' then
--       select coalesce(
--         jsonb_agg(
--           jsonb_build_object(
--             'id', f->>'id',
--             'nombre', f->>'nombre',
--             'rendimiento', f->'rendimiento',
--             'productoVinculadoId', f->>'productoVinculadoId',
--             'componentes', coalesce((
--               select jsonb_agg(
--                 jsonb_build_object(
--                   'productoId', c->>'productoId',
--                   'cantidad', c->'cantidad',
--                   'nombre', c->>'nombre',
--                   'unidad', c->>'unidad'
--                 )
--               )
--               from jsonb_array_elements(coalesce(f->'componentes', '[]'::jsonb)) c
--             ), '[]'::jsonb),
--             'empaque', f->'empaque'
--           ) order by f->>'nombre'
--         ),
--         '[]'::jsonb
--       )
--       into v_fichas
--       from public.almacen_kv k,
--            lateral jsonb_array_elements(coalesce(k.value, '[]'::jsonb)) f
--       where k.key = 'fichasCosto';
--     end if;
--   
--     if v_rol = 'Cajero/a' then
--       select coalesce(
--         jsonb_agg(
--           jsonb_build_object(
--             'fecha', c->>'fecha',
--             'medioPago', coalesce(c->>'medioPago', 'Efectivo'),
--             'importe', c->'importe'
--           ) order by c->>'fecha'
--         ),
--         '[]'::jsonb
--       )
--       into v_cobros
--       from public.almacen_kv k,
--            lateral jsonb_array_elements(coalesce(k.value, '[]'::jsonb)) e,
--            lateral jsonb_array_elements(coalesce(e->'cobros', '[]'::jsonb)) c
--       where k.key = 'encargos';
--     end if;
--   
--     return jsonb_build_object(
--       'rol', v_rol,
--       'empleado', v_empleado,
--       'empleadosFichaje', v_empleados_fichaje,
--       'proveedores', v_proveedores,
--       'fichasProduccion', v_fichas,
--       'cobrosEncargos', v_cobros
--     );
--   end;
--   $function$;
--   drop function if exists public.obtener_contexto_operativo(text);
--   revoke all on function public.obtener_contexto_operativo() from public, anon;
--   grant execute on function public.obtener_contexto_operativo() to authenticated;
-- commit;
--
-- Postflight de rollback: repetir la consulta de sobrecargas -- debe
-- volver a mostrar EXACTAMENTE una, con pronargs=0.
