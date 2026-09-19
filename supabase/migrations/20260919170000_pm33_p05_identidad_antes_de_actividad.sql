-- PM33 P04: corrige dos defectos de identidad/autorización encontrados en
-- una revisión independiente sobre P03 (rama claude/pm33-p03-obtener-contexto-operativo,
-- commit e7491d5). Reproducidos con Postgres real antes de escribir este
-- parche -- ver tests/pm33/db/p04-*.mjs.
--
-- ===========================================================================
-- DEFECTO 1 -- "el parámetro del cliente selecciona un local, pero no
-- demuestra autorización" (bloque obligatorio Y Camarero/a)
-- ===========================================================================
-- P01/P02/P03 autorizaban la fuente (b) -- el propio empleado_id en
-- almacen_kv -- contra un p_local_id explícito comprobando únicamente "¿hay
-- una coincidencia de este empleado_id EN ESE local?". Eso no demuestra
-- nada: si el mismo empleado_id existe en más de una empresa (colisión, no
-- descartada en ningún momento de esta revisión), el cliente podía obtener
-- el contexto de CUALQUIERA de ellas con solo pedirlo por su id de local.
-- Reproducido: camareroColision (empleado_id 'dup-9', SIN membresía,
-- 'dup-9' existe en emp-A/loc-A y en emp-B/loc-B) obtenía el empleado de A
-- pidiendo 'loc-A' y el de B pidiendo 'loc-B' -- el servidor nunca
-- verificaba pertenencia real, solo "existencia en ese local concreto".
--
-- CORRECCIÓN: la fuente (b) se resuelve UNA sola vez, de forma GLOBAL (sin
-- filtrar por el local pedido): se cuentan cuántos (empresa_id, local_id)
-- DISTINTOS tiene ese empleado_id en almacen_kv. Si no es EXACTAMENTE uno,
-- la fuente (b) quedan inutilizable por completo para esta llamada --  no
-- importa qué local se pida explícitamente, ninguno se autoriza por esta
-- vía. Si es exactamente uno, ese es el ÚNICO par válido; un p_local_id
-- explícito solo se acepta si COINCIDE con él (nunca "existe alguna
-- coincidencia ahí").  Aplicado igual en el bloque obligatorio
-- (Encargado/Cajero/a/Churrero/a) y en el de autoservicio (Camarero/a):
-- "conservar el bloque anterior [de los tres roles] no demuestra que sea
-- seguro" -- también tenía el mismo defecto y también se corrige aquí.
--
-- ===========================================================================
-- DEFECTO 2 -- una membresía desactivada no revoca el acceso heredado
-- ===========================================================================
-- Reproducido: camareroActivo (membresía id=20, empresa_id=emp-A,
-- local_id=loc-A) sigue obteniendo su contexto de loc-A después de
-- desactivar esa membresía (`update membresias_usuario set activo=false
-- where id=20`), porque su empleado_id sigue existiendo, sin cambios, en
-- almacen_kv -- la fuente (b) nunca se enteraba de la baja explícita.
--
-- CORRECCIÓN: antes de aceptar la fuente (b) para un (empresa_id,
-- local_id) resuelto, se comprueba si existe una fila de membresía DE ESE
-- MISMO usuario, para esa MISMA empresa (con ese local o con
-- todos_locales), marcada explícitamente `activo = false`. Si existe, la
-- vía heredada queda bloqueada para ese par -- una revocación explícita
-- tiene prioridad sobre el legado, siempre. Si NO existe ninguna fila de
-- membresía para ese usuario+empresa (nunca se migró al modelo de
-- membresías -- el caso real de Cajero/a y Churrero/a en producción hoy),
-- la vía heredada sigue funcionando exactamente igual que antes: esto no
-- es un requisito nuevo de tener membresía, es solo que una baja
-- *explícita* no puede eludirse por una vía más antigua.
--
-- Ninguno de los dos defectos afectaba a la fuente (a) (membresías
-- activas): ya comprobaba pertenencia real. Ninguno afectaba tampoco al
-- camino SIN p_local_id (ya usaba conteo de candidatos distintos a nivel
-- global): sigue igual, ahora reutilizando la misma resolución de fuente
-- (b), ya con la comprobación de revocación aplicada.
--
-- No aplicado a Supabase ni a producción. Dependencias/grants: sin cambios
-- respecto de P03 (ver migracion_p03_desde_prod.sql; el mismo
-- razonamiento aplica sin modificaciones).

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
  -- Resolución única de la fuente (b), calculada una sola vez y reutilizada
  -- en ambos bloques (obligatorio y autoservicio) y en ambos caminos (con
  -- y sin p_local_id). v_empresa_kv/v_local_kv quedan NULL salvo que el
  -- empleado_id resuelva de forma inequívoca a nivel global Y no exista una
  -- revocación explícita para ese par.
  v_empresa_kv text;
  v_local_kv text;
  v_kv_count int;
  v_kv_activo boolean;
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

  -- ------------------------------------------------------------------
  -- Resolución de la fuente (b), común a los dos bloques de abajo.
  -- IMPORTANTE: el criterio de "activo" del propio registro de empleado
  -- en almacen_kv se mantiene DISTINTO para cada bloque, igual que en
  -- P01/P02/P03 (el obligatorio lo exige; Camarero/a no, para no romper
  -- el caso real de T14) -- por eso se calcula dos veces, no una.
  -- ------------------------------------------------------------------

  if v_empleado_id is not null and v_rol in ('Encargado', 'Cajero/a', 'Churrero/a') then
    -- IDENTIDAD PRIMERO, ACTIVIDAD DESPUÉS (corregido en esta revisión):
    -- contar candidatos filtrando por "activo" ANTES de establecer si el
    -- empleado_id es único puede ocultar una colisión real. Ejemplo
    -- reproducido: el mismo empleado_id existe en almacen_kv de emp-A
    -- (registro marcado inactivo) y de emp-B (registro activo). Filtrar
    -- por activo antes de contar deja un único candidato "visible"
    -- (el de B) aunque la identidad sea genuinamente ambigua -- y una
    -- coincidencia activa en OTRA empresa no demuestra pertenencia a
    -- ella. Se cuenta primero sin filtrar por activo, a nivel global:
    select count(distinct (k.empresa_id, k.local_id)) into v_kv_count
    from public.almacen_kv k, lateral jsonb_array_elements(coalesce(k.value, '[]'::jsonb)) e
    where k.key = 'empleados'
      and e->>'id' = v_empleado_id;

    if v_kv_count = 1 then
      -- Identidad inequívoca a nivel global. AHORA, y solo ahora, se
      -- mira si ese único registro está activo -- si no lo está, la vía
      -- heredada no lo usa como fuente de autorización (igual que el
      -- diseño original para el bloque obligatorio), pero la razón nunca
      -- es "había otra coincidencia en otra empresa": es que el único
      -- candidato real está inactivo.
      select k.empresa_id, k.local_id, coalesce((e->>'activo')::boolean, true)
        into v_empresa_kv, v_local_kv, v_kv_activo
      from public.almacen_kv k, lateral jsonb_array_elements(coalesce(k.value, '[]'::jsonb)) e
      where k.key = 'empleados'
        and e->>'id' = v_empleado_id
      limit 1; -- seguro: v_kv_count=1 garantiza una única fila en este conjunto

      if not v_kv_activo then
        v_empresa_kv := null;
        v_local_kv := null;
      elsif exists (
        select 1 from public.membresias_usuario m
        where m.user_id = v_uid
          and m.activo = false
          and m.empresa_id = v_empresa_kv
          and (m.local_id = v_local_kv or m.todos_locales = true)
      ) then
        v_empresa_kv := null;
        v_local_kv := null;
      end if;
    end if;
  elsif v_empleado_id is not null then
    select count(distinct (k.empresa_id, k.local_id)) into v_kv_count
    from public.almacen_kv k, lateral jsonb_array_elements(coalesce(k.value, '[]'::jsonb)) e
    where k.key = 'empleados'
      and e->>'id' = v_empleado_id;

    if v_kv_count = 1 then
      select k.empresa_id, k.local_id into v_empresa_kv, v_local_kv
      from public.almacen_kv k, lateral jsonb_array_elements(coalesce(k.value, '[]'::jsonb)) e
      where k.key = 'empleados'
        and e->>'id' = v_empleado_id
      limit 1;

      if exists (
        select 1 from public.membresias_usuario m
        where m.user_id = v_uid
          and m.activo = false
          and m.empresa_id = v_empresa_kv
          and (m.local_id = v_local_kv or m.todos_locales = true)
      ) then
        v_empresa_kv := null;
        v_local_kv := null;
      end if;
    end if;
  end if;

  if v_rol in ('Encargado', 'Cajero/a', 'Churrero/a') then

    -- ------------------------------------------------------------------
    -- Bloque obligatorio. Rechaza explícitamente cuando el contexto no es
    -- deducible o el local pedido no está autorizado.
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
      elsif v_empresa_kv is not null and v_local_kv = p_local_id then
        -- El local pedido coincide con el ÚNICO par que la fuente (b)
        -- resuelve a nivel global (no basta con que exista una
        -- coincidencia local, ver DEFECTO 1 arriba).
        v_empresa_id := v_empresa_kv;
        v_local_id := p_local_id;
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
        select v_empresa_kv, v_local_kv
        where v_empresa_kv is not null
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
        select v_empresa_kv, v_local_kv
        where v_empresa_kv is not null
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
    -- Roles fuera del bloque obligatorio (Camarero/a). No se les exige
    -- contexto -- nunca una excepción en esta rama -- pero nunca se lee un
    -- dato sin acotar por (empresa_id, local_id) ya autorizado.
    -- ------------------------------------------------------------------

    if p_local_id is not null then
      select count(*) into v_coincidencias
      from public.membresias_usuario m
      where m.user_id = v_uid
        and m.activo = true
        and (
          m.local_id = p_local_id
          or (m.todos_locales = true and exists (
                select 1 from public.locales l
                 where l.id = p_local_id and l.empresa_id = m.empresa_id and l.activo = true
              ))
        );

      if v_coincidencias > 0 then
        select l.empresa_id into v_empresa_id
        from public.locales l
        where l.id = p_local_id;
        if v_empresa_id is not null then
          v_local_id := p_local_id;
        end if;
      elsif v_empresa_kv is not null and v_local_kv = p_local_id then
        v_empresa_id := v_empresa_kv;
        v_local_id := p_local_id;
      end if;
      -- Ni membresía ni fuente (b) respaldan ese local exacto -> quedan
      -- null: local ajeno, no autorizado. Sin excepción, sin dato.
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
        select v_empresa_kv, v_local_kv
        where v_empresa_kv is not null
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
          select v_empresa_kv, v_local_kv
          where v_empresa_kv is not null
        ) c;
      end if;
      -- v_candidatos = 0 o > 1 -> quedan null: no deducible o ambiguo.
    end if;

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
