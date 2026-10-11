-- PM27 / P4: bootstrap transaccional e idempotente de la primera empresa,
-- primer local y membresía del Propietario después de P1/P2.
--
-- Este archivo NO se aplica automáticamente a producción desde esta rama.
begin;

set local lock_timeout = '5s';
set local statement_timeout = '20s';

create or replace function public.obtener_estado_instalacion()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_uid uuid := auth.uid();
  v_generation text;
  v_rol text;
  v_perfiles bigint;
  v_empresas bigint;
  v_locales bigint;
  v_membresias bigint;
  v_empresa_id text;
  v_local_id text;
begin
  if v_uid is null then
    raise exception 'Sesión requerida' using errcode = '42501';
  end if;

  select generation
    into v_generation
  from private.la_instalacion_estado
  where singleton = true;

  if v_generation is null then
    raise exception 'Estado de instalación no disponible' using errcode = 'P0001';
  end if;

  select p.rol
    into v_rol
  from public.perfiles p
  where p.user_id = v_uid
    and p.activo = true
  limit 1;

  select count(*) into v_perfiles from public.perfiles;
  select count(*) into v_empresas from public.empresas;
  select count(*) into v_locales from public.locales;
  select count(*) into v_membresias from public.membresias_usuario;

  if v_rol = 'Propietario'
     and v_perfiles = 1
     and v_empresas = 0
     and v_locales = 0
     and v_membresias = 0 then
    return jsonb_build_object(
      'state', 'needs_setup',
      'generation', v_generation,
      'role', v_rol
    );
  end if;

  select m.empresa_id,
         case
           when m.todos_locales then (
             select l2.id
             from public.locales l2
             where l2.empresa_id = m.empresa_id
               and l2.activo = true
             order by l2.created_at, l2.id
             limit 1
           )
           else m.local_id
         end
    into v_empresa_id, v_local_id
  from public.membresias_usuario m
  join public.empresas e
    on e.id = m.empresa_id
   and e.activo = true
  where m.user_id = v_uid
    and m.activo = true
    and (
      (m.todos_locales = true
       and m.local_id is null
       and exists (
         select 1
         from public.locales l
         where l.empresa_id = m.empresa_id
           and l.activo = true
       ))
      or
      (m.todos_locales = false
       and m.local_id is not null
       and exists (
         select 1
         from public.locales l
         where l.id = m.local_id
           and l.empresa_id = m.empresa_id
           and l.activo = true
       ))
    )
  order by m.created_at, m.id
  limit 1;

  if v_empresa_id is not null and v_local_id is not null then
    return jsonb_build_object(
      'state', 'ready',
      'generation', v_generation,
      'role', v_rol,
      'empresa_id', v_empresa_id,
      'local_id', v_local_id
    );
  end if;

  return jsonb_build_object(
    'state', 'blocked_inconsistent',
    'generation', v_generation,
    'role', v_rol
  );
end;
$$;

revoke all on function public.obtener_estado_instalacion() from public, anon;
grant execute on function public.obtener_estado_instalacion() to authenticated;

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
