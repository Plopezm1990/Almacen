-- PM11 · Personal / Empleados · P07
-- Migración controlada de fichas legacy/KV hacia public.empleados.
-- Aplicar únicamente en QA hasta autorización expresa. Producción/main no se toca.

create or replace function private.pm11_try_timestamptz(p_text text)
returns timestamptz
language plpgsql
immutable
set search_path = 'pg_catalog', 'pg_temp'
as $$
begin
  if nullif(btrim(coalesce(p_text, '')), '') is null then
    return null;
  end if;
  begin
    return p_text::timestamptz;
  exception when others then
    return null;
  end;
end;
$$;

revoke all on function private.pm11_try_timestamptz(text) from public, anon, authenticated;

create or replace function private.pm11_local_pertenece_empresa(
  p_empresa_id text,
  p_local_id text
) returns boolean
language sql
stable security definer
set search_path = 'public', 'private', 'pg_temp'
as $$
  select
    nullif(btrim(p_empresa_id), '') is not null
    and nullif(btrim(p_local_id), '') is not null
    and upper(btrim(p_local_id)) not in ('TODOS', 'TODOS LOS LOCALES')
    and exists (
      select 1
        from public.almacen_kv k
       where k.empresa_id = p_empresa_id
         and (
           (
             jsonb_typeof(k.value) = 'object'
             and coalesce(nullif(k.value->>'id',''), k.local_id) = p_local_id
             and coalesce(nullif(k.value->>'empresaId',''), k.empresa_id) = p_empresa_id
           )
           or
           exists (
             select 1
               from jsonb_array_elements(
                 case when jsonb_typeof(k.value) = 'array' then k.value else '[]'::jsonb end
               ) j
              where j->>'id' = p_local_id
                and coalesce(nullif(j->>'empresaId',''), p_empresa_id) = p_empresa_id
           )
         )
    );
$$;

revoke all on function private.pm11_local_pertenece_empresa(text, text) from public, anon, authenticated;

-- La migración histórica es una operación elevada: solo Propietario activo.
-- A diferencia de alta/edición ordinaria, permite un local cerrado para poder
-- conservar fichas históricas, siempre que el local pertenezca a la empresa.
create or replace function private.pm11_puede_migrar_personal(
  p_empresa_id text,
  p_local_id text
) returns boolean
language sql
stable security definer
set search_path = 'public', 'auth', 'private', 'pg_temp'
as $$
  select private.la_usuario_activo()
     and private.pm11_local_pertenece_empresa(p_empresa_id, p_local_id)
     and exists (
       select 1
         from public.membresias_usuario m
        where m.user_id = auth.uid()
          and m.empresa_id = p_empresa_id
          and m.activo = true
          and m.rol = 'Propietario'
          and (m.todos_locales = true or m.local_id = p_local_id)
     );
$$;

revoke all on function private.pm11_puede_migrar_personal(text, text) from public, anon, authenticated;

create or replace function private.pm11_normalizar_empleado_legacy(
  p_ficha jsonb,
  p_empresa_id text,
  p_local_id text
) returns jsonb
language plpgsql
set search_path = 'public', 'private', 'pg_temp'
as $$
declare
  v_id text;
  v_nombre text;
  v_empresa_legacy text;
  v_local_legacy text;
  v_estado_raw text;
  v_estado text;
  v_activo_raw text;
  v_anon_raw text;
  v_datos jsonb;
  v_created_at timestamptz;
  v_baja_at timestamptz;
  v_reactivado_at timestamptz;
  v_anonimizado_at timestamptz;
begin
  if p_ficha is null or jsonb_typeof(p_ficha) <> 'object' then
    raise exception 'empleado_legacy_no_objeto';
  end if;

  v_id := nullif(btrim(coalesce(p_ficha->>'id', p_ficha->>'empleadoId', '')), '');
  if v_id is null then
    raise exception 'empleado_legacy_id_requerido';
  end if;

  v_empresa_legacy := nullif(btrim(coalesce(p_ficha->>'empresaId', '')), '');
  if v_empresa_legacy is not null and v_empresa_legacy <> p_empresa_id then
    raise exception 'empleado_legacy_empresa_no_coincide';
  end if;

  v_local_legacy := nullif(btrim(coalesce(p_ficha->>'localId', '')), '');
  if v_local_legacy is not null and v_local_legacy <> p_local_id then
    raise exception 'empleado_legacy_local_no_coincide';
  end if;

  v_estado_raw := lower(btrim(coalesce(p_ficha->>'estado', '')));
  if v_estado_raw not in ('', 'activo', 'inactivo', 'anonimizado') then
    raise exception 'empleado_legacy_estado_invalido';
  end if;

  v_activo_raw := lower(btrim(coalesce(p_ficha->>'activo', '')));
  v_anon_raw := lower(btrim(coalesce(p_ficha->>'anonimizado', '')));

  if v_estado_raw = 'anonimizado' or v_anon_raw in ('true','1','yes','si','sí') then
    v_estado := 'anonimizado';
  elsif v_estado_raw = 'inactivo' or v_activo_raw in ('false','0','no') then
    v_estado := 'inactivo';
  else
    v_estado := 'activo';
  end if;

  v_nombre := nullif(btrim(coalesce(p_ficha->>'nombre', '')), '');
  if v_estado <> 'anonimizado' and v_nombre is null then
    raise exception 'empleado_legacy_nombre_requerido';
  end if;

  v_created_at := private.pm11_try_timestamptz(coalesce(p_ficha->>'creadoEn', p_ficha->>'createdAt'));
  v_baja_at := private.pm11_try_timestamptz(p_ficha->>'bajaAt');
  v_reactivado_at := private.pm11_try_timestamptz(p_ficha->>'reactivadoAt');
  v_anonimizado_at := private.pm11_try_timestamptz(p_ficha->>'anonimizadoAt');

  if v_estado = 'inactivo' and v_baja_at is null then
    v_baja_at := now();
  end if;
  if v_estado = 'anonimizado' then
    if v_baja_at is null then v_baja_at := now(); end if;
    if v_anonimizado_at is null then v_anonimizado_at := now(); end if;
  end if;
  if v_reactivado_at is not null and v_baja_at is null then
    v_baja_at := v_reactivado_at;
  end if;

  -- Los timestamps de ciclo pasan a columnas SQL; no se dejan cadenas legacy
  -- inválidas dentro del JSON canónico.
  v_datos := p_ficha
    - 'empleadoId'
    - 'empresaId'
    - 'localId'
    - 'estado'
    - 'activo'
    - 'anonimizado'
    - 'bajaAt'
    - 'reactivadoAt'
    - 'anonimizadoAt'
    - 'creadoEn'
    - 'createdAt'
    - 'actualizadoAt'
    - 'updatedAt';

  if v_estado = 'anonimizado' then
    v_nombre := null;
    v_datos := v_datos
      - 'nombre'
      - 'dni'
      - 'nie'
      - 'pin'
      - 'email'
      - 'telefono'
      - 'direccion'
      - 'emailCuenta'
      - 'rolCuenta'
      - 'tieneCuenta'
      - 'documentos'
      - 'ausencias';
  end if;

  v_datos := v_datos || jsonb_build_object(
    'id', v_id,
    'empresaId', p_empresa_id,
    'localId', p_local_id,
    'nombre', v_nombre,
    'estado', v_estado,
    'activo', v_estado = 'activo',
    'anonimizado', v_estado = 'anonimizado',
    'migradoDesdeLegacy', true
  );

  perform private.pm11_validar_datos_laborales(v_datos);

  return jsonb_build_object(
    'id', v_id,
    'empresaId', p_empresa_id,
    'localId', p_local_id,
    'estado', v_estado,
    'nombre', v_nombre,
    'datos', v_datos,
    'createdAt', v_created_at,
    'bajaAt', v_baja_at,
    'reactivadoAt', v_reactivado_at,
    'anonimizadoAt', v_anonimizado_at
  );
end;
$$;

revoke all on function private.pm11_normalizar_empleado_legacy(jsonb, text, text) from public, anon, authenticated;

create or replace function public.pm11_previsualizar_migracion_empleados_legacy(
  p_empresa_id text,
  p_local_id text,
  p_fichas jsonb
) returns jsonb
language plpgsql
security definer
set search_path = 'public', 'auth', 'private', 'pg_temp'
as $$
declare
  v_ficha jsonb;
  v_norm jsonb;
  v_exist public.empleados%rowtype;
  v_id text;
  v_idx bigint;
  v_total integer := 0;
  v_candidatos integer := 0;
  v_ya_migrados integer := 0;
  v_problemas integer := 0;
  v_vistos jsonb := '{}'::jsonb;
  v_detalles jsonb := '[]'::jsonb;
  v_codigo text;
begin
  if auth.uid() is null or not private.pm11_puede_migrar_personal(p_empresa_id, p_local_id) then
    raise exception 'personal_migracion_no_autorizada';
  end if;
  if p_fichas is null or jsonb_typeof(p_fichas) <> 'array' then
    raise exception 'empleados_legacy_array_requerido';
  end if;
  if jsonb_array_length(p_fichas) > 500 then
    raise exception 'empleados_legacy_limite_500';
  end if;

  v_total := jsonb_array_length(p_fichas);

  for v_ficha, v_idx in
    select value, ordinality
      from jsonb_array_elements(p_fichas) with ordinality
  loop
    begin
      v_norm := private.pm11_normalizar_empleado_legacy(v_ficha, p_empresa_id, p_local_id);
      v_id := v_norm->>'id';

      if v_vistos ? v_id then
        v_problemas := v_problemas + 1;
        v_detalles := v_detalles || jsonb_build_array(jsonb_build_object(
          'indice', v_idx,
          'empleadoId', v_id,
          'estado', 'problema',
          'codigo', 'empleado_legacy_id_duplicado_en_lote'
        ));
        continue;
      end if;
      v_vistos := v_vistos || jsonb_build_object(v_id, true);

      select * into v_exist from public.empleados e where e.id = v_id;
      if found then
        if v_exist.empresa_id <> p_empresa_id or v_exist.local_id <> p_local_id then
          v_problemas := v_problemas + 1;
          v_detalles := v_detalles || jsonb_build_array(jsonb_build_object(
            'indice', v_idx,
            'empleadoId', v_id,
            'estado', 'problema',
            'codigo', 'empleado_legacy_id_colision_otro_contexto'
          ));
        elsif v_exist.estado = v_norm->>'estado'
          and v_exist.nombre is not distinct from nullif(v_norm->>'nombre','')
          and v_exist.datos = v_norm->'datos' then
          v_ya_migrados := v_ya_migrados + 1;
          v_detalles := v_detalles || jsonb_build_array(jsonb_build_object(
            'indice', v_idx,
            'empleadoId', v_id,
            'estado', 'ya_migrado'
          ));
        else
          v_problemas := v_problemas + 1;
          v_detalles := v_detalles || jsonb_build_array(jsonb_build_object(
            'indice', v_idx,
            'empleadoId', v_id,
            'estado', 'problema',
            'codigo', 'empleado_legacy_conflicto_con_sql'
          ));
        end if;
      else
        v_candidatos := v_candidatos + 1;
        v_detalles := v_detalles || jsonb_build_array(jsonb_build_object(
          'indice', v_idx,
          'empleadoId', v_id,
          'estado', 'candidato'
        ));
      end if;
    exception when others then
      v_problemas := v_problemas + 1;
      v_codigo := case
        when SQLERRM like 'empleado_%' then SQLERRM
        else 'empleado_legacy_invalido'
      end;
      v_detalles := v_detalles || jsonb_build_array(jsonb_build_object(
        'indice', v_idx,
        'empleadoId', nullif(btrim(coalesce(v_ficha->>'id', v_ficha->>'empleadoId', '')), ''),
        'estado', 'problema',
        'codigo', v_codigo
      ));
    end;
  end loop;

  return jsonb_build_object(
    'ok', true,
    'empresaId', p_empresa_id,
    'localId', p_local_id,
    'total', v_total,
    'candidatos', v_candidatos,
    'yaMigrados', v_ya_migrados,
    'problemas', v_problemas,
    'puedeMigrar', v_problemas = 0,
    'detalles', v_detalles
  );
end;
$$;

create or replace function public.pm11_migrar_empleados_legacy(
  p_empresa_id text,
  p_local_id text,
  p_fichas jsonb
) returns jsonb
language plpgsql
security definer
set search_path = 'public', 'auth', 'private', 'pg_temp'
as $$
declare
  v_preview jsonb;
  v_ficha jsonb;
  v_norm jsonb;
  v_id text;
  v_insertados integer := 0;
  v_omitidos integer := 0;
  v_empleado public.empleados%rowtype;
begin
  if auth.uid() is null or not private.pm11_puede_migrar_personal(p_empresa_id, p_local_id) then
    raise exception 'personal_migracion_no_autorizada';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('pm11:migracion:' || p_empresa_id || ':' || p_local_id, 0));
  v_preview := public.pm11_previsualizar_migracion_empleados_legacy(p_empresa_id, p_local_id, p_fichas);

  if coalesce((v_preview->>'problemas')::integer, 0) > 0 then
    return jsonb_build_object(
      'ok', false,
      'codigo', 'migracion_legacy_bloqueada',
      'preview', v_preview
    );
  end if;

  for v_ficha in select value from jsonb_array_elements(p_fichas)
  loop
    v_norm := private.pm11_normalizar_empleado_legacy(v_ficha, p_empresa_id, p_local_id);
    v_id := v_norm->>'id';

    if exists (select 1 from public.empleados e where e.id = v_id) then
      v_omitidos := v_omitidos + 1;
      continue;
    end if;

    insert into public.empleados(
      id, empresa_id, local_id, estado, nombre, datos,
      created_at, baja_at, reactivado_at, anonimizado_at
    ) values (
      v_id,
      p_empresa_id,
      p_local_id,
      v_norm->>'estado',
      nullif(v_norm->>'nombre',''),
      v_norm->'datos',
      coalesce((v_norm->>'createdAt')::timestamptz, now()),
      (v_norm->>'bajaAt')::timestamptz,
      (v_norm->>'reactivadoAt')::timestamptz,
      (v_norm->>'anonimizadoAt')::timestamptz
    ) returning * into v_empleado;

    perform private.pm11_auditar_empleado(
      'Personal · migrar empleado legacy',
      v_empleado.id,
      v_empleado.empresa_id,
      v_empleado.local_id,
      jsonb_build_object('origen', 'legacy_kv', 'estadoMigrado', v_empleado.estado)
    );

    v_insertados := v_insertados + 1;
  end loop;

  return jsonb_build_object(
    'ok', true,
    'empresaId', p_empresa_id,
    'localId', p_local_id,
    'insertados', v_insertados,
    'omitidosYaMigrados', v_omitidos,
    'kvEliminado', false,
    'preview', v_preview
  );
end;
$$;

revoke all on function public.pm11_previsualizar_migracion_empleados_legacy(text, text, jsonb) from public, anon;
revoke all on function public.pm11_migrar_empleados_legacy(text, text, jsonb) from public, anon;
grant execute on function public.pm11_previsualizar_migracion_empleados_legacy(text, text, jsonb) to authenticated;
grant execute on function public.pm11_migrar_empleados_legacy(text, text, jsonb) to authenticated;
