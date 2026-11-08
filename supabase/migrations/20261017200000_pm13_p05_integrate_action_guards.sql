-- PM13-P05 — integración del resolver con las RPC de Personal, Fichajes y Ausencias.
-- Mantiene el permiso técnico existente cuando no hay cargo activo; si el actor
-- tiene un cargo activo en el contexto, la decisión pasa por el resolver.

begin;
set local lock_timeout = '10s';
set local statement_timeout = '30s';

do $preflight$
declare
  v_missing text[] := array[]::text[];
begin
  if to_regprocedure('public.pm13_resolver_cargo_permiso(text,text,text,text,text,text)') is null then
    v_missing := array_append(v_missing, 'pm13_resolver_cargo_permiso');
  end if;
  if cardinality(v_missing) > 0 then
    raise exception 'PM13_P05_GUARD_PREFLIGHT_FALLO:%', array_to_string(v_missing, ',');
  end if;
end $preflight$;

create or replace function private.pm13_p05_accion_autorizada(
  p_empresa_id text,
  p_local_id text,
  p_clave text,
  p_accion text,
  p_alcance text
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_legacy boolean;
  v_profile public.perfiles%rowtype;
  v_cargo_activo boolean;
  v_resolucion jsonb;
begin
  if auth.uid() is null then
    return false;
  end if;

  v_legacy := private.pm11_puede_mutar_personal(p_empresa_id, p_local_id);
  if not v_legacy then
    return false;
  end if;

  select * into v_profile
    from public.perfiles p
   where p.user_id = auth.uid()
     and p.activo = true
   order by p.updated_at desc
   limit 1;

  if not found or v_profile.empleado_id is null then
    return v_legacy;
  end if;

  select exists(
    select 1
      from public.abc_cargo_asignaciones a
     where a.empresa_id = p_empresa_id
       and a.local_id = p_local_id
       and a.empleado_id = v_profile.empleado_id
       and a.activo = true
  ) into v_cargo_activo;

  if not v_cargo_activo then
    return v_legacy;
  end if;

  v_resolucion := public.pm13_resolver_cargo_permiso(
    p_empresa_id,
    p_local_id,
    p_clave,
    p_accion,
    p_alcance,
    null
  );
  return coalesce((v_resolucion->>'permitido')::boolean, false);
end
$$;

revoke all on function private.pm13_p05_accion_autorizada(text,text,text,text,text) from public, anon, authenticated, service_role;

do $rewrite$
declare
  v_oid oid;
  v_def text;
  v_old text;
  v_new text;
  v_count integer;
begin
  -- Personal: alta, edición y ciclo de baja/reactivación.
  for v_oid in
    select p.oid
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname in ('pm11_alta_empleado','pm11_editar_empleado','pm11_baja_empleado','pm11_reactivar_empleado')
  loop
    v_def := pg_get_functiondef(v_oid);
    if position('pm11_alta_empleado' in v_def) > 0 then
      v_old := 'IF auth.uid() IS NULL OR NOT private.pm11_puede_mutar_personal(p_empresa_id, p_local_id) THEN';
      v_new := 'IF auth.uid() IS NULL OR NOT private.pm13_p05_accion_autorizada(p_empresa_id, p_local_id, ''PM13_PERSONAL_CREAR'', ''CREAR'', ''LOCAL'') THEN';
    elsif position('pm11_editar_empleado' in v_def) > 0 then
      v_old := 'if (select auth.uid()) is null or not private.pm11_puede_mutar_personal(p_empresa_id,p_local_id) then';
      v_new := 'if (select auth.uid()) is null or not private.pm13_p05_accion_autorizada(p_empresa_id,p_local_id,''PM13_PERSONAL_EDITAR'',''EDITAR'',''LOCAL'') then';
    elsif position('pm11_baja_empleado' in v_def) > 0 then
      v_old := 'if (select auth.uid()) is null or not private.pm11_puede_mutar_personal(p_empresa_id,p_local_id) then';
      v_new := 'if (select auth.uid()) is null or not private.pm13_p05_accion_autorizada(p_empresa_id,p_local_id,''PM13_PERSONAL_ANULAR'',''ANULAR_ELIMINAR'',''LOCAL'') then';
    else
      v_old := 'if (select auth.uid()) is null or not private.pm11_puede_mutar_personal(p_empresa_id,p_local_id) then';
      v_new := 'if (select auth.uid()) is null or not private.pm13_p05_accion_autorizada(p_empresa_id,p_local_id,''PM13_PERSONAL_ANULAR'',''ANULAR_ELIMINAR'',''LOCAL'') then';
    end if;
    v_count := length(v_def) - length(replace(v_def, v_old, ''));
    if v_count = 0 then
      raise exception 'PM13_P05_GUARD_REWRITE_SIN_COINCIDENCIA:%', v_oid::text;
    end if;
    execute replace(v_def, v_old, v_new);
  end loop;

  -- Fichajes: conserva el fichaje propio; las operaciones de gestión usan el resolver.
  for v_oid in
    select p.oid
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname in ('pm13_fichar','pm13_fichaje_manual','pm13_corregir_fichaje','pm13_anular_fichaje')
  loop
    v_def := pg_get_functiondef(v_oid);
    if position('pm13_fichar' in v_def) > 0 then
      v_old := 'if not private.pm13_fichaje_actor_es_empleado(v_emp.id) and not private.pm11_puede_mutar_personal(v_emp.empresa_id,v_emp.local_id) then';
      v_new := 'if not private.pm13_fichaje_actor_es_empleado(v_emp.id) and not private.pm13_p05_accion_autorizada(v_emp.empresa_id,v_emp.local_id,''PM13_FICHAJE_MANUAL'',''CREAR'',''LOCAL'') then';
    elsif position('pm13_fichaje_manual' in v_def) > 0 then
      v_old := 'if not private.pm11_puede_mutar_personal(v_emp.empresa_id,v_emp.local_id) then raise exception ''fichaje_manual_no_autorizado''; end if;';
      v_new := 'if not private.pm13_p05_accion_autorizada(v_emp.empresa_id,v_emp.local_id,''PM13_FICHAJE_MANUAL'',''CREAR'',''LOCAL'') then raise exception ''fichaje_manual_no_autorizado''; end if;';
    elsif position('pm13_corregir_fichaje' in v_def) > 0 then
      v_old := 'if not private.pm11_puede_mutar_personal(v_emp.empresa_id,v_emp.local_id) then raise exception ''fichaje_correccion_no_autorizada''; end if;';
      v_new := 'if not private.pm13_p05_accion_autorizada(v_emp.empresa_id,v_emp.local_id,''PM13_FICHAJE_CORREGIR'',''EDITAR'',''LOCAL'') then raise exception ''fichaje_correccion_no_autorizada''; end if;';
    else
      v_old := 'if not private.pm11_puede_mutar_personal(v_emp.empresa_id,v_emp.local_id) then raise exception ''fichaje_anulacion_no_autorizada''; end if;';
      v_new := 'if not private.pm13_p05_accion_autorizada(v_emp.empresa_id,v_emp.local_id,''PM13_FICHAJE_ANULAR'',''ANULAR_ELIMINAR'',''LOCAL'') then raise exception ''fichaje_anulacion_no_autorizada''; end if;';
    end if;
    v_count := length(v_def) - length(replace(v_def, v_old, ''));
    if v_count = 0 then
      raise exception 'PM13_P05_GUARD_REWRITE_SIN_COINCIDENCIA:%', v_oid::text;
    end if;
    execute replace(v_def, v_old, v_new);
  end loop;

  -- Ausencias: registrar y anular pasan por el mismo puente de compatibilidad.
  for v_oid in
    select p.oid
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname in ('pm13_registrar_ausencia','pm13_anular_ausencia')
  loop
    v_def := pg_get_functiondef(v_oid);
    if position('pm13_registrar_ausencia' in v_def) > 0 then
      v_old := 'IF auth.uid() IS NULL OR NOT private.pm11_puede_mutar_personal(p_empresa_id, p_local_id) THEN';
      v_new := 'IF auth.uid() IS NULL OR NOT private.pm13_p05_accion_autorizada(p_empresa_id, p_local_id, ''PM13_AUSENCIA_REGISTRAR'', ''CREAR'', ''LOCAL'') THEN';
    else
      v_old := 'IF auth.uid() IS NULL OR NOT private.pm11_puede_mutar_personal(p_empresa_id, p_local_id) THEN';
      v_new := 'IF auth.uid() IS NULL OR NOT private.pm13_p05_accion_autorizada(p_empresa_id, p_local_id, ''PM13_AUSENCIA_ANULAR'', ''ANULAR_ELIMINAR'', ''LOCAL'') THEN';
    end if;
    v_count := length(v_def) - length(replace(v_def, v_old, ''));
    if v_count = 0 then
      raise exception 'PM13_P05_GUARD_REWRITE_SIN_COINCIDENCIA:%', v_oid::text;
    end if;
    execute replace(v_def, v_old, v_new);
  end loop;
end $rewrite$;

comment on function private.pm13_p05_accion_autorizada(text,text,text,text,text)
  is 'Puente de compatibilidad: mantiene el permiso técnico si no hay cargo activo y delega en PM13-P05 cuando sí lo hay.';

commit;
