-- Plan Maestro L&A Suite — Etapa 5, T7: impresión y cajón (modo simulador).
-- Corrección encontrada en prueba en vivo (Cowork, 24/10/2026).
--
-- abc_simular_impresion_ticket comprobaba v_checkout.estado <> 'PAGADO'.
-- Pero "PAGADO" no es un valor posible de checkouts.estado — ese campo
-- solo admite 'ABIERTO', 'EN_COBRO', 'COMPLETADO' o 'CANCELADO'
-- (abc_checkout_estado). "PAGADO" es el estado AGREGADO que calcula
-- abc_estado_cobro_cuenta para la pantalla, no el valor real de la
-- columna. Por eso "Imprimir ticket" rechazaba siempre con
-- "Solo se puede imprimir el ticket cuando la cuenta está pagada por
-- completo", incluso con una cuenta genuinamente pagada por completo
-- (confirmado en QA: el checkout real tenía estado='COMPLETADO').
--
-- Corregido comparando contra el valor real: 'COMPLETADO'.

create or replace function public.abc_simular_impresion_ticket(
  p_operation_id text,
  p_empresa_id text,
  p_local_id text,
  p_equipo_id uuid,
  p_checkout_id uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path=''
as $$
declare
  v_cmd jsonb; v_request jsonb; v_result jsonb;
  v_equipo public.abc_local_equipos%rowtype;
  v_checkout public.checkouts%rowtype;
begin
  if auth.uid() is null or not private.abc_tiene_capacidad(p_empresa_id,p_local_id,'ABC_COBRO_INICIAR') then
    raise exception 'abc_impresion_no_autorizada';
  end if;
  if p_equipo_id is null or p_checkout_id is null then raise exception 'impresion_parametros_requeridos'; end if;

  v_request := jsonb_build_object('equipo_id',p_equipo_id,'checkout_id',p_checkout_id);
  v_cmd := private.abc_operacion_iniciar(p_operation_id,p_empresa_id,p_local_id,'ABC_SIMULAR_IMPRESION_TICKET',v_request,null);
  if (v_cmd->>'replayed')::boolean then return coalesce(v_cmd->'resultado',v_cmd); end if;

  select * into v_equipo from public.abc_local_equipos e
   where e.empresa_id=p_empresa_id and e.local_id=p_local_id and e.id=p_equipo_id;
  if not found then raise exception 'impresion_equipo_no_encontrado'; end if;
  if not v_equipo.activo then raise exception 'impresion_equipo_inactivo'; end if;
  if v_equipo.tipo <> 'IMPRESORA_TICKET' then raise exception 'impresion_equipo_tipo_incorrecto'; end if;

  select * into v_checkout from public.checkouts c
   where c.empresa_id=p_empresa_id and c.local_id=p_local_id and c.id=p_checkout_id;
  if not found then raise exception 'impresion_checkout_no_encontrado'; end if;
  if v_checkout.estado <> 'COMPLETADO' then raise exception 'impresion_cuenta_no_pagada'; end if;

  insert into public.abc_eventos(
    empresa_id,local_id,operation_id,aggregate_type,aggregate_id,event_type,payload,actor_user_id,terminal_id,occurred_at,operating_day
  ) values (
    p_empresa_id,p_local_id,p_operation_id,'EQUIPO',p_equipo_id::text,'TRABAJO_IMPRESION_SIMULADO',
    jsonb_build_object('equipo_nombre',v_equipo.nombre,'checkout_id',p_checkout_id,'modo','SIMULADO'),
    auth.uid(),v_equipo.terminal_id,now(),v_checkout.operating_day
  );

  v_result := jsonb_build_object(
    'ok',true,'equipo_id',v_equipo.id,'equipo_nombre',v_equipo.nombre,
    'mensaje','Se habría impreso el ticket en '||v_equipo.nombre||' (modo simulador: no hay conexión real con el aparato).'
  );
  perform private.abc_operacion_completar(p_operation_id,v_result);
  return v_result;
exception when others then
  begin perform private.abc_operacion_fallar(p_operation_id,jsonb_build_object('sqlstate',sqlstate,'message',sqlerrm)); exception when others then null; end;
  raise;
end $$;
