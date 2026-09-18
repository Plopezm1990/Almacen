-- PM29: la desactivacion de una empresa deja de ignorarse en silencio, y
-- arrastra sus locales.
--
-- Antes, la rama de 'empresas' de guardar_contexto_instalacion_ui descartaba el
-- campo 'activo' del objeto recibido (v_item - 'activo') y nunca lo escribia en
-- la columna: el cliente podia mandar una baja, el servidor respondia "ok" y la
-- empresa seguia activa. La pantalla mostraba la baja hasta recargar. Los
-- locales, en cambio, ya la respetaban correctamente.
--
-- Invariantes que sostiene esta version:
--   I1  al propietario siempre le queda al menos una empresa activa;
--   I2  una empresa activa nunca se queda sin locales activos;
--   I3  la fila nunca se borra: toda baja es logica.
--
-- I2 es la que costo entender. El freno que la sostiene ("no se puede
-- desactivar el ultimo local activo de la empresa") ya existia y AQUI NO SE
-- TOCA. Con el intacto, bloquear la baja de una empresa con locales activos
-- creaba un punto muerto: una empresa de un solo local no se podia dar de baja
-- jamas. Se intento romperlo relajando I2 a "el ultimo local del propietario",
-- y el resultado fue peor: empresas activas sin ningun local, y la lectura del
-- contexto emparejando una empresa activa con el local de OTRA empresa. Se
-- detecto en produccion, con los datos reales del propietario.
--
-- La salida correcta es arrastrar: dar de baja una empresa desactiva sus
-- locales en la misma operacion. Desaparece el punto muerto sin romper I2.
--
-- Cambios sobre la funcion original:
--   * el UPDATE de empresas persiste 'activo';
--   * omitir 'activo' conserva el valor guardado, no fuerza true;
--   * una empresa nueva no puede nacer desactivada;
--   * no se puede desactivar la ultima empresa activa (I1);
--   * la baja de una empresa desactiva sus locales;
--   * la pertenencia de un local ya no exige que su empresa este activa (eso
--     solo se exige para tener el local ACTIVO). Sin esto, el cliente -- que
--     manda siempre la lista completa de locales -- no podia guardar ninguno en
--     cuanto existiera una empresa dada de baja.
--
-- Este archivo NO se aplica automaticamente a produccion desde esta rama.
begin;

set local lock_timeout = '5s';
set local statement_timeout = '20s';

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

      -- PM29: omitir 'activo' conserva el valor ya guardado. Antes se descartaba
      -- el campo entero, asi que una baja logica se aceptaba y se ignoraba en
      -- silencio; con este coalesce tampoco se reactiva nada sin pedirlo.
      v_activo := case
        when v_item ? 'activo' then (v_item->>'activo')::boolean
        else coalesce((select e.activo from public.empresas e where e.id = v_id), true)
      end;

      if exists (select 1 from public.empresas e where e.id = v_id) then
        if not exists (
          select 1 from public.membresias_usuario m
          where m.user_id = v_uid and m.empresa_id = v_id
            and m.activo = true and m.rol = 'Propietario'
        ) then
          raise exception 'Empresa fuera del alcance del Propietario' using errcode = '42501';
        end if;

        -- PM29: la baja de una empresa es logica (la fila nunca se borra) y
        -- arrastra sus locales en la misma operacion.
        --
        -- Se intento lo contrario: bloquear la baja mientras la empresa tuviera
        -- locales activos. No funciona. Como ademas no se puede quitar a una
        -- empresa activa su ultimo local, una empresa de un solo local no se
        -- habria podido dar de baja jamas. Y relajar aquel freno para romper el
        -- bloqueo dejaba algo peor: empresas activas sin ningun local, y la
        -- lectura del contexto emparejando una empresa con el local de otra.
        -- Arrastrar los locales es lo que "dar de baja la empresa" significa.
        if v_activo = false
           and exists (select 1 from public.empresas e where e.id = v_id and e.activo = true) then
          if not exists (
            select 1
            from public.membresias_usuario m
            join public.empresas e on e.id = m.empresa_id and e.activo = true
            where m.user_id = v_uid
              and m.activo = true
              and e.id <> v_id
          ) then
            raise exception 'No se puede desactivar la ultima empresa activa' using errcode = '22023';
          end if;

          update public.locales
          set activo = false
          where empresa_id = v_id
            and activo = true;
        end if;
      else
        if v_activo = false then
          raise exception 'Una empresa nueva debe crearse activa' using errcode = '22023';
        end if;

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
          activo = v_activo,
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

      -- La pertenencia se exige siempre: el local tiene que ser de una empresa
      -- del propietario.
      if not exists (
        select 1
        from public.membresias_usuario m
        where m.user_id = v_uid
          and m.empresa_id = v_empresa_id
          and m.activo = true
          and m.rol = 'Propietario'
      ) then
        raise exception 'Empresa del local fuera del alcance del Propietario' using errcode = '42501';
      end if;

      -- Que la empresa este activa solo se exige para tener el local ACTIVO. Un
      -- local ya inactivo de una empresa dada de baja tiene que poder seguir en
      -- la lista sin tumbar el guardado de todos los demas.
      if v_activo = true
         and not exists (
           select 1 from public.empresas e
           where e.id = v_empresa_id and e.activo = true
         ) then
        raise exception 'La empresa del local esta dada de baja: reactivala antes' using errcode = '22023';
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
