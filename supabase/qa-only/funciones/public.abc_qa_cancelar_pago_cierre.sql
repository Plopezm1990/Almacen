CREATE OR REPLACE FUNCTION public.abc_qa_cancelar_pago_cierre(p_empresa_id text, p_local_id text, p_session_id uuid, p_intento_id uuid, p_motivo text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_intento public.pago_intentos%rowtype;
  v_pago public.pagos%rowtype;
  v_session public.caja_sesiones%rowtype;
  v_operation public.abc_operaciones%rowtype;
  v_terminal uuid;
  v_operation_id text;
  v_result jsonb;
  v_motivo text:=nullif(btrim(coalesce(p_motivo,'')),'' );
begin
  if not private.abc_qa_c04_propietario(p_empresa_id,p_local_id) then raise exception 'abc_qa_reconcile_propietario_requerido'; end if;
  if v_motivo is null then raise exception 'abc_qa_reconcile_motivo_requerido'; end if;
  if length(v_motivo)>500 then raise exception 'abc_qa_reconcile_motivo_demasiado_largo'; end if;
  select * into v_session from public.caja_sesiones s where s.empresa_id=p_empresa_id and s.local_id=p_local_id and s.id=p_session_id;
  if not found or v_session.estado<>'CIERRE_PROVISIONAL' then raise exception 'abc_qa_reconcile_sesion_no_provisional'; end if;
  select * into v_intento from public.pago_intentos i where i.empresa_id=p_empresa_id and i.local_id=p_local_id and i.id=p_intento_id;
  if not found then raise exception 'abc_qa_reconcile_intento_no_encontrado'; end if;
  select * into v_pago from public.pagos p where p.empresa_id=p_empresa_id and p.local_id=p_local_id and p.id=v_intento.pago_id;
  if not found then raise exception 'abc_qa_reconcile_pago_no_encontrado'; end if;
  if v_intento.estado='CANCELADO' and v_pago.estado='CANCELADO' then
    return jsonb_build_object('ok',true,'already_resolved',true,'intento_id',p_intento_id,'pago_id',v_pago.id,'estado','CANCELADO');
  end if;
  if v_intento.estado<>'PENDIENTE' or v_pago.estado<>'PENDIENTE' then raise exception 'abc_qa_reconcile_pago_no_pendiente'; end if;
  if v_pago.medio<>'TARJETA' or v_intento.abc_command_id not like 'f4.b02b03.pay.%' then raise exception 'abc_qa_reconcile_pago_no_simulado'; end if;
  select * into v_operation from public.abc_operaciones o
   where o.empresa_id=p_empresa_id and o.local_id=p_local_id and o.operation_id=v_intento.abc_command_id
     and o.command_type='ABC_INICIAR_COBRO';
  if not found then raise exception 'abc_qa_reconcile_operacion_pago_no_verificable'; end if;
  if not exists (
    select 1 from public.caja_sesion_terminales st
     where st.empresa_id=p_empresa_id and st.local_id=p_local_id and st.session_id=p_session_id
       and st.terminal_id=v_operation.terminal_id and st.hasta is null
  ) then raise exception 'abc_qa_reconcile_pago_fuera_de_sesion'; end if;
  select st.terminal_id into v_terminal from public.caja_sesion_terminales st
   where st.empresa_id=p_empresa_id and st.local_id=p_local_id and st.session_id=p_session_id and st.hasta is null
   order by st.desde,st.terminal_id limit 1;
  if v_terminal is null then raise exception 'abc_qa_reconcile_terminal_no_encontrado'; end if;

  v_operation_id:='qa.f5.c04.payment.cancel.'||replace(p_intento_id::text,'-','');
  v_result:=public.abc_resolver_intento(
    v_operation_id,p_empresa_id,p_local_id,p_intento_id,'CANCELADO','QA_SIMULADO',
    'QA-CANCEL-'||replace(p_intento_id::text,'-',''),null,null,null,
    jsonb_build_object('modo','QA_SIMULADO','resultado','CANCELADO','motivo',v_motivo,'actor_user_id',auth.uid(),'session_id',p_session_id)
  );
  if not exists (
    select 1 from public.abc_eventos e where e.empresa_id=p_empresa_id and e.local_id=p_local_id
      and e.operation_id=v_operation_id and e.event_type='QA_PAGO_SIMULADO_CANCELADO'
  ) then
    insert into public.abc_eventos(
      empresa_id,local_id,operation_id,aggregate_type,aggregate_id,event_type,payload,
      actor_user_id,terminal_id,occurred_at,operating_day
    ) values (
      p_empresa_id,p_local_id,v_operation_id,'PAGO',v_pago.id::text,'QA_PAGO_SIMULADO_CANCELADO',
      jsonb_build_object('intento_id',p_intento_id,'pago_id',v_pago.id,'checkout_id',v_pago.checkout_id,
        'motivo',v_motivo,'estado','CANCELADO','provider_code','QA_SIMULADO'),auth.uid(),v_terminal,now(),current_date
    );
  end if;
  return coalesce(v_result,'{}'::jsonb)||jsonb_build_object('ok',true,'estado','CANCELADO','qa_simulado',true,'motivo',v_motivo);
end $function$;
