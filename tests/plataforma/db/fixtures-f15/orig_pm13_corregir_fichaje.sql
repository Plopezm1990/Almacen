CREATE OR REPLACE FUNCTION public.pm13_corregir_fichaje(p_fichaje_id text, p_fecha date, p_hora text, p_tipo text, p_operation_id text, p_motivo text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_reg public.fichajes_registro%rowtype;
  v_emp public.empleados%rowtype;
  v_datos jsonb;
  v_original jsonb;
  v_historial jsonb;
  v_op_fichaje_id text;
  v_op_entry jsonb;
begin
  if (select auth.uid()) is null or not private.la_usuario_activo() then raise exception 'fichaje_sesion_no_autorizada'; end if;
  if nullif(btrim(coalesce(p_operation_id,'')),'') is null or nullif(btrim(coalesce(p_motivo,'')),'') is null then raise exception 'fichaje_correccion_operacion_y_motivo_requeridos'; end if;
  if p_tipo not in('entrada','salida') or p_hora !~ '^([01]\d|2[0-3]):[0-5]\d$' or p_fecha is null or p_fecha>current_date then raise exception 'fichaje_correccion_datos_invalidos'; end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('pm13:correccion-op:'||p_operation_id,0));

  select f.id,h.elem into v_op_fichaje_id,v_op_entry
    from public.fichajes_registro f
    cross join lateral jsonb_array_elements(case when jsonb_typeof(f.datos->'historialCorrecciones')='array' then f.datos->'historialCorrecciones' else '[]'::jsonb end) h(elem)
   where h.elem->>'operationId'=p_operation_id
   limit 1;
  if found then
    if v_op_fichaje_id=p_fichaje_id
       and v_op_entry->'despues'=jsonb_build_object('fecha',p_fecha::text,'hora',p_hora,'tipo',p_tipo)
       and v_op_entry->>'motivo'=btrim(p_motivo) then
      select * into v_reg from public.fichajes_registro f where f.id=p_fichaje_id;
      return jsonb_build_object('ok',true,'replay',true,'fichaje',v_reg.datos);
    end if;
    raise exception 'fichaje_correccion_operation_id_conflicto';
  end if;

  select * into v_reg from public.fichajes_registro f where f.id=p_fichaje_id for update;
  if not found then raise exception 'fichaje_no_encontrado'; end if;
  if coalesce(lower(v_reg.datos->>'anulado'),'false')='true' then raise exception 'fichaje_anulado_no_editable'; end if;

  select * into v_emp from public.empleados e where e.id=v_reg.datos->>'empleadoId' for share;
  if not found or v_emp.local_id<>v_reg.datos->>'localId' or not private.pm11_local_activo(v_emp.empresa_id,v_emp.local_id) then raise exception 'fichaje_contexto_invalido'; end if;
  if not private.pm11_puede_mutar_personal(v_emp.empresa_id,v_emp.local_id) then raise exception 'fichaje_correccion_no_autorizada'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('pm13:fichaje:'||v_emp.id,0));

  v_datos:=v_reg.datos||jsonb_build_object('fecha',p_fecha::text,'hora',p_hora,'tipo',p_tipo,'timestamp',p_fecha::text||'T'||p_hora||':00','corregido',true,'corregidoAt',pg_catalog.clock_timestamp(),'motivoCorreccion',btrim(p_motivo),'ultimaCorreccionOperationId',p_operation_id);
  if not private.pm13_fichaje_secuencia_valida(v_emp.id,v_emp.local_id,v_reg.id,v_datos) then return jsonb_build_object('ok',false,'codigo','FICHAJE_SECUENCIA_INVALIDA'); end if;

  v_original:=coalesce(v_reg.datos->'original',jsonb_build_object('fecha',v_reg.datos->>'fecha','hora',v_reg.datos->>'hora','tipo',v_reg.datos->>'tipo','timestamp',v_reg.datos->>'timestamp'));
  v_historial:=coalesce(case when jsonb_typeof(v_reg.datos->'historialCorrecciones')='array' then v_reg.datos->'historialCorrecciones' else '[]'::jsonb end,'[]'::jsonb)
    || jsonb_build_array(jsonb_build_object(
      'operationId',p_operation_id,
      'antes',jsonb_build_object('fecha',v_reg.datos->>'fecha','hora',v_reg.datos->>'hora','tipo',v_reg.datos->>'tipo'),
      'despues',jsonb_build_object('fecha',p_fecha::text,'hora',p_hora,'tipo',p_tipo),
      'motivo',btrim(p_motivo),
      'corregidoAt',pg_catalog.clock_timestamp()
    ));
  v_datos:=v_datos||jsonb_build_object('original',v_original,'historialCorrecciones',v_historial);

  update public.fichajes_registro set fecha=p_fecha,datos=v_datos where id=v_reg.id;
  perform private.pm11_auditar_empleado('Personal · corregir fichaje',v_emp.id,v_emp.empresa_id,v_emp.local_id,jsonb_build_object('fichajeId',v_reg.id,'operationId',p_operation_id,'motivoInformado',true));
  return jsonb_build_object('ok',true,'replay',false,'fichaje',v_datos);
end;
$function$;
