-- PM27 / P5: puente seguro entre el contexto relacional autoritativo y la UI
-- local-first histórica. No crea bloques globales empresas/locales en almacen_kv.
--
-- Este archivo NO se aplica automáticamente a producción desde esta rama.
begin;

set local lock_timeout = '5s';
set local statement_timeout = '20s';

alter table public.empresas
  add column if not exists datos jsonb not null default '{}'::jsonb;

alter table public.locales
  add column if not exists datos jsonb not null default '{}'::jsonb;

create or replace function public.obtener_contexto_instalacion_ui()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_uid uuid := auth.uid();
  v_estado jsonb;
  v_generation text;
  v_empresas jsonb := '[]'::jsonb;
  v_locales jsonb := '[]'::jsonb;
  v_empresa_principal text;
  v_local_activo text;
  v_permite_todos boolean := false;
begin
  if v_uid is null then
    raise exception 'Sesión requerida' using errcode = '42501';
  end if;

  v_estado := public.obtener_estado_instalacion();
  if coalesce(v_estado->>'state', '') <> 'ready' then
    raise exception 'Instalación no preparada para la UI' using errcode = 'P0001';
  end if;

  v_generation := v_estado->>'generation';

  select m.empresa_id
    into v_empresa_principal
  from public.membresias_usuario m
  join public.empresas e on e.id = m.empresa_id and e.activo = true
  where m.user_id = v_uid
    and m.activo = true
  order by m.created_at, m.id
  limit 1;

  select exists (
    select 1
    from public.membresias_usuario m
    join public.empresas e on e.id = m.empresa_id and e.activo = true
    where m.user_id = v_uid
      and m.activo = true
      and m.todos_locales = true
  ) into v_permite_todos;

  select coalesce(jsonb_agg(x.obj order by x.orden, x.id), '[]'::jsonb)
    into v_empresas
  from (
    select distinct on (e.id)
      e.id,
      e.created_at as orden,
      coalesce(e.datos, '{}'::jsonb)
        || jsonb_build_object(
          'id', e.id,
          'activo', e.activo,
          'razonSocial', coalesce(nullif(e.datos->>'razonSocial', ''), e.nombre),
          'marca', coalesce(nullif(e.datos->>'marca', ''), e.nombre)
        ) as obj
    from public.membresias_usuario m
    join public.empresas e on e.id = m.empresa_id
    where m.user_id = v_uid
      and m.activo = true
    order by e.id, e.created_at
  ) x;

  select coalesce(jsonb_agg(x.obj order by x.orden, x.id), '[]'::jsonb)
    into v_locales
  from (
    select distinct on (l.id)
      l.id,
      l.created_at as orden,
      coalesce(l.datos, '{}'::jsonb)
        || jsonb_build_object(
          'id', l.id,
          'empresaId', l.empresa_id,
          'nombre', l.nombre,
          'activo', l.activo
        ) as obj
    from public.membresias_usuario m
    join public.locales l
      on l.empresa_id = m.empresa_id
     and (m.todos_locales = true or l.id = m.local_id)
    where m.user_id = v_uid
      and m.activo = true
    order by l.id, l.created_at
  ) x;

  select l.id
    into v_local_activo
  from public.membresias_usuario m
  join public.locales l
    on l.empresa_id = m.empresa_id
   and l.activo = true
   and (m.todos_locales = true or l.id = m.local_id)
  where m.user_id = v_uid
    and m.activo = true
  order by case when m.empresa_id = v_empresa_principal then 0 else 1 end,
           m.created_at, l.created_at, l.id
  limit 1;

  if v_empresa_principal is null or v_local_activo is null then
    raise exception 'Contexto empresarial incompleto' using errcode = 'P0001';
  end if;

  return jsonb_build_object(
    'state', 'ready',
    'generation', v_generation,
    'empresa_id', v_empresa_principal,
    'local_id', v_local_activo,
    'permite_todos_locales', v_permite_todos,
    'empresas', v_empresas,
    'locales', v_locales
  );
end;
$$;

revoke all on function public.obtener_contexto_instalacion_ui() from public, anon;
grant execute on function public.obtener_contexto_instalacion_ui() to authenticated;

create or replace function public.guardar_contexto_instalacion_ui(
  p_clave text,
  p_valor jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_uid uuid := auth.uid();
  v_clave text := btrim(coalesce(p_clave, ''));
  v_item jsonb;
  v_id text;
  v_empresa_id text;
  v_nombre text;
  v_activo boolean;
  v_membresia_id bigint;
  v_datos jsonb;
begin
  if v_uid is null then
    raise exception 'Sesión requerida' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.perfiles p
    where p.user_id = v_uid
      and p.activo = true
      and p.rol = 'Propietario'
  ) then
    raise exception 'Propietario requerido' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('la-suite:ui-context:' || v_uid::text, 0));

  if v_clave = 'empresas' then
    if jsonb_typeof(p_valor) <> 'array' then
      raise exception 'empresas debe ser una lista' using errcode = '22023';
    end if;

    for v_item in select value from jsonb_array_elements(p_valor)
    loop
      if jsonb_typeof(v_item) <> 'object' or octet_length(v_item::text) > 131072 then
        raise exception 'Empresa inválida' using errcode = '22023';
      end if;

      v_id := btrim(coalesce(v_item->>'id', ''));
      v_nombre := nullif(btrim(coalesce(v_item->>'razonSocial', v_item->>'marca', v_item->>'nombre', '')), '');
      if v_id !~ '^[A-Za-z0-9._:-]{1,120}$' or v_nombre is null or char_length(v_nombre) > 160 then
        raise exception 'Identidad de empresa inválida' using errcode = '22023';
      end if;

      if exists (select 1 from public.empresas e where e.id = v_id) then
        if not exists (
          select 1 from public.membresias_usuario m
          where m.user_id = v_uid and m.empresa_id = v_id
            and m.activo = true and m.rol = 'Propietario'
        ) then
          raise exception 'Empresa fuera del alcance del Propietario' using errcode = '42501';
        end if;
      else
        insert into public.empresas(id, nombre, activo, datos)
        values (v_id, v_nombre, true, '{}'::jsonb);

        v_membresia_id := hashtextextended(
          'la-suite-owner-membership:' || v_uid::text || ':' || v_id, 0
        ) & 9223372036854775807::bigint;

        insert into public.membresias_usuario(
          id, user_id, empresa_id, local_id, todos_locales, rol, activo
        ) values (
          v_membresia_id, v_uid, v_id, null, true, 'Propietario', true
        );
      end if;

      v_datos := v_item - 'id' - 'activo' - 'created_at' - 'createdAt';
      update public.empresas
      set nombre = v_nombre,
          datos = v_datos
      where id = v_id;
    end loop;

  elsif v_clave = 'locales' then
    if jsonb_typeof(p_valor) <> 'array' then
      raise exception 'locales debe ser una lista' using errcode = '22023';
    end if;

    for v_item in select value from jsonb_array_elements(p_valor)
    loop
      if jsonb_typeof(v_item) <> 'object' or octet_length(v_item::text) > 131072 then
        raise exception 'Local inválido' using errcode = '22023';
      end if;

      v_id := btrim(coalesce(v_item->>'id', ''));
      v_empresa_id := btrim(coalesce(v_item->>'empresaId', v_item->>'empresa_id', ''));
      v_nombre := nullif(btrim(coalesce(v_item->>'nombre', '')), '');
      v_activo := case
        when v_item ? 'activo' then (v_item->>'activo')::boolean
        else true
      end;

      if v_id !~ '^[A-Za-z0-9._:-]{1,120}$'
         or v_empresa_id !~ '^[A-Za-z0-9._:-]{1,120}$'
         or v_nombre is null or char_length(v_nombre) > 160 then
        raise exception 'Identidad de local inválida' using errcode = '22023';
      end if;

      if not exists (
        select 1
        from public.membresias_usuario m
        join public.empresas e on e.id = m.empresa_id and e.activo = true
        where m.user_id = v_uid
          and m.empresa_id = v_empresa_id
          and m.activo = true
          and m.rol = 'Propietario'
      ) then
        raise exception 'Empresa del local fuera del alcance del Propietario' using errcode = '42501';
      end if;

      if exists (select 1 from public.locales l where l.id = v_id) then
        if not exists (
          select 1 from public.locales l
          where l.id = v_id and l.empresa_id = v_empresa_id
        ) then
          raise exception 'El local pertenece a otra empresa' using errcode = '42501';
        end if;

        if v_activo = false
           and exists (select 1 from public.locales l where l.id = v_id and l.activo = true)
           and not exists (
             select 1 from public.locales l
             where l.empresa_id = v_empresa_id and l.activo = true and l.id <> v_id
           ) then
          raise exception 'No se puede desactivar el último local activo de la empresa' using errcode = '22023';
        end if;
      elsif v_activo = false then
        raise exception 'Un local nuevo debe crearse activo' using errcode = '22023';
      end if;

      v_datos := v_item - 'id' - 'empresaId' - 'empresa_id' - 'nombre' - 'activo' - 'created_at' - 'createdAt';

      insert into public.locales(id, empresa_id, nombre, activo, datos)
      values (v_id, v_empresa_id, v_nombre, v_activo, v_datos)
      on conflict (id) do update
      set nombre = excluded.nombre,
          activo = excluded.activo,
          datos = excluded.datos
      where public.locales.empresa_id = excluded.empresa_id;
    end loop;

  elsif v_clave = 'localActivoId' then
    if p_valor is null or jsonb_typeof(p_valor) = 'null' then
      if not exists (
        select 1
        from public.membresias_usuario m
        where m.user_id = v_uid
          and m.activo = true
          and m.rol = 'Propietario'
          and m.todos_locales = true
      ) then
        raise exception 'Vista consolidada no permitida' using errcode = '42501';
      end if;
    elsif jsonb_typeof(p_valor) = 'string' then
      v_id := p_valor #>> '{}';
      if not exists (
        select 1
        from public.membresias_usuario m
        join public.locales l
          on l.empresa_id = m.empresa_id
         and l.id = v_id
         and l.activo = true
         and (m.todos_locales = true or m.local_id = l.id)
        where m.user_id = v_uid
          and m.activo = true
          and m.rol = 'Propietario'
      ) then
        raise exception 'Local activo fuera del alcance del Propietario' using errcode = '42501';
      end if;
    else
      raise exception 'localActivoId inválido' using errcode = '22023';
    end if;
  else
    raise exception 'Clave de contexto UI no permitida' using errcode = '22023';
  end if;

  return public.obtener_contexto_instalacion_ui();
end;
$$;

revoke all on function public.guardar_contexto_instalacion_ui(text, jsonb) from public, anon;
grant execute on function public.guardar_contexto_instalacion_ui(text, jsonb) to authenticated;

commit;
