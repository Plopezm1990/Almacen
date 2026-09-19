-- PM33 P01: obtener_contexto_operativo() deja de leer almacen_kv sin acotar
-- por empresa/local.
--
-- CAUSA RAÍZ (hallazgo R10, confirmado por lectura de código en producción):
-- las cuatro lecturas de almacen_kv (empleados, proveedores, fichasCosto,
-- encargos) no filtraban por empresa_id/local_id pese a que la tabla los
-- tiene como columnas propias. Cualquier authenticated con perfil activo y
-- rol Encargado/Cajero/a/Churrero/a en CUALQUIER empresa recibía datos de
-- TODAS las empresas/locales que tuvieran esa misma clave en almacen_kv.
--
-- La firma pública se conserva en su forma de uso: el único call site real
-- (fuente.js, función obtenerContexto) invoca
-- supabase.rpc("obtener_contexto_operativo") sin argumentos y sigue
-- funcionando idéntico mientras el llamante tenga un único contexto
-- resoluble. Se añade un parámetro OPCIONAL, p_local_id (default null),
-- imprescindible para el caso "empleado con más de un local, pide uno
-- concreto": una función sin argumentos no puede distinguir cuál sin él.
--
-- La resolución de contexto (y su posible rechazo) solo se activa para los
-- tres roles que de verdad leen almacen_kv (Encargado, Cajero/a, Churrero/a).
-- Cualquier otro rol conserva el comportamiento exacto de antes.
--
-- IMPORTANTE sobre el despliegue: create or replace con una lista de
-- parámetros distinta NO sustituye la función existente, crea una SEGUNDA
-- sobrecarga. Verificado en Postgres real durante la preparación de este
-- parche: sin el DROP siguiente, obtener_contexto_operativo() (0 args, la
-- versión con el defecto) queda coexistiendo con
-- obtener_contexto_operativo(text), y Postgres prefiere la coincidencia
-- EXACTA de aridad sobre la que usa el valor por defecto. Como el único call
-- site real invoca la RPC con cero argumentos, sin este DROP el parche sería
-- un no-op: seguiría ejecutándose la versión defectuosa en el caso de uso
-- real.
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

    -- ----------------------------------------------------------------------
    -- Determinación inequívoca del contexto (empresa_id, local_id).
    --
    -- Dos fuentes posibles, nunca combinadas silenciosamente en una sola
    -- fila:
    --   (a) membresía relacional propia y no-todos-locales (modelo PM29+);
    --   (b) el propio registro de empleado dentro de almacen_kv, localizado
    --       por perfiles.empleado_id (modelo heredado, el que usan hoy
    --       Cajero/a y Churrero/a en producción).
    -- ----------------------------------------------------------------------

    if p_local_id is not null then
      -- Contexto pedido explícitamente: debe pertenecer al llamante por (a) o (b).
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
      -- Sin contexto pedido: exige que exista EXACTAMENTE un candidato entre
      -- (a) y (b) combinados. Cero -> rechazo. Más de uno -> ambiguo, rechazo
      -- (nunca se elige "el primero" ni se mezclan datos de varios).
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

    -- El local resuelto tiene que seguir activo, y su empresa también: no se
    -- sirve contexto de una empresa o local dado de baja aunque en algún
    -- momento el usuario perteneciera a él.
    if not exists (
      select 1
      from public.locales l
      join public.empresas e on e.id = l.empresa_id and e.activo = true
      where l.id = v_local_id and l.empresa_id = v_empresa_id and l.activo = true
    ) then
      raise exception 'Local inactivo o inexistente' using errcode = '42501';
    end if;

  end if;

  -- --------------------------------------------------------------------
  -- A partir de aquí, todas las lecturas de almacen_kv quedan acotadas al
  -- (v_empresa_id, v_local_id) ya autorizado. Para los roles que no entran
  -- en el bloque anterior, v_empresa_id/v_local_id siguen null y ninguna de
  -- las siguientes ramas puede ejecutarse (los IF de rol ya lo garantizan).
  -- --------------------------------------------------------------------

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
      and k.empresa_id = v_empresa_id
      and k.local_id = v_local_id
      and e->>'id' = v_empleado_id
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
