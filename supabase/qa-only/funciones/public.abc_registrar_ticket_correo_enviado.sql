CREATE OR REPLACE FUNCTION public.abc_registrar_ticket_correo_enviado(p_operation_id text, p_empresa_id text, p_local_id text, p_checkout_id uuid, p_email text, p_resend_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_cmd jsonb;
  v_request jsonb;
  v_result jsonb;
begin
  if auth.uid() is null or not private.abc_tiene_capacidad(p_empresa_id,p_local_id,'ABC_COBRO_INICIAR') then
    raise exception 'abc_ticket_correo_no_autorizado';
  end if;
  if p_operation_id is null or p_checkout_id is null or p_email is null then
    raise exception 'ticket_correo_registro_parametros_invalidos';
  end if;
  if not exists (
    select 1 from public.checkouts c
     where c.empresa_id=p_empresa_id and c.local_id=p_local_id and c.id=p_checkout_id
  ) then
    raise exception 'ticket_correo_checkout_no_encontrado';
  end if;

  v_request := jsonb_build_object('checkout_id',p_checkout_id,'email',p_email,'resend_id',p_resend_id);
  v_cmd := private.abc_operacion_iniciar(p_operation_id,p_empresa_id,p_local_id,'ABC_TICKET_CORREO_ENVIADO',v_request,null);
  if (v_cmd->>'replayed')::boolean then return coalesce(v_cmd->'resultado',v_cmd); end if;

  insert into public.abc_eventos(
    empresa_id,local_id,operation_id,aggregate_type,aggregate_id,event_type,
    payload,actor_user_id,terminal_id,occurred_at,operating_day
  ) values (
    p_empresa_id,p_local_id,p_operation_id,'TICKET_CORREO',p_checkout_id::text,'TICKET_CORREO_ENVIADO',
    jsonb_build_object('email',p_email,'resend_id',p_resend_id),
    auth.uid(),null,now(),current_date
  );

  v_result := jsonb_build_object('ok',true);
  perform private.abc_operacion_completar(p_operation_id,v_result);
  return v_result;
exception when others then
  begin perform private.abc_operacion_fallar(p_operation_id,jsonb_build_object('sqlstate',sqlstate,'message',sqlerrm)); exception when others then null; end;
  raise;
end $function$;
