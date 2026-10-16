CREATE OR REPLACE FUNCTION public.pm13_fichaje_manual(p_empleado_id text, p_local_id text, p_fecha date, p_hora text, p_tipo text, p_operation_id text, p_motivo text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_emp public.empleados%rowtype;
  v_existente public.fichajes_registro%rowtype;
  v_id text;
  v_datos jsonb;
begin
  if (select auth.uid()) is null or not private.la_usuario_activo() then raise exception 'fichaje_sesion_no_autorizada'; end if;
  if nullif(btrim(coalesce(p_operation_id,'')),'') is null then raise exception 'fichaje_operation_id_requerido'; end if;
  if p_tipo not in('entrada','salida') or p_hora !~ '^([01]\d|2[0-3]):[0-5]\d$' then raise exception 'fichaje_manual_datos_invalidos'; end if;
  if p_fecha is null or p_fecha>current_date then raise exception 'fichaje_manual_fecha_invalida'; end if;

  select * into v_emp from public.empleados e where e.id=p_empleado_id for share;
  if not found or v_emp.local_id<>p_local_id or v_emp.estado<>'activo' or not private.pm11_local_activo(v_emp.empresa_id,v_emp.local_id) then
    raise exception 'fichaje_empleado_no_activo_o_fuera_de_local';
  end if;
  if not private.pm11_puede_mutar_personal(v_emp.empresa_id,v_emp.local_id) then raise exception 'fichaje_manual_no_autorizado'; end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('pm13:fichaje-op:'||p_operation_id,0));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('pm13:fichaje:'||v_emp.id,0));

  select * into v_existente from public.fichajes_registro f where f.datos->>'operationId'=p_operation_id order by f.creado_en desc limit 1;
  if found then
    if v_existente.datos->>'empleadoId'=v_emp.id
       and v_existente.datos->>'localId'=v_emp.local_id
       and v_existente.datos->>'tipo'=p_tipo
       and v_existente.fecha=p_fecha
       and v_existente.datos->>'hora'=p_hora
       and coalesce(lower(v_existente.datos->>'manual'),'false')='true' then
      return jsonb_build_object('ok',true,'replay',true,'fichaje',v_existente.datos);
    end if;
    raise exception 'fichaje_operation_id_conflicto';
  end if;

  v_id:='fichaje-'||pg_catalog.gen_random_uuid()::text;
  v_datos:=jsonb_build_object('id',v_id,'empleadoId',v_emp.id,'localId',v_emp.local_id,'fecha',p_fecha::text,'hora',p_hora,'tipo',p_tipo,'timestamp',p_fecha::text||'T'||p_hora||':00','operationId',p_operation_id,'manual',true,'motivoManual',nullif(btrim(coalesce(p_motivo,'')),''),'anulado',false);
  if not private.pm13_fichaje_secuencia_valida(v_emp.id,v_emp.local_id,null,v_datos) then return jsonb_build_object('ok',false,'codigo','FICHAJE_SECUENCIA_INVALIDA'); end if;

  insert into public.fichajes_registro(id,fecha,datos) values(v_id,p_fecha,v_datos);
  perform private.pm11_auditar_empleado('Personal · fichaje manual',v_emp.id,v_emp.empresa_id,v_emp.local_id,jsonb_build_object('fichajeId',v_id,'tipo',p_tipo,'fecha',p_fecha,'hora',p_hora));
  return jsonb_build_object('ok',true,'replay',false,'fichaje',v_datos);
end;
$function$;
