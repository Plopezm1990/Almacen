-- PM13-P05 — corrector de guardas para las RPC de ausencias restauradas.
-- Reaplica únicamente el puente P05 sobre las dos RPC de ausencias.

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
  if to_regprocedure('private.pm13_p05_accion_autorizada(text,text,text,text,text)') is null then
    v_missing := array_append(v_missing, 'pm13_p05_accion_autorizada');
  end if;
  if to_regprocedure('public.pm13_registrar_ausencia(text,text,text,text,text,date,date,text)') is null then
    v_missing := array_append(v_missing, 'pm13_registrar_ausencia');
  end if;
  if to_regprocedure('public.pm13_anular_ausencia(text,text,text,text,text,text)') is null then
    v_missing := array_append(v_missing, 'pm13_anular_ausencia');
  end if;
  if cardinality(v_missing) > 0 then
    raise exception 'PM13_P05_RPC_AUSENCIAS_PREFLIGHT_FALLO:%', array_to_string(v_missing, ',');
  end if;
end $preflight$;

do $rewrite$
declare
  v_oid oid;
  v_def text;
  v_old text := 'IF auth.uid() IS NULL OR NOT private.pm11_puede_mutar_personal(p_empresa_id, p_local_id) THEN';
  v_new text;
  v_delta integer;
begin
  for v_oid, v_new in
    select to_regprocedure('public.pm13_registrar_ausencia(text,text,text,text,text,date,date,text)'),
           'IF auth.uid() IS NULL OR NOT private.pm13_p05_accion_autorizada(p_empresa_id, p_local_id, ''PM13_AUSENCIA_REGISTRAR'', ''CREAR'', ''LOCAL'') THEN'
    union all
    select to_regprocedure('public.pm13_anular_ausencia(text,text,text,text,text,text)'),
           'IF auth.uid() IS NULL OR NOT private.pm13_p05_accion_autorizada(p_empresa_id, p_local_id, ''PM13_AUSENCIA_ANULAR'', ''ANULAR_ELIMINAR'', ''LOCAL'') THEN'
  loop
    v_def := pg_get_functiondef(v_oid);
    if position('pm13_p05_accion_autorizada' in v_def) > 0 then
      raise exception 'PM13_P05_RPC_AUSENCIAS_YA_GUARDADA:%', v_oid::text;
    end if;
    v_delta := length(v_def) - length(replace(v_def, v_old, ''));
    if v_delta <> length(v_old) then
      raise exception 'PM13_P05_RPC_AUSENCIAS_REWRITE_SIN_COINCIDENCIA:%', v_oid::text;
    end if;
    execute replace(v_def, v_old, v_new);
  end loop;
end $rewrite$;

revoke all on function public.pm13_registrar_ausencia(text,text,text,text,text,date,date,text) from public, anon;
revoke all on function public.pm13_anular_ausencia(text,text,text,text,text,text) from public, anon;
grant execute on function public.pm13_registrar_ausencia(text,text,text,text,text,date,date,text) to authenticated;
grant execute on function public.pm13_anular_ausencia(text,text,text,text,text,text) to authenticated;

commit;
