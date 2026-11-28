CREATE OR REPLACE FUNCTION public.abc_qa_rechazar_pago_simulado(p_empresa_id text, p_local_id text, p_intento_id uuid, p_motivo text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid uuid := auth.uid();
  v_motivo text := nullif(btrim(coalesce(p_motivo,'')),'');
  v_intento public.pago_intentos%rowtype;
  v_pago public.pagos%rowtype;
  v_provider text;
  v_reference text;
  v_operation_id text;
  v_result jsonb;
begin
  -- H-27 (27/11/2026): contraparte de abc_qa_confirmar_pago_simulado. Mismas barreras: solo QA-EMP-A / QA-A1 y Propietario.
  if not private.abc_qa_c04_propietario(p_empresa_id, p_local_id) then
    raise exception 'abc_qa_simulador_propietario_requerido';
  end if;
  if v_motivo is null then raise exception 'abc_qa_simulador_motivo_requerido'; end if;
  if length(v_motivo) > 500 then raise exception 'abc_qa_simulador_motivo_demasiado_largo'; end if;

  select i.* into v_intento
    from public.pago_intentos i
   where i.empresa_id = p_empresa_id and i.local_id = p_local_id and i.id = p_intento_id;
  if not found then raise exception 'abc_qa_simulador_intento_no_encontrado'; end if;
  select p.* into v_pago
    from public.pagos p
   where p.empresa_id = p_empresa_id and p.local_id = p_local_id and p.id = v_intento.pago_id;
  if not found then raise exception 'abc_qa_simulador_pago_no_encontrado'; end if;
  if v_pago.medio not in ('TARJETA','BIZUM') then raise exception 'abc_qa_simulador_medio_no_soportado'; end if;
  if v_intento.estado = 'RECHAZADO' and v_pago.estado = 'RECHAZADO' then
    return jsonb_build_object('ok',true,'already_resolved',true,'intento_id',p_intento_id,'pago_id',v_pago.id,'estado','RECHAZADO');
  end if;
  if v_intento.estado <> 'PENDIENTE' or v_pago.estado <> 'PENDIENTE' then
    raise exception 'abc_qa_simulador_pago_no_pendiente';
  end if;

  v_provider := 'QA_SIMULADO_' || v_pago.medio;
  v_reference := 'QA-SIM-RECHAZO-' || replace(p_intento_id::text, '-', '');
  v_operation_id := 'qa.f4.b02b.sim.rechazo.' || replace(p_intento_id::text, '-', '');
  v_result := public.abc_resolver_intento(
    v_operation_id, p_empresa_id, p_local_id, p_intento_id, 'RECHAZADO', v_provider, v_reference,
    null, null, null,
    jsonb_build_object('modo', 'QA_SIMULADO', 'resultado', 'RECHAZADO', 'motivo', v_motivo, 'actor_user_id', v_uid, 'intento_id', p_intento_id)
  );

  return coalesce(v_result, '{}'::jsonb) || jsonb_build_object(
    'ok', true,
    'qa_simulado', true,
    'resultado', 'RECHAZADO',
    'provider_code', v_provider,
    'provider_reference', v_reference,
    'motivo', v_motivo
  );
end;
$function$;
