CREATE OR REPLACE FUNCTION public.abc_qa_compensar_efecto_cierre(p_empresa_id text, p_local_id text, p_session_id uuid, p_efecto_id uuid, p_motivo text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_effect public.efectos_pendientes%rowtype;
  v_session public.caja_sesiones%rowtype;
  v_terminal uuid;
  v_operation_id text;
  v_cmd jsonb;
  v_comanda_id uuid;
  v_result jsonb;
  v_motivo text:=nullif(btrim(coalesce(p_motivo,'')),'' );
begin
  if not private.abc_qa_c04_propietario(p_empresa_id,p_local_id) then raise exception 'abc_qa_reconcile_propietario_requerido'; end if;
  if v_motivo is null then raise exception 'abc_qa_reconcile_motivo_requerido'; end if;
  if length(v_motivo)>500 then raise exception 'abc_qa_reconcile_motivo_demasiado_largo'; end if;
  select * into v_session from public.caja_sesiones s where s.empresa_id=p_empresa_id and s.local_id=p_local_id and s.id=p_session_id;
  if not found or v_session.estado<>'CIERRE_PROVISIONAL' then raise exception 'abc_qa_reconcile_sesion_no_provisional'; end if;
  select * into v_effect from public.efectos_pendientes e
   where e.empresa_id=p_empresa_id and e.local_id=p_local_id and e.id=p_efecto_id;
  if not found then raise exception 'abc_qa_reconcile_efecto_no_encontrado'; end if;
  if v_effect.estado='COMPLETADO' then
    return jsonb_build_object('ok',true,'already_resolved',true,'efecto_id',p_efecto_id,'estado','COMPLETADO');
  end if;
  if v_effect.estado not in ('PENDIENTE','EN_PROCESO','ERROR') then raise exception 'abc_qa_reconcile_efecto_no_pendiente'; end if;
  if v_effect.tipo not in ('KITCHEN_COMANDA','KITCHEN_COMANDA_CAMBIO','KITCHEN_COMANDA_CANCELACION','KITCHEN_COMANDA_REIMPRESION') then
    raise exception 'abc_qa_reconcile_efecto_tipo_no_admitido';
  end if;
  if v_effect.payload->>'comanda_id' is null or v_effect.payload->>'pedido_id' is null then raise exception 'abc_qa_reconcile_payload_no_verificable'; end if;
  v_comanda_id:=(v_effect.payload->>'comanda_id')::uuid;
  if not exists (
    select 1 from public.comandas_preparacion c
     where c.empresa_id=p_empresa_id and c.local_id=p_local_id and c.id=v_comanda_id
       and c.pedido_id=(v_effect.payload->>'pedido_id')::uuid
       and c.estado in ('PENDIENTE','BLOQUEADA')
  ) then raise exception 'abc_qa_reconcile_comanda_no_pendiente'; end if;
  if not exists (
    select 1 from public.abc_operaciones o
     where o.empresa_id=p_empresa_id and o.local_id=p_local_id and o.operation_id=v_effect.abc_command_id
       and o.request->>'session_id'=p_session_id::text
  ) then raise exception 'abc_qa_reconcile_efecto_fuera_de_sesion'; end if;
  select st.terminal_id into v_terminal
    from public.caja_sesion_terminales st
   where st.empresa_id=p_empresa_id and st.local_id=p_local_id and st.session_id=p_session_id and st.hasta is null
   order by st.desde,st.terminal_id limit 1;
  if v_terminal is null then raise exception 'abc_qa_reconcile_terminal_no_encontrado'; end if;

  v_operation_id:='qa.f5.c04.effect.compensate.'||replace(p_efecto_id::text,'-','');
  v_cmd:=private.abc_operacion_iniciar(
    v_operation_id,p_empresa_id,p_local_id,'ABC_QA_COMPENSAR_EFECTO_CIERRE',
    jsonb_build_object('session_id',p_session_id,'efecto_id',p_efecto_id,'motivo',v_motivo),v_terminal
  );
  if (v_cmd->>'replayed')::boolean then return coalesce(v_cmd->'resultado',v_cmd); end if;

  update public.efectos_pendientes
     set estado='COMPLETADO',completed_at=now(),locked_at=null,lease_until=null,
         worker_ref=null,next_attempt_at=null,
         last_error=jsonb_build_object('kind','QA_COMPENSACION','motivo',v_motivo,'actor_user_id',auth.uid(),'session_id',p_session_id)
   where id=p_efecto_id and estado in ('PENDIENTE','EN_PROCESO','ERROR');
  if not found then raise exception 'abc_qa_reconcile_efecto_cambio_concurrente'; end if;
  insert into public.abc_eventos(
    empresa_id,local_id,operation_id,aggregate_type,aggregate_id,event_type,payload,
    actor_user_id,terminal_id,occurred_at,operating_day
  ) values (
    p_empresa_id,p_local_id,v_operation_id,'EFECTO_PENDIENTE',p_efecto_id::text,
    'QA_EFECTO_COMPENSADO',jsonb_build_object('tipo',v_effect.tipo,'dedupe_key',v_effect.dedupe_key,
      'comanda_id',v_comanda_id,'pedido_id',(v_effect.payload->>'pedido_id')::uuid,'motivo',v_motivo,
      'estado_anterior',v_effect.estado,'estado','COMPLETADO'),auth.uid(),v_terminal,now(),current_date
  );
  v_result:=jsonb_build_object('ok',true,'efecto_id',p_efecto_id,'estado','COMPLETADO','operation_id',v_operation_id,'motivo',v_motivo);
  perform private.abc_operacion_completar(v_operation_id,v_result);
  return v_result;
end $function$;
