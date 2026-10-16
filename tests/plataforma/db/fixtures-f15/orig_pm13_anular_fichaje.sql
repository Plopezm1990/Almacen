CREATE OR REPLACE FUNCTION public.pm13_anular_fichaje(p_fichaje_id text, p_operation_id text, p_motivo text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_reg public.fichajes_registro%rowtype;
  v_emp public.empleados%rowtype;
  v_datos jsonb;
  v_op_reg public.fichajes_registro%rowtype;
begin
  if (select auth.uid()) is null or not private.la_usuario_activo() then raise exception 'fichaje_sesion_no_autorizada'; end if;
  if nullif(btrim(coalesce(p_operation_id,'')),'') is null or nullif(btrim(coalesce(p_motivo,'')),'') is null then raise exception 'fichaje_anulacion_operacion_y_motivo_requeridos'; end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('pm13:anulacion-op:'||p_operation_id,0));
  select * into v_op_reg from public.fichajes_registro f where f.datos->>'anulacionOperationId'=p_operation_id order by f.creado_en desc limit 1;
  if found then
    if v_op_reg.id=p_fichaje_id and v_op_reg.datos->>'motivoAnulacion'=btrim(p_motivo) then
      return jsonb_build_object('ok',true,'replay',true,'fichaje',v_op_reg.datos);
    end if;
    raise exception 'fichaje_anulacion_operation_id_conflicto';
  end if;

  select * into v_reg from public.fichajes_registro f where f.id=p_fichaje_id for update;
  if not found then raise exception 'fichaje_no_encontrado'; end if;

  select * into v_emp from public.empleados e where e.id=v_reg.datos->>'empleadoId' for share;
  if not found or v_emp.local_id<>v_reg.datos->>'localId' or not private.pm11_local_activo(v_emp.empresa_id,v_emp.local_id) then raise exception 'fichaje_contexto_invalido'; end if;
  if not private.pm11_puede_mutar_personal(v_emp.empresa_id,v_emp.local_id) then raise exception 'fichaje_anulacion_no_autorizada'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('pm13:fichaje:'||v_emp.id,0));

  if coalesce(lower(v_reg.datos->>'anulado'),'false')='true' then raise exception 'fichaje_ya_anulado'; end if;
  if not private.pm13_fichaje_secuencia_valida(v_emp.id,v_emp.local_id,v_reg.id,null) then return jsonb_build_object('ok',false,'codigo','FICHAJE_ANULACION_ROMPE_SECUENCIA'); end if;

  v_datos:=v_reg.datos||jsonb_build_object('anulado',true,'anuladoAt',pg_catalog.clock_timestamp(),'motivoAnulacion',btrim(p_motivo),'anulacionOperationId',p_operation_id);
  update public.fichajes_registro set datos=v_datos where id=v_reg.id;
  perform private.pm11_auditar_empleado('Personal · anular fichaje',v_emp.id,v_emp.empresa_id,v_emp.local_id,jsonb_build_object('fichajeId',v_reg.id,'operationId',p_operation_id,'motivoInformado',true));
  return jsonb_build_object('ok',true,'replay',false,'fichaje',v_datos);
end;
$function$;
