-- P2 · P06 · autoridad de servidor para Personal/Fichajes sobre release actual.
-- No migra datos ni cambia PM11/PM13. Publica una capability solo cuando el
-- backend objetivo demuestra el contrato completo que usa el frontend.

begin;
set local lock_timeout='5s';
set local statement_timeout='30s';

do $preflight$
declare
  v_missing text[] := array[]::text[];
begin
  if to_regclass('public.empleados') is null then v_missing := array_append(v_missing,'empleados'); end if;
  if to_regclass('public.fichajes_registro') is null then v_missing := array_append(v_missing,'fichajes_registro'); end if;

  if to_regprocedure('public.pm11_alta_empleado(text,text,text,text,jsonb)') is null then
    v_missing := array_append(v_missing,'pm11_alta_empleado');
  end if;
  if to_regprocedure('public.pm11_editar_empleado(text,text,text,jsonb,text)') is null then
    v_missing := array_append(v_missing,'pm11_editar_empleado_5_args');
  end if;
  if to_regprocedure('public.pm11_baja_empleado(text,text,text,text)') is null then
    v_missing := array_append(v_missing,'pm11_baja_empleado');
  end if;
  if to_regprocedure('public.pm11_reactivar_empleado(text,text,text)') is null then
    v_missing := array_append(v_missing,'pm11_reactivar_empleado');
  end if;

  if to_regprocedure('public.pm13_fichar(text,text,text,text)') is null then
    v_missing := array_append(v_missing,'pm13_fichar');
  end if;
  if to_regprocedure('public.pm13_fichaje_manual(text,text,date,text,text,text,text)') is null then
    v_missing := array_append(v_missing,'pm13_fichaje_manual');
  end if;
  if to_regprocedure('public.pm13_corregir_fichaje(text,date,text,text,text,text)') is null then
    v_missing := array_append(v_missing,'pm13_corregir_fichaje');
  end if;
  if to_regprocedure('public.pm13_anular_fichaje(text,text,text)') is null then
    v_missing := array_append(v_missing,'pm13_anular_fichaje');
  end if;

  if not exists(select 1 from pg_roles where rolname='authenticated') then
    v_missing := array_append(v_missing,'authenticated');
  end if;
  if not exists(select 1 from pg_roles where rolname='anon') then
    v_missing := array_append(v_missing,'anon');
  end if;

  if to_regclass('public.empleados') is not null then
    if not coalesce((select relrowsecurity from pg_class where oid='public.empleados'::regclass),false) then
      v_missing := array_append(v_missing,'empleados_rls');
    end if;
    if not has_table_privilege('authenticated','public.empleados','SELECT') then
      v_missing := array_append(v_missing,'empleados_select_authenticated');
    end if;
    if has_table_privilege('authenticated','public.empleados','INSERT')
       or has_table_privilege('authenticated','public.empleados','UPDATE')
       or has_table_privilege('authenticated','public.empleados','DELETE') then
      v_missing := array_append(v_missing,'empleados_direct_dml_open');
    end if;
    if not exists(
      select 1 from pg_policies
      where schemaname='public' and tablename='empleados'
        and policyname='pm11_empleados_select_gestion' and cmd='SELECT'
        and 'authenticated'=any(roles)
    ) then
      v_missing := array_append(v_missing,'pm11_empleados_select_gestion');
    end if;
  end if;

  if to_regclass('public.fichajes_registro') is not null then
    if not coalesce((select relrowsecurity from pg_class where oid='public.fichajes_registro'::regclass),false) then
      v_missing := array_append(v_missing,'fichajes_rls');
    end if;
    if not has_table_privilege('authenticated','public.fichajes_registro','SELECT') then
      v_missing := array_append(v_missing,'fichajes_select_authenticated');
    end if;
    if has_table_privilege('authenticated','public.fichajes_registro','INSERT')
       or has_table_privilege('authenticated','public.fichajes_registro','UPDATE')
       or has_table_privilege('authenticated','public.fichajes_registro','DELETE') then
      v_missing := array_append(v_missing,'fichajes_direct_dml_open');
    end if;
    if not exists(
      select 1 from pg_policies
      where schemaname='public' and tablename='fichajes_registro'
        and policyname='pm13_fichajes_select_scope' and cmd='SELECT'
        and 'authenticated'=any(roles)
    ) then
      v_missing := array_append(v_missing,'pm13_fichajes_select_scope');
    end if;
  end if;

  if to_regprocedure('public.pm11_alta_empleado(text,text,text,text,jsonb)') is not null then
    if not has_function_privilege('authenticated','public.pm11_alta_empleado(text,text,text,text,jsonb)','EXECUTE')
       or has_function_privilege('anon','public.pm11_alta_empleado(text,text,text,text,jsonb)','EXECUTE') then
      v_missing := array_append(v_missing,'pm11_alta_acl');
    end if;
  end if;
  if to_regprocedure('public.pm11_editar_empleado(text,text,text,jsonb,text)') is not null then
    if not has_function_privilege('authenticated','public.pm11_editar_empleado(text,text,text,jsonb,text)','EXECUTE')
       or has_function_privilege('anon','public.pm11_editar_empleado(text,text,text,jsonb,text)','EXECUTE') then
      v_missing := array_append(v_missing,'pm11_editar_acl');
    end if;
  end if;
  if to_regprocedure('public.pm11_baja_empleado(text,text,text,text)') is not null then
    if not has_function_privilege('authenticated','public.pm11_baja_empleado(text,text,text,text)','EXECUTE')
       or has_function_privilege('anon','public.pm11_baja_empleado(text,text,text,text)','EXECUTE') then
      v_missing := array_append(v_missing,'pm11_baja_acl');
    end if;
  end if;
  if to_regprocedure('public.pm11_reactivar_empleado(text,text,text)') is not null then
    if not has_function_privilege('authenticated','public.pm11_reactivar_empleado(text,text,text)','EXECUTE')
       or has_function_privilege('anon','public.pm11_reactivar_empleado(text,text,text)','EXECUTE') then
      v_missing := array_append(v_missing,'pm11_reactivar_acl');
    end if;
  end if;
  if to_regprocedure('public.pm13_fichar(text,text,text,text)') is not null then
    if not has_function_privilege('authenticated','public.pm13_fichar(text,text,text,text)','EXECUTE')
       or has_function_privilege('anon','public.pm13_fichar(text,text,text,text)','EXECUTE') then
      v_missing := array_append(v_missing,'pm13_fichar_acl');
    end if;
  end if;
  if to_regprocedure('public.pm13_fichaje_manual(text,text,date,text,text,text,text)') is not null then
    if not has_function_privilege('authenticated','public.pm13_fichaje_manual(text,text,date,text,text,text,text)','EXECUTE')
       or has_function_privilege('anon','public.pm13_fichaje_manual(text,text,date,text,text,text,text)','EXECUTE') then
      v_missing := array_append(v_missing,'pm13_manual_acl');
    end if;
  end if;
  if to_regprocedure('public.pm13_corregir_fichaje(text,date,text,text,text,text)') is not null then
    if not has_function_privilege('authenticated','public.pm13_corregir_fichaje(text,date,text,text,text,text)','EXECUTE')
       or has_function_privilege('anon','public.pm13_corregir_fichaje(text,date,text,text,text,text)','EXECUTE') then
      v_missing := array_append(v_missing,'pm13_corregir_acl');
    end if;
  end if;
  if to_regprocedure('public.pm13_anular_fichaje(text,text,text)') is not null then
    if not has_function_privilege('authenticated','public.pm13_anular_fichaje(text,text,text)','EXECUTE')
       or has_function_privilege('anon','public.pm13_anular_fichaje(text,text,text)','EXECUTE') then
      v_missing := array_append(v_missing,'pm13_anular_acl');
    end if;
  end if;

  if cardinality(v_missing)>0 then
    raise exception 'P2_P06_PREFLIGHT_FALLO:%',array_to_string(v_missing,',');
  end if;
end
$preflight$;

create or replace function public.p2_server_authority_capabilities()
returns jsonb
language sql
stable
security invoker
set search_path=''
as $function$
  select jsonb_build_object(
    'personal','pm11',
    'fichajes','pm13',
    'legacyPersistence',false
  );
$function$;

revoke all on function public.p2_server_authority_capabilities() from public,anon,authenticated;
grant execute on function public.p2_server_authority_capabilities() to authenticated;

commit;
