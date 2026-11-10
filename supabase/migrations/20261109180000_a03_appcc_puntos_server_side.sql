-- A-03: las definiciones de punto usadas por las lecturas también deben estar
-- en la tabla que valida la RPC; no se permite crear un punto huérfano en JSON.

create or replace function public.appcc_guardar_punto(
  p_id text,
  p_empresa_id text,
  p_local_id text,
  p_nombre text,
  p_tipo text,
  p_frecuencia text,
  p_temp_min numeric default null,
  p_temp_max numeric default null,
  p_activo boolean default true
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_id text := nullif(btrim(coalesce(p_id, '')), '');
  v_empresa text := nullif(btrim(coalesce(p_empresa_id, '')), '');
  v_local text := nullif(btrim(coalesce(p_local_id, '')), '');
  v_nombre text := nullif(btrim(coalesce(p_nombre, '')), '');
  v_tipo text := lower(nullif(btrim(coalesce(p_tipo, '')), ''));
  v_frecuencia text := nullif(btrim(coalesce(p_frecuencia, '')), '');
  v_existente public.appcc_puntos_control%rowtype;
  v_row public.appcc_puntos_control%rowtype;
begin
  if v_uid is null or not private.la_usuario_activo() then
    raise exception 'usuario_inactivo_o_no_autenticado';
  end if;
  if v_id is null or v_empresa is null or v_local is null or v_nombre is null or v_frecuencia is null
     or v_tipo not in ('temperatura', 'limpieza', 'recepcion', 'otro') then
    raise exception 'punto_control_parametros_invalidos';
  end if;
  if not private.la_tiene_local(v_empresa, v_local) then
    raise exception 'contexto_no_autorizado';
  end if;
  if p_temp_min is not null and p_temp_max is not null and p_temp_min > p_temp_max then
    raise exception 'rango_temperatura_invalido';
  end if;

  select * into v_existente from public.appcc_puntos_control where id = v_id;
  if found and (v_existente.empresa_id is distinct from v_empresa
                or v_existente.local_id is distinct from v_local) then
    raise exception 'punto_control_fuera_de_contexto';
  end if;

  insert into public.appcc_puntos_control (
    id, empresa_id, local_id, nombre, tipo, frecuencia, temp_min, temp_max,
    activo, created_by, created_at, updated_at
  ) values (
    v_id, v_empresa, v_local, v_nombre, v_tipo, v_frecuencia,
    p_temp_min, p_temp_max, coalesce(p_activo, true), v_uid,
    clock_timestamp(), clock_timestamp()
  ) on conflict (id) do update set
    nombre = excluded.nombre,
    tipo = excluded.tipo,
    frecuencia = excluded.frecuencia,
    temp_min = excluded.temp_min,
    temp_max = excluded.temp_max,
    activo = excluded.activo,
    updated_at = clock_timestamp()
  returning * into v_row;

  return jsonb_build_object('ok', true, 'punto', to_jsonb(v_row));
end;
$$;

create or replace function public.appcc_desactivar_punto(
  p_id text,
  p_empresa_id text,
  p_local_id text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_row public.appcc_puntos_control%rowtype;
begin
  if v_uid is null or not private.la_usuario_activo() then
    raise exception 'usuario_inactivo_o_no_autenticado';
  end if;
  if not private.la_tiene_local(p_empresa_id, p_local_id) then
    raise exception 'contexto_no_autorizado';
  end if;
  update public.appcc_puntos_control
     set activo = false, updated_at = clock_timestamp()
   where id = p_id and empresa_id = p_empresa_id and local_id = p_local_id
   returning * into v_row;
  if not found then raise exception 'punto_control_no_encontrado'; end if;
  return jsonb_build_object('ok', true, 'punto', to_jsonb(v_row));
end;
$$;

revoke all on function public.appcc_guardar_punto(text,text,text,text,text,text,numeric,numeric,boolean)
  from public, anon, authenticated;
grant execute on function public.appcc_guardar_punto(text,text,text,text,text,text,numeric,numeric,boolean)
  to authenticated;
revoke all on function public.appcc_desactivar_punto(text,text,text)
  from public, anon, authenticated;
grant execute on function public.appcc_desactivar_punto(text,text,text)
  to authenticated;
