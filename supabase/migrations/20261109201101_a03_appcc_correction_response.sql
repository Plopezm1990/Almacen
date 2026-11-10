-- A-03: la respuesta de una corrección nueva debe devolver la fila append-only
-- recién creada. La versión inicial solo rellenaba v_existente en el camino
-- de reintento y devolvía `correccion: null` en la primera ejecución.

create or replace function public.appcc_corregir_lectura(
  p_correccion_id uuid,
  p_lectura_original_id uuid,
  p_valor text,
  p_conforme boolean,
  p_observaciones text,
  p_motivo text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_empleado_id text;
  v_actor_nombre text;
  v_original public.appcc_lecturas%rowtype;
  v_nueva public.appcc_lecturas%rowtype;
  v_existente public.appcc_lectura_correcciones%rowtype;
  v_nueva_id uuid := gen_random_uuid();
begin
  if v_uid is null or not private.la_usuario_activo() then
    raise exception 'usuario_inactivo_o_no_autenticado';
  end if;
  if p_correccion_id is null or p_lectura_original_id is null then
    raise exception 'correccion_id_requerido';
  end if;
  if p_valor is null or btrim(p_valor) = '' then raise exception 'valor_requerido'; end if;
  if p_motivo is null or btrim(p_motivo) = '' then raise exception 'motivo_requerido'; end if;

  select * into v_existente
  from public.appcc_lectura_correcciones
  where id = p_correccion_id;
  if found then
    select * into v_nueva
    from public.appcc_lecturas
    where id = v_existente.lectura_correccion_id;
    return jsonb_build_object(
      'ok', true,
      'replayed', true,
      'correccion', to_jsonb(v_existente),
      'lectura', to_jsonb(v_nueva)
    );
  end if;

  select * into v_original
  from public.appcc_lecturas
  where id = p_lectura_original_id
  for update;
  if not found then raise exception 'lectura_original_no_encontrada'; end if;
  if not private.la_tiene_local(v_original.empresa_id, v_original.local_id) then
    raise exception 'contexto_no_autorizado';
  end if;

  select p.empleado_id, p.nombre into v_empleado_id, v_actor_nombre
  from public.perfiles p where p.user_id = v_uid and p.activo = true;

  insert into public.appcc_lecturas (
    id, punto_control_id, empresa_id, local_id, punto_nombre, tipo, valor,
    conforme, observaciones, actor_user_id, actor_empleado_id, actor_nombre
  ) values (
    v_nueva_id, v_original.punto_control_id, v_original.empresa_id,
    v_original.local_id, v_original.punto_nombre, v_original.tipo, p_valor,
    p_conforme, coalesce(p_observaciones, ''), v_uid, v_empleado_id, v_actor_nombre
  ) returning * into v_nueva;

  insert into public.appcc_lectura_correcciones (
    id, lectura_original_id, lectura_correccion_id, empresa_id, local_id,
    valor_anterior, conforme_anterior, observaciones_anterior, motivo,
    actor_user_id, actor_empleado_id, actor_nombre
  ) values (
    p_correccion_id, v_original.id, v_nueva.id, v_original.empresa_id,
    v_original.local_id, v_original.valor, v_original.conforme,
    v_original.observaciones, btrim(p_motivo), v_uid, v_empleado_id,
    v_actor_nombre
  ) returning * into v_existente;

  return jsonb_build_object(
    'ok', true,
    'replayed', false,
    'correccion', to_jsonb(v_existente),
    'lectura', to_jsonb(v_nueva)
  );
end;
$$;

revoke all on function public.appcc_corregir_lectura(uuid,uuid,text,boolean,text,text)
  from public, anon, authenticated;
grant execute on function public.appcc_corregir_lectura(uuid,uuid,text,boolean,text,text)
  to authenticated;
