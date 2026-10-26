-- Plan Maestro L&A Suite — Etapa 5, T6, punto 2: tecla de propina.
-- Hoja QA-4 (Pedro, 24/10/2026): "el cambio es propina".
--
-- No toca abc_iniciar_cobro ni abc_confirmar_efectivo (siguen exactamente
-- igual que hoy, probados y en producción). Esta RPC es una pieza aparte,
-- aditiva: registra, como un segundo movimiento, el cambio que el cliente
-- no se lleva como la propina de abc_cobros_no_venta (tabla ya existente
-- desde B06, pero sin ninguna función de alta hasta ahora) y su efecto en
-- caja, para que el arqueo del día no muestre una diferencia sin explicar.
--
-- No decide tratamiento fiscal, documental ni contable de la propina — eso
-- sigue PENDIENTE_ASESORIA en abc_b06_politica_conceptos. Solo lleva la
-- cuenta interna del dinero.

do $$
begin
  if to_regclass('public.abc_cobros_no_venta') is null
     or to_regclass('public.caja_operaciones') is null
     or to_regclass('public.pagos') is null
     or to_regclass('public.caja_sesiones') is null
     or to_regclass('public.caja_sesion_terminales') is null
     or to_regclass('public.abc_eventos') is null then
    raise exception 'T6_PROPINA_PREFLIGHT_FALLO: dependencias ausentes';
  end if;
  if to_regprocedure('private.abc_tiene_capacidad(text,text,text)') is null
     or to_regprocedure('private.abc_operacion_iniciar(text,text,text,text,jsonb,uuid)') is null
     or to_regprocedure('private.abc_operacion_completar(text,jsonb)') is null
     or to_regprocedure('private.abc_request_hash(jsonb)') is null then
    raise exception 'T6_PROPINA_PREFLIGHT_FALLO: helpers ausentes';
  end if;
  if to_regprocedure('public.abc_registrar_propina_efectivo(text,text,text,uuid,uuid,uuid,uuid,date,numeric)') is not null then
    raise exception 'T6_PROPINA_PREFLIGHT_FALLO: RPC ya existe';
  end if;
end $$;

create or replace function public.abc_registrar_propina_efectivo(
  p_operation_id text,
  p_empresa_id text,
  p_local_id text,
  p_pago_id uuid,
  p_caja_id uuid,
  p_session_id uuid,
  p_terminal_id uuid,
  p_operating_day date,
  p_importe numeric
)
returns jsonb
language plpgsql
volatile
security definer
set search_path=''
as $$
declare
  v_request jsonb;
  v_cmd jsonb;
  v_pago public.pagos%rowtype;
  v_importe numeric(24,8);
  v_propina_id uuid;
  v_caja_operation_id text;
  v_result jsonb;
begin
  if auth.uid() is null then
    raise exception 'abc_no_autenticado';
  end if;
  if not private.abc_tiene_capacidad(p_empresa_id,p_local_id,'ABC_COBRO_INICIAR') then
    raise exception 'abc_propina_no_autorizada';
  end if;
  if p_importe is null or p_importe <= 0 or p_importe <> round(p_importe,8) then
    raise exception 'abc_propina_importe_invalido';
  end if;
  if p_pago_id is null or p_operating_day is null then
    raise exception 'abc_propina_parametros_requeridos';
  end if;
  v_importe := p_importe::numeric(24,8);

  v_request := jsonb_build_object(
    'pago_id',p_pago_id,'importe',v_importe,
    'caja_id',p_caja_id,'session_id',p_session_id,'terminal_id',p_terminal_id,
    'operating_day',p_operating_day
  );
  v_cmd := private.abc_operacion_iniciar(
    p_operation_id,p_empresa_id,p_local_id,'ABC_REGISTRAR_PROPINA',v_request,p_terminal_id
  );
  if coalesce((v_cmd->>'replayed')::boolean,false) then
    return coalesce(v_cmd->'resultado',v_cmd);
  end if;

  select * into v_pago
    from public.pagos
   where id=p_pago_id and empresa_id=p_empresa_id and local_id=p_local_id
   for update;
  if not found then raise exception 'abc_propina_pago_no_encontrado'; end if;
  if v_pago.medio<>'EFECTIVO' then raise exception 'abc_propina_solo_efectivo'; end if;
  if v_pago.estado<>'CONFIRMADO' then raise exception 'abc_propina_pago_no_confirmado'; end if;
  if v_pago.cambio_entregado is null or v_pago.cambio_entregado<=0 then
    raise exception 'abc_propina_sin_cambio';
  end if;
  if v_importe<>round(v_pago.cambio_entregado,8) then
    raise exception 'abc_propina_importe_no_coincide';
  end if;

  if exists (
    select 1 from public.abc_cobros_no_venta c
     where c.empresa_id=p_empresa_id and c.local_id=p_local_id
       and c.concepto='PROPINA' and (c.datos->>'pago_id')=p_pago_id::text
  ) then
    raise exception 'abc_propina_ya_registrada';
  end if;

  perform 1 from public.caja_sesiones s
   where s.empresa_id=p_empresa_id and s.local_id=p_local_id and s.id=p_session_id
     and s.caja_id=p_caja_id and s.estado='ABIERTA' for update;
  if not found then raise exception 'sesion_caja_no_abierta'; end if;
  if not exists(select 1 from public.caja_sesion_terminales st
    where st.empresa_id=p_empresa_id and st.local_id=p_local_id
      and st.session_id=p_session_id and st.terminal_id=p_terminal_id and st.hasta is null) then
    raise exception 'terminal_no_vinculado_sesion';
  end if;

  insert into public.abc_cobros_no_venta(
    empresa_id,local_id,abc_command_id,concepto,importe,currency_code,medio,
    responsable_user_id,datos,operating_day,occurred_at,created_by
  ) values (
    p_empresa_id,p_local_id,p_operation_id,'PROPINA',v_importe,
    v_pago.payment_currency_code,'EFECTIVO',
    auth.uid(),
    jsonb_build_object('pago_id',p_pago_id,'checkout_id',v_pago.checkout_id,'origen','cambio_no_devuelto'),
    p_operating_day,now(),auth.uid()
  ) returning id into v_propina_id;

  v_caja_operation_id:='abc.propina.'||
    private.abc_request_hash(jsonb_build_object('command',p_operation_id,'propina_id',v_propina_id));
  insert into public.caja_operaciones(
    operation_id,tipo,empresa_id,local_id,fecha,importe,efecto_efectivo,medio_pago,
    concepto,origen_tipo,origen_id,payload,actor_user_id,abc_command_id,caja_id,
    session_id,terminal_id,currency_code,operating_day,occurred_at,categoria
  ) values (
    v_caja_operation_id,'ENTRADA',p_empresa_id,p_local_id,p_operating_day,
    v_importe,v_importe,'EFECTIVO','Propina en efectivo (cambio no devuelto)',
    'ABC_COBRO_NO_VENTA',v_propina_id::text,
    jsonb_build_object('pago_id',p_pago_id,'propina_id',v_propina_id),
    auth.uid(),p_operation_id,p_caja_id,p_session_id,p_terminal_id,
    v_pago.payment_currency_code,p_operating_day,now(),'PROPINA'
  );

  insert into public.abc_eventos(
    empresa_id,local_id,operation_id,aggregate_type,aggregate_id,event_type,
    payload,actor_user_id,terminal_id,occurred_at,operating_day
  ) values (
    p_empresa_id,p_local_id,p_operation_id,'COBRO_NO_VENTA',v_propina_id::text,'PROPINA_REGISTRADA',
    jsonb_build_object('pago_id',p_pago_id,'importe',v_importe,'caja_operation_id',v_caja_operation_id),
    auth.uid(),p_terminal_id,now(),p_operating_day
  );

  v_result:=jsonb_build_object('ok',true,'propina_id',v_propina_id,'pago_id',p_pago_id,
    'importe',v_importe,'caja_operation_id',v_caja_operation_id);
  perform private.abc_operacion_completar(p_operation_id,v_result);
  return v_result;
end;
$$;

comment on function public.abc_registrar_propina_efectivo is
  'T6 Hoja QA-4: registra como propina el cambio no devuelto de un pago en EFECTIVO ya confirmado. Lleva la cuenta interna del dinero; no decide tratamiento fiscal.';

revoke all on function public.abc_registrar_propina_efectivo(text,text,text,uuid,uuid,uuid,uuid,date,numeric)
  from public, anon, authenticated;
grant execute on function public.abc_registrar_propina_efectivo(text,text,text,uuid,uuid,uuid,uuid,date,numeric)
  to authenticated;
