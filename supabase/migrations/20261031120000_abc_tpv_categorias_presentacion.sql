-- ABC · TPV: presentación de categorías por local (orden y color).
-- Preparada para QA; esta etapa no aplica migraciones remotas por sí sola.
--
-- Guarda, por empresa y local, en qué orden salen las categorías en el carril
-- del TPV y de qué color es cada una. Es configuración de presentación: no
-- toca productos, ni precios, ni stock, ni nada fiscal.
--
-- Permiso: se reutiliza ABC_SALA_CONFIGURAR (Propietario y Encargado), que ya
-- existe y ya es ajustable desde el catálogo de capacidades por rol. No se
-- añade una capacidad nueva para no tocar private.abc_tiene_capacidad, que es
-- la función que más funciones y contratos arrastra.

do $$
begin
  if to_regclass('public.abc_eventos') is null then
    raise exception 'abc_tpv_categorias_dependencia_ausente: abc_eventos';
  end if;
  if to_regprocedure('private.abc_operacion_iniciar(text,text,text,text,jsonb,uuid)') is null then
    raise exception 'abc_tpv_categorias_dependencia_ausente: abc_operacion_iniciar';
  end if;
  if to_regprocedure('private.abc_operacion_completar(text,jsonb)') is null then
    raise exception 'abc_tpv_categorias_dependencia_ausente: abc_operacion_completar';
  end if;
  if to_regprocedure('private.abc_tiene_capacidad(text,text,text)') is null then
    raise exception 'abc_tpv_categorias_dependencia_ausente: abc_tiene_capacidad';
  end if;
  if to_regprocedure('private.la_tiene_local(text,text)') is null then
    raise exception 'abc_tpv_categorias_dependencia_ausente: la_tiene_local';
  end if;
  if to_regprocedure('private.abc_resolver_operating_day_contexto(text,text,timestamptz)') is null then
    raise exception 'abc_tpv_categorias_dependencia_ausente: abc_resolver_operating_day_contexto';
  end if;
end $$;

create table if not exists public.tpv_categorias_presentacion (
  empresa_id text not null,
  local_id text not null,
  -- Orden = posición en el array. Cada entrada: {"categoria":"...","color":"AZUL"}
  categorias jsonb not null default '[]'::jsonb,
  version bigint not null default 1,
  actualizado_en timestamptz not null default now(),
  actualizado_por uuid,
  primary key (empresa_id, local_id),
  constraint tpv_categorias_presentacion_array check (jsonb_typeof(categorias) = 'array')
);

alter table public.tpv_categorias_presentacion enable row level security;
-- Sin políticas a propósito: solo se entra por las funciones de abajo.
revoke all on table public.tpv_categorias_presentacion from public, anon, authenticated;

-- Normaliza y valida la lista. Devuelve el array ya limpio o falla.
create or replace function private.abc_tpv_categorias_normalizar(p_categorias jsonb)
returns jsonb
language plpgsql
immutable
set search_path=''
as $$
declare
  v_colores constant text[] := array['AZUL','NARANJA','VERDE','GRANATE','MORADO','MARRON','ROJO','TEAL','AMBAR'];
  v_entrada jsonb;
  v_categoria text;
  v_color text;
  v_vistas text[] := array[]::text[];
  v_salida jsonb := '[]'::jsonb;
begin
  if p_categorias is null or jsonb_typeof(p_categorias) <> 'array' then
    raise exception 'tpv_categorias_formato_invalido';
  end if;
  if jsonb_array_length(p_categorias) > 60 then
    raise exception 'tpv_categorias_demasiadas';
  end if;

  for v_entrada in select value from jsonb_array_elements(p_categorias) loop
    if jsonb_typeof(v_entrada) <> 'object' then
      raise exception 'tpv_categorias_entrada_invalida';
    end if;
    v_categoria := btrim(coalesce(v_entrada->>'categoria',''));
    v_color := upper(btrim(coalesce(v_entrada->>'color','')));
    if v_categoria = '' or char_length(v_categoria) > 80 then
      raise exception 'tpv_categorias_nombre_invalido';
    end if;
    if not (v_color = any(v_colores)) then
      raise exception 'tpv_categorias_color_invalido';
    end if;
    if v_categoria = any(v_vistas) then
      raise exception 'tpv_categorias_duplicada';
    end if;
    v_vistas := v_vistas || v_categoria;
    v_salida := v_salida || jsonb_build_array(jsonb_build_object('categoria', v_categoria, 'color', v_color));
  end loop;

  return v_salida;
end $$;

revoke all on function private.abc_tpv_categorias_normalizar(jsonb) from public, anon, authenticated, service_role;

-- Lectura: cualquiera que tenga el local puede leer cómo se presenta el carril.
create or replace function public.abc_listar_categorias_tpv(
  p_empresa_id text,
  p_local_id text
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_fila public.tpv_categorias_presentacion%rowtype;
begin
  if auth.uid() is null or not private.la_tiene_local(p_empresa_id, p_local_id) then
    raise exception 'abc_tpv_categorias_no_autorizada';
  end if;

  select * into v_fila
    from public.tpv_categorias_presentacion
   where empresa_id = p_empresa_id and local_id = p_local_id;

  if not found then
    -- Sin configurar todavía: el TPV se queda con su orden y color por defecto.
    return jsonb_build_object('ok', true, 'version', 0, 'categorias', '[]'::jsonb);
  end if;

  return jsonb_build_object(
    'ok', true,
    'version', v_fila.version,
    'categorias', v_fila.categorias,
    'actualizado_en', v_fila.actualizado_en,
    'actualizado_por', v_fila.actualizado_por
  );
end $$;

revoke all on function public.abc_listar_categorias_tpv(text,text) from public, anon, authenticated, service_role;
grant execute on function public.abc_listar_categorias_tpv(text,text) to authenticated;

-- Escritura: reemplaza la lista entera, con bloqueo optimista por versión.
create or replace function public.abc_configurar_categorias_tpv(
  p_operation_id text,
  p_empresa_id text,
  p_local_id text,
  p_categorias jsonb,
  p_expected_version bigint,
  p_terminal_id uuid,
  p_session_id uuid,
  -- Opcional: la pantalla de ajustes no tiene por qué haber abierto una
  -- cuenta, así que si no viene lo resuelve el servidor con la regla del local.
  p_operating_day date default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path=''
as $$
declare
  v_fila public.tpv_categorias_presentacion%rowtype;
  v_operating_day date;
  v_dia_estimado boolean := false;
  v_normalizadas jsonb;
  v_request jsonb;
  v_cmd jsonb;
  v_version bigint;
  v_result jsonb;
begin
  if auth.uid() is null
     or not private.la_tiene_local(p_empresa_id, p_local_id)
     or not private.abc_tiene_capacidad(p_empresa_id, p_local_id, 'ABC_SALA_CONFIGURAR') then
    raise exception 'abc_tpv_categorias_no_autorizada';
  end if;
  if nullif(btrim(coalesce(p_operation_id,'')),'') is null
     or p_expected_version is null then
    raise exception 'tpv_categorias_parametros_requeridos';
  end if;

  -- Día operativo: el del local si lo tiene configurado. Muchos locales aún no
  -- tienen regla de corte, y un cambio de presentación no puede quedar
  -- bloqueado por eso: se cae a la fecha del servidor y se marca como estimado,
  -- para que nadie lo confunda después con un día operativo autoritativo.
  -- Cualquier otro fallo del resolutor (local inactivo, regla ambigua) sí corta.
  v_operating_day := p_operating_day;
  if v_operating_day is null then
    begin
      v_operating_day := (private.abc_resolver_operating_day_contexto(p_empresa_id, p_local_id, now())->>'operating_day')::date;
    exception when sqlstate 'P0001' then
      if sqlerrm like '%operating_day_configuracion_ausente%' then
        v_operating_day := current_date;
        v_dia_estimado := true;
      else
        raise;
      end if;
    end;
  end if;

  v_normalizadas := private.abc_tpv_categorias_normalizar(p_categorias);

  v_request := jsonb_build_object(
    'empresa_id', p_empresa_id,
    'local_id', p_local_id,
    'categorias', v_normalizadas,
    'expected_version', p_expected_version
  );

  v_cmd := private.abc_operacion_iniciar(
    p_operation_id, p_empresa_id, p_local_id, 'ABC_CONFIGURAR_CATEGORIAS_TPV', v_request, p_terminal_id
  );
  if (v_cmd->>'replayed')::boolean then
    return coalesce(v_cmd->'resultado', v_cmd);
  end if;

  select * into v_fila
    from public.tpv_categorias_presentacion
   where empresa_id = p_empresa_id and local_id = p_local_id
     for update;

  if not found then
    if p_expected_version <> 0 then
      raise exception 'tpv_categorias_version_conflict';
    end if;
    insert into public.tpv_categorias_presentacion(
      empresa_id, local_id, categorias, version, actualizado_en, actualizado_por
    ) values (
      p_empresa_id, p_local_id, v_normalizadas, 1, now(), auth.uid()
    );
    v_version := 1;
  else
    if v_fila.version <> p_expected_version then
      raise exception 'tpv_categorias_version_conflict';
    end if;
    update public.tpv_categorias_presentacion
       set categorias = v_normalizadas,
           version = version + 1,
           actualizado_en = now(),
           actualizado_por = auth.uid()
     where empresa_id = p_empresa_id and local_id = p_local_id
     returning version into v_version;
  end if;

  insert into public.abc_eventos(
    empresa_id, local_id, operation_id, aggregate_type, aggregate_id,
    event_type, payload, actor_user_id, terminal_id, occurred_at, operating_day
  ) values (
    p_empresa_id, p_local_id, p_operation_id, 'TPV_CATEGORIAS_PRESENTACION', p_empresa_id || ':' || p_local_id,
    'TPV_CATEGORIAS_PRESENTACION_CONFIGURADA',
    jsonb_build_object('categorias', v_normalizadas, 'version', v_version, 'session_id', p_session_id, 'operating_day_estimado', v_dia_estimado),
    auth.uid(), p_terminal_id, now(), v_operating_day
  );

  v_result := jsonb_build_object('ok', true, 'version', v_version, 'categorias', v_normalizadas, 'operating_day', v_operating_day, 'operating_day_estimado', v_dia_estimado);
  perform private.abc_operacion_completar(p_operation_id, v_result);
  return v_result;
end $$;

revoke all on function public.abc_configurar_categorias_tpv(text,text,text,jsonb,bigint,uuid,uuid,date) from public, anon, authenticated, service_role;
grant execute on function public.abc_configurar_categorias_tpv(text,text,text,jsonb,bigint,uuid,uuid,date) to authenticated;
