-- N-02 — Reconciliar definiciones desplegadas con la fuente versionada.
--
-- QA y producción tenían procedencias distintas para estas funciones. La
-- definición canónica se extrae de las migraciones ya versionadas en release:
--   A-01: private.la_usuario_activo()
--   PM33 P05: public.obtener_contexto_operativo(text)
--   owner bootstrap: public.bootstrap_owner_instalacion(text, text)
--
-- Esta migración no aplica ni repara datos. Solo vuelve a declarar las tres
-- funciones con el texto versionado y restablece sus ACL explícitas. La guarda
-- manual de QA no se incorpora: no pertenece a release ni a producción.

begin;
set local lock_timeout = '10s';
set local statement_timeout = '60s';

do $preflight$
declare
  v_falta text[] := array[]::text[];
begin
  if to_regclass('public.perfiles') is null then v_falta := v_falta || 'public.perfiles'; end if;
  if to_regclass('public.empleados') is null then v_falta := v_falta || 'public.empleados'; end if;
  if to_regclass('public.membresias_usuario') is null then v_falta := v_falta || 'public.membresias_usuario'; end if;
  if to_regclass('public.empresas') is null then v_falta := v_falta || 'public.empresas'; end if;
  if to_regclass('public.locales') is null then v_falta := v_falta || 'public.locales'; end if;
  if to_regclass('public.almacen_kv') is null then v_falta := v_falta || 'public.almacen_kv'; end if;
  if to_regclass('private.la_instalacion_estado') is null then v_falta := v_falta || 'private.la_instalacion_estado'; end if;
  if array_length(v_falta, 1) is not null then
    raise exception 'n02_preflight_faltan_objetos: %', array_to_string(v_falta, ', ');
  end if;
end
$preflight$;

-- Canonical A-01 definition, extracted from the versioned migration.
create or replace function private.la_usuario_activo()
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select (select auth.uid()) is not null
     and exists(
       select 1 from public.membresias_usuario m
        where m.user_id=(select auth.uid()) and m.activo=true
     )
     and not exists(
       select 1 from public.perfiles p
        where p.user_id=(select auth.uid()) and p.activo=false
     )
     and not exists(
       select 1
         from public.perfiles p
         join public.empleados e on e.id = p.empleado_id
        where p.user_id=(select auth.uid()) and e.estado is distinct from 'activo'
     );
$function$;

revoke all on function private.la_usuario_activo() from public, anon, authenticated;

-- Canonical PM33 P05 definition, extracted from the versioned migration.
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

-- Canonical owner-bootstrap definition, extracted from the versioned migration.
create or replace function public.bootstrap_owner_instalacion(
  p_empresa_nombre text,
  p_local_nombre text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_uid uuid := auth.uid();
  v_generation text;
  v_empresa_nombre text := nullif(btrim(p_empresa_nombre), '');
  v_local_nombre text := nullif(btrim(p_local_nombre), '');
  v_empresa_id text;
  v_local_id text;
  v_membresia_id bigint;
  v_perfiles bigint;
begin
  if v_uid is null then
    raise exception 'Sesión requerida' using errcode = '42501';
  end if;

  if v_empresa_nombre is null or char_length(v_empresa_nombre) < 2 or char_length(v_empresa_nombre) > 120 then
    raise exception 'Nombre de empresa inválido' using errcode = '22023';
  end if;

  if v_local_nombre is null or char_length(v_local_nombre) < 2 or char_length(v_local_nombre) > 120 then
    raise exception 'Nombre de local inválido' using errcode = '22023';
  end if;

  -- Un único bootstrap de instalación puede competir a la vez. El lock vive
  -- solo durante esta transacción y también serializa reintentos concurrentes.
  perform pg_advisory_xact_lock(hashtextextended('la-suite:owner-installation-bootstrap', 0));

  select generation
    into v_generation
  from private.la_instalacion_estado
  where singleton = true;

  if v_generation is null then
    raise exception 'PREFLIGHT_FALLO: aplicar primero la barrera post-reset P1';
  end if;

  if not exists (
    select 1
    from public.perfiles p
    where p.user_id = v_uid
      and p.rol = 'Propietario'
      and p.activo = true
  ) then
    raise exception 'PREFLIGHT_FALLO: Propietario no autorizado' using errcode = '42501';
  end if;

  -- IDs estables por Propietario: si la respuesta HTTP se pierde, repetir la
  -- misma operación encuentra exactamente el bootstrap ya comprometido.
  v_empresa_id := 'empresa-' || substr(md5(v_uid::text), 1, 16);
  v_local_id := 'local-' || substr(md5('local:' || v_uid::text), 1, 16);
  v_membresia_id := hashtextextended('la-suite-owner-membership:' || v_uid::text, 0)
                     & 9223372036854775807::bigint;

  -- Camino idempotente: el núcleo exacto ya existe y pertenece al mismo owner.
  if exists (
       select 1 from public.empresas e
       where e.id = v_empresa_id and e.activo = true
     )
     and exists (
       select 1 from public.locales l
       where l.id = v_local_id and l.empresa_id = v_empresa_id and l.activo = true
     )
     and exists (
       select 1 from public.membresias_usuario m
       where m.user_id = v_uid
         and m.empresa_id = v_empresa_id
         and m.local_id is null
         and m.todos_locales = true
         and m.rol = 'Propietario'
         and m.activo = true
     ) then
    return jsonb_build_object(
      'state', 'ready',
      'generation', v_generation,
      'empresa_id', v_empresa_id,
      'local_id', v_local_id,
      'idempotent', true
    );
  end if;

  -- Cualquier estado parcial o ajeno se detiene. Nunca se borra ni se repara
  -- silenciosamente una instalación que dejó de estar vacía.
  if exists (select 1 from public.empresas)
     or exists (select 1 from public.locales)
     or exists (select 1 from public.membresias_usuario) then
    raise exception 'PREFLIGHT_FALLO: estado empresarial no vacío o inconsistente';
  end if;

  select count(*) into v_perfiles from public.perfiles;
  if v_perfiles <> 1 then
    raise exception 'PREFLIGHT_FALLO: identidad inicial ambigua';
  end if;

  insert into public.empresas (id, nombre, activo)
  values (v_empresa_id, v_empresa_nombre, true);

  insert into public.locales (id, empresa_id, nombre, activo)
  values (v_local_id, v_empresa_id, v_local_nombre, true);

  insert into public.membresias_usuario (
    id, user_id, empresa_id, local_id, todos_locales, rol, activo
  ) values (
    v_membresia_id, v_uid, v_empresa_id, null, true, 'Propietario', true
  );

  return jsonb_build_object(
    'state', 'ready',
    'generation', v_generation,
    'empresa_id', v_empresa_id,
    'local_id', v_local_id,
    'idempotent', false
  );
end;
$$;

revoke all on function public.bootstrap_owner_instalacion(text, text) from public, anon;
grant execute on function public.bootstrap_owner_instalacion(text, text) to authenticated;

commit;
