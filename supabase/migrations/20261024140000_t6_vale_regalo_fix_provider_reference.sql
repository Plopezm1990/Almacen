-- Plan Maestro L&A Suite — Etapa 5, T6, punto 5: vale regalo.
-- Corrección encontrada en prueba en vivo (Cowork, 24/10/2026).
--
-- abc_confirmar_pago_vale_regalo llamaba a abc_resolver_intento con
-- p_provider_reference := v_vale.codigo — el código del propio vale.
-- pago_intentos tiene un índice único sobre
-- (empresa_id, provider_code, provider_reference), así que una SEGUNDA
-- aplicación del MISMO vale (algo legítimo: un vale puede aplicarse como
-- pago parcial y quedarle saldo para una compra futura) chocaba siempre
-- con el registro ya creado por la primera aplicación, reventando con
-- "duplicate key value violates unique constraint
-- "abc_intento_provider_reference_uq"" — un error crudo de base de datos,
-- no un mensaje de negocio.
--
-- El código del vale nunca debía usarse como referencia única: una
-- "provider_reference" identifica un INTENTO de pago concreto, no el
-- vale. Corregido con el mismo patrón ya usado por el resolutor de
-- tarjeta simulada de QA-3 (abc_qa_confirmar_pago_simulado), que deriva
-- su referencia del propio p_intento_id. El código del vale queda, de
-- todas formas, en el snapshot para la trazabilidad.

create or replace function public.abc_confirmar_pago_vale_regalo(
  p_operation_id text,
  p_empresa_id text,
  p_local_id text,
  p_intento_id uuid,
  p_codigo text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path=''
as $$
declare
  v_request jsonb; v_cmd jsonb; v_result jsonb; v_resolucion jsonb;
  v_intento public.pago_intentos%rowtype;
  v_pago public.pagos%rowtype;
  v_vale public.abc_vales_regalo%rowtype;
  v_codigo text := upper(btrim(coalesce(p_codigo,'')));
  v_nuevo_saldo numeric(24,8);
  v_reference text;
begin
  if auth.uid() is null or not private.abc_tiene_capacidad(p_empresa_id,p_local_id,'ABC_COBRO_INICIAR') then
    raise exception 'abc_vale_regalo_no_autorizado';
  end if;
  if p_intento_id is null or v_codigo = '' then raise exception 'vale_regalo_pago_parametros_invalidos'; end if;

  v_request:=jsonb_build_object('intento_id',p_intento_id,'codigo',v_codigo);
  v_cmd:=private.abc_operacion_iniciar(p_operation_id,p_empresa_id,p_local_id,'ABC_CONFIRMAR_PAGO_VALE_REGALO',v_request,null);
  if (v_cmd->>'replayed')::boolean then return coalesce(v_cmd->'resultado',v_cmd); end if;

  select * into v_intento from public.pago_intentos
   where empresa_id=p_empresa_id and local_id=p_local_id and id=p_intento_id for update;
  if not found then raise exception 'vale_regalo_intento_no_encontrado'; end if;
  select * into v_pago from public.pagos
   where empresa_id=p_empresa_id and local_id=p_local_id and id=v_intento.pago_id for update;
  if not found then raise exception 'vale_regalo_pago_no_encontrado'; end if;
  if v_pago.medio <> 'OTRO' then raise exception 'vale_regalo_medio_incorrecto'; end if;
  if v_intento.estado <> 'PENDIENTE' then raise exception 'vale_regalo_intento_ya_resuelto'; end if;

  select * into v_vale from public.abc_vales_regalo v
   where v.empresa_id=p_empresa_id and v.local_id=p_local_id and v.codigo=v_codigo for update;
  if not found then raise exception 'vale_regalo_no_encontrado'; end if;
  if v_vale.estado <> 'ACTIVO' then raise exception 'vale_regalo_no_activo'; end if;
  if v_vale.saldo_actual < v_pago.importe_objetivo then raise exception 'vale_regalo_saldo_insuficiente'; end if;

  v_nuevo_saldo := v_vale.saldo_actual - v_pago.importe_objetivo;
  update public.abc_vales_regalo
     set saldo_actual = v_nuevo_saldo,
         estado = case when v_nuevo_saldo = 0 then 'AGOTADO' else estado end,
         updated_at = now()
   where id = v_vale.id;

  v_reference := 'VALE-REGALO-' || replace(p_intento_id::text,'-','');
  v_resolucion := public.abc_resolver_intento(
    'vale.regalo.resolver.' || replace(p_intento_id::text,'-',''),
    p_empresa_id, p_local_id, p_intento_id, 'CONFIRMADO',
    'VALE_REGALO', v_reference,
    v_pago.importe_objetivo, v_pago.importe_objetivo, v_pago.importe_objetivo,
    jsonb_build_object('vale_id', v_vale.id, 'codigo', v_vale.codigo, 'modo', 'VALE_REGALO')
  );

  insert into public.abc_eventos(
    empresa_id,local_id,operation_id,aggregate_type,aggregate_id,event_type,payload,actor_user_id,terminal_id,occurred_at,operating_day
  ) values (
    p_empresa_id,p_local_id,p_operation_id,'VALE_REGALO',v_vale.id::text,'VALE_REGALO_CANJEADO',
    jsonb_build_object('pago_id',v_pago.id,'intento_id',p_intento_id,'importe',v_pago.importe_objetivo,'saldo_restante',v_nuevo_saldo),
    auth.uid(),null,now(),current_date
  );

  v_result:=jsonb_build_object('ok',true,'vale_id',v_vale.id,'codigo',v_vale.codigo,'importe_aplicado',v_pago.importe_objetivo,'saldo_restante',v_nuevo_saldo,'resolucion',v_resolucion);
  perform private.abc_operacion_completar(p_operation_id,v_result);
  return v_result;
exception when others then
  begin perform private.abc_operacion_fallar(p_operation_id,jsonb_build_object('sqlstate',sqlstate,'message',sqlerrm)); exception when others then null; end;
  raise;
end $$;
