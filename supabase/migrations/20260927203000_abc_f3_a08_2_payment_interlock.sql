-- ABC F3 A08.2.1 — interlock autoritativo entre reparto de cuenta y cobro.
-- Aditiva: no crea tablas ni altera datos existentes. Reemplaza RPC manteniendo firmas/ACL.
-- Objetivo: serializar A08 con el ciclo de cobro y bloquear reparto/unión si existe
-- PENDIENTE/AUTORIZADO/DESCONOCIDO o una reserva ACTIVA para la cuenta.

do $$
declare
  v_missing text[]:=array[]::text[];
begin
  if to_regclass('public.cuentas_comerciales') is null then v_missing:=array_append(v_missing,'cuentas_comerciales'); end if;
  if to_regclass('public.checkouts') is null then v_missing:=array_append(v_missing,'checkouts'); end if;
  if to_regclass('public.checkout_ventas') is null then v_missing:=array_append(v_missing,'checkout_ventas'); end if;
  if to_regclass('public.pagos') is null then v_missing:=array_append(v_missing,'pagos'); end if;
  if to_regclass('public.pago_intentos') is null then v_missing:=array_append(v_missing,'pago_intentos'); end if;
  if to_regclass('public.reservas_saldo') is null then v_missing:=array_append(v_missing,'reservas_saldo'); end if;
  if to_regprocedure('public.abc_mover_cantidad_linea_cuenta(text,text,text,uuid,uuid,uuid,numeric,text,bigint,bigint,bigint,uuid,uuid,date)') is null then v_missing:=array_append(v_missing,'abc_mover_cantidad_linea_cuenta'); end if;
  if to_regprocedure('public.abc_asignar_cuota_importe(text,text,text,uuid,uuid,numeric,text,bigint,bigint,uuid,uuid,date)') is null then v_missing:=array_append(v_missing,'abc_asignar_cuota_importe'); end if;
  if to_regprocedure('public.abc_revertir_cuota_importe(text,text,text,uuid,bigint,bigint,bigint,uuid,uuid,date)') is null then v_missing:=array_append(v_missing,'abc_revertir_cuota_importe'); end if;
  if to_regprocedure('public.abc_unir_cuentas(text,text,text,uuid,uuid,text,bigint,bigint,uuid,uuid,date)') is null then v_missing:=array_append(v_missing,'abc_unir_cuentas'); end if;
  if to_regprocedure('public.abc_iniciar_cobro(text,text,text,uuid,uuid,uuid,text,numeric,text,uuid,numeric,numeric)') is null then v_missing:=array_append(v_missing,'abc_iniciar_cobro'); end if;
  if to_regprocedure('public.abc_confirmar_efectivo(text,text,text,uuid,uuid,uuid,uuid,date)') is null then v_missing:=array_append(v_missing,'abc_confirmar_efectivo'); end if;
  if to_regprocedure('public.abc_resolver_intento(text,text,text,uuid,text,text,text,numeric,numeric,numeric,jsonb)') is null then v_missing:=array_append(v_missing,'abc_resolver_intento'); end if;
  if cardinality(v_missing)>0 then
    raise exception 'ABC_F3_A08_2_PREFLIGHT_FALLO:%',array_to_string(v_missing,',');
  end if;
  if to_regprocedure('private.abc_cuenta_tiene_cobro_incierto(text,text,uuid)') is not null
     or to_regprocedure('private.abc_bloquear_cuenta_cobro_interlock(text,text,uuid)') is not null
     or to_regprocedure('private.abc_exigir_cuenta_sin_cobro_incierto(text,text,uuid)') is not null then
    raise exception 'ABC_F3_A08_2_PREFLIGHT_FALLO: helpers A08.2.1 ya existen';
  end if;
end $$;

create function private.abc_cuenta_tiene_cobro_incierto(
  p_empresa_id text,
  p_local_id text,
  p_cuenta_id uuid
)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select
    exists(
      select 1
      from public.checkouts c
      join public.pagos p
        on p.empresa_id=c.empresa_id
       and p.local_id=c.local_id
       and p.checkout_id=c.id
      where c.empresa_id=$1
        and c.local_id=$2
        and c.cuenta_id=$3
        and p.estado in ('PENDIENTE','AUTORIZADO','DESCONOCIDO')
    )
    or exists(
      select 1
      from public.checkouts c
      join public.pagos p
        on p.empresa_id=c.empresa_id
       and p.local_id=c.local_id
       and p.checkout_id=c.id
      join public.pago_intentos i
        on i.empresa_id=p.empresa_id
       and i.local_id=p.local_id
       and i.pago_id=p.id
      where c.empresa_id=$1
        and c.local_id=$2
        and c.cuenta_id=$3
        and i.estado in ('PENDIENTE','AUTORIZADO','DESCONOCIDO')
    )
    or exists(
      select 1
      from public.checkouts c
      join public.checkout_ventas cv
        on cv.empresa_id=c.empresa_id
       and cv.local_id=c.local_id
       and cv.checkout_id=c.id
      join public.reservas_saldo r
        on r.empresa_id=cv.empresa_id
       and r.local_id=cv.local_id
       and r.checkout_venta_id=cv.id
      where c.empresa_id=$1
        and c.local_id=$2
        and c.cuenta_id=$3
        and r.estado='ACTIVA'
    )
$$;

create function private.abc_bloquear_cuenta_cobro_interlock(
  p_empresa_id text,
  p_local_id text,
  p_cuenta_id uuid
)
returns void
language plpgsql
volatile
security definer
set search_path=''
as $$
begin
  if p_cuenta_id is null then raise exception 'cuenta_interlock_requerida'; end if;
  perform 1
    from public.cuentas_comerciales c
   where c.empresa_id=p_empresa_id
     and c.local_id=p_local_id
     and c.id=p_cuenta_id
   for update;
  if not found then raise exception 'cuenta_interlock_no_encontrada'; end if;
end $$;

create function private.abc_exigir_cuenta_sin_cobro_incierto(
  p_empresa_id text,
  p_local_id text,
  p_cuenta_id uuid
)
returns void
language plpgsql
stable
security definer
set search_path=''
as $$
begin
  if private.abc_cuenta_tiene_cobro_incierto(p_empresa_id,p_local_id,p_cuenta_id) then
    raise exception 'cuenta_con_cobro_incierto';
  end if;
end $$;

CREATE OR REPLACE FUNCTION public.abc_iniciar_cobro(p_operation_id text, p_empresa_id text, p_local_id text, p_checkout_id uuid, p_pago_id uuid, p_intento_id uuid, p_medio text, p_importe_objetivo numeric, p_payment_currency_code text, p_terminal_id uuid, p_importe_recibido numeric DEFAULT NULL::numeric, p_cambio_entregado numeric DEFAULT NULL::numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_cmd jsonb; v_request jsonb; v_medio text:=upper(btrim(coalesce(p_medio,'')));
  v_payment_currency text:=upper(btrim(coalesce(p_payment_currency_code,'')));
  v_sale_currency text; v_operating_day date; v_cuenta_id uuid; v_total numeric(24,8):=0;
  v_restante numeric(24,8); v_disponible numeric(24,8); v_asignado numeric(24,8);
  v_ids uuid[]; r record; v_result jsonb;
begin
  if auth.uid() is null
     or not private.abc_tiene_capacidad(p_empresa_id,p_local_id,'ABC_COBRO_INICIAR') then
    raise exception 'abc_cobro_no_autorizado';
  end if;
  if v_medio='EFECTIVO'
     and not private.abc_tiene_capacidad(p_empresa_id,p_local_id,'ABC_COBRO_EFECTIVO') then
    raise exception 'abc_efectivo_no_autorizado';
  end if;
  if p_checkout_id is null or p_pago_id is null or p_intento_id is null or p_terminal_id is null then
    raise exception 'cobro_parametros_requeridos';
  end if;
  if v_medio not in ('EFECTIVO','TARJETA','TRANSFERENCIA','OTRO') then raise exception 'medio_pago_invalido'; end if;
  if p_importe_objetivo is null or p_importe_objetivo<=0 then raise exception 'importe_pago_invalido'; end if;
  if v_payment_currency !~ '^[A-Z]{3}$' then raise exception 'moneda_pago_invalida'; end if;

  v_request:=jsonb_build_object(
    'checkout_id',p_checkout_id,'pago_id',p_pago_id,'intento_id',p_intento_id,
    'medio',v_medio,'importe_objetivo',p_importe_objetivo,
    'payment_currency_code',v_payment_currency,'terminal_id',p_terminal_id,
    'importe_recibido',p_importe_recibido,'cambio_entregado',p_cambio_entregado
  );
  v_cmd:=private.abc_operacion_iniciar(
    p_operation_id,p_empresa_id,p_local_id,'ABC_INICIAR_COBRO',v_request,p_terminal_id
  );
  if (v_cmd->>'replayed')::boolean then return coalesce(v_cmd->'resultado',v_cmd); end if;

  select c.currency_code,c.operating_day,c.cuenta_id into v_sale_currency,v_operating_day,v_cuenta_id
    from public.checkouts c
   where c.empresa_id=p_empresa_id and c.local_id=p_local_id and c.id=p_checkout_id
     and c.estado in ('ABIERTO','EN_COBRO') for update;
  if not found then raise exception 'checkout_no_cobrable'; end if;
  if v_payment_currency<>v_sale_currency then raise exception 'conversion_divisa_no_habilitada'; end if;
  perform private.abc_bloquear_cuenta_cobro_interlock(p_empresa_id,p_local_id,v_cuenta_id);

  select array_agg(cv.venta_fiscal_id order by cv.venta_fiscal_id) into v_ids
    from public.checkout_ventas cv
   where cv.empresa_id=p_empresa_id and cv.local_id=p_local_id and cv.checkout_id=p_checkout_id;
  if v_ids is null then raise exception 'checkout_sin_ventas'; end if;
  perform private.abc_bloquear_ventas(p_empresa_id,p_local_id,v_ids);

  for r in select cv.id,cv.venta_fiscal_id from public.checkout_ventas cv
    where cv.empresa_id=p_empresa_id and cv.local_id=p_local_id and cv.checkout_id=p_checkout_id
    order by cv.venta_fiscal_id,cv.id
  loop
    v_total:=v_total+private.abc_saldo_disponible(p_empresa_id,p_local_id,r.venta_fiscal_id);
  end loop;
  if p_importe_objetivo>v_total then raise exception 'saldo_insuficiente'; end if;

  if v_medio='EFECTIVO' then
    if p_importe_recibido is null or p_cambio_entregado is null
       or p_importe_recibido<p_importe_objetivo or p_cambio_entregado<0
       or p_importe_recibido-p_cambio_entregado<>p_importe_objetivo then
      raise exception 'efectivo_recibido_cambio_inconsistente';
    end if;
  elsif p_importe_recibido is not null or p_cambio_entregado is not null then
    raise exception 'efectivo_solo_para_medio_efectivo';
  end if;

  insert into public.pagos(
    id,empresa_id,local_id,checkout_id,medio,estado,sale_currency_code,payment_currency_code,
    importe_objetivo,importe_recibido,cambio_entregado,version,created_by
  ) values (
    p_pago_id,p_empresa_id,p_local_id,p_checkout_id,v_medio,'PENDIENTE',
    v_sale_currency,v_payment_currency,p_importe_objetivo,p_importe_recibido,p_cambio_entregado,1,auth.uid()
  );
  insert into public.pago_intentos(
    id,empresa_id,local_id,pago_id,abc_command_id,estado,requested_amount,payment_currency_code,
    authorization_status,capture_status,settlement_status
  ) values (
    p_intento_id,p_empresa_id,p_local_id,p_pago_id,p_operation_id,'PENDIENTE',
    p_importe_objetivo,v_payment_currency,
    case when v_medio='EFECTIVO' then 'NO_APLICA' else 'PENDIENTE' end,
    case when v_medio='EFECTIVO' then 'NO_APLICA' else 'PENDIENTE' end,
    case when v_medio='EFECTIVO' then 'NO_APLICA' else 'PENDIENTE' end
  );

  v_restante:=p_importe_objetivo;
  for r in select cv.id,cv.venta_fiscal_id from public.checkout_ventas cv
    where cv.empresa_id=p_empresa_id and cv.local_id=p_local_id and cv.checkout_id=p_checkout_id
    order by cv.venta_fiscal_id,cv.id
  loop
    exit when v_restante<=0;
    v_disponible:=private.abc_saldo_disponible(p_empresa_id,p_local_id,r.venta_fiscal_id);
    if v_disponible>0 then
      v_asignado:=least(v_restante,v_disponible);
      insert into public.reservas_saldo(
        id,empresa_id,local_id,intento_id,checkout_venta_id,venta_fiscal_id,
        sale_currency_code,importe_reservado,estado
      ) values (
        gen_random_uuid(),p_empresa_id,p_local_id,p_intento_id,r.id,
        r.venta_fiscal_id,v_sale_currency,v_asignado,'ACTIVA'
      );
      v_restante:=v_restante-v_asignado;
    end if;
  end loop;
  if v_restante<>0 then raise exception 'reserva_incompleta'; end if;

  update public.checkouts set estado='EN_COBRO',
    version=case when estado='ABIERTO' then version+1 else version end
   where empresa_id=p_empresa_id and local_id=p_local_id and id=p_checkout_id;

  insert into public.abc_eventos(
    empresa_id,local_id,operation_id,aggregate_type,aggregate_id,event_type,
    payload,actor_user_id,terminal_id,occurred_at,operating_day
  ) values (
    p_empresa_id,p_local_id,p_operation_id,'PAGO',p_pago_id::text,'PAGO_INTENTO_INICIADO',
    jsonb_build_object('checkout_id',p_checkout_id,'intento_id',p_intento_id,
      'medio',v_medio,'importe',p_importe_objetivo,'currency_code',v_payment_currency),
    auth.uid(),p_terminal_id,now(),v_operating_day
  );


  if v_medio<>'EFECTIVO' then
    perform private.abc_encolar_efecto(
      p_empresa_id,p_local_id,p_operation_id,
      'PROVIDER_COBRO',
      'pago-intento:'||p_intento_id::text,
      jsonb_build_object(
        'pago_id',p_pago_id,
        'intento_id',p_intento_id,
        'checkout_id',p_checkout_id,
        'medio',v_medio,
        'importe',p_importe_objetivo,
        'currency_code',v_payment_currency,
        'terminal_id',p_terminal_id,
        'operating_day',v_operating_day
      )
    );
  end if;

  v_result:=jsonb_build_object('ok',true,'pago_id',p_pago_id,'intento_id',p_intento_id,
    'estado','PENDIENTE','importe_reservado',p_importe_objetivo);
  perform private.abc_operacion_completar(p_operation_id,v_result);
  return v_result;
end $function$;

CREATE OR REPLACE FUNCTION public.abc_confirmar_efectivo(p_operation_id text, p_empresa_id text, p_local_id text, p_intento_id uuid, p_caja_id uuid, p_session_id uuid, p_terminal_id uuid, p_operating_day date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_cmd jsonb; v_request jsonb; v_pago public.pagos%rowtype;
  v_aplicado numeric(24,8); v_checkout_estado text; v_cash_operation_id text;
  v_ids uuid[]; v_cuenta_id uuid; v_result jsonb;
begin
  if auth.uid() is null
     or not private.abc_tiene_capacidad(p_empresa_id,p_local_id,'ABC_COBRO_EFECTIVO') then
    raise exception 'abc_efectivo_no_autorizado';
  end if;
  v_request:=jsonb_build_object('intento_id',p_intento_id,'caja_id',p_caja_id,
    'session_id',p_session_id,'terminal_id',p_terminal_id,'operating_day',p_operating_day);
  v_cmd:=private.abc_operacion_iniciar(
    p_operation_id,p_empresa_id,p_local_id,'ABC_CONFIRMAR_EFECTIVO',v_request,p_terminal_id
  );
  if (v_cmd->>'replayed')::boolean then return coalesce(v_cmd->'resultado',v_cmd); end if;

  select p.* into v_pago
    from public.pago_intentos i
    join public.pagos p on p.empresa_id=i.empresa_id and p.local_id=i.local_id and p.id=i.pago_id
   where i.empresa_id=p_empresa_id and i.local_id=p_local_id and i.id=p_intento_id
     and i.estado in ('PENDIENTE','AUTORIZADO') for update of i,p;
  if not found then raise exception 'intento_efectivo_no_confirmable'; end if;
  if v_pago.medio<>'EFECTIVO' then raise exception 'intento_no_efectivo'; end if;

  select c.cuenta_id into v_cuenta_id
    from public.checkouts c
   where c.empresa_id=p_empresa_id and c.local_id=p_local_id and c.id=v_pago.checkout_id;
  if v_cuenta_id is null then raise exception 'checkout_no_encontrado'; end if;
  perform private.abc_bloquear_cuenta_cobro_interlock(p_empresa_id,p_local_id,v_cuenta_id);

  perform 1 from public.caja_sesiones s
   where s.empresa_id=p_empresa_id and s.local_id=p_local_id and s.id=p_session_id
     and s.caja_id=p_caja_id and s.estado='ABIERTA' for update;
  if not found then raise exception 'sesion_caja_no_abierta'; end if;
  if not exists(select 1 from public.caja_sesion_terminales st
    where st.empresa_id=p_empresa_id and st.local_id=p_local_id
      and st.session_id=p_session_id and st.terminal_id=p_terminal_id and st.hasta is null) then
    raise exception 'terminal_no_vinculado_sesion';
  end if;

  select array_agg(venta_fiscal_id order by venta_fiscal_id) into v_ids
    from public.reservas_saldo
   where empresa_id=p_empresa_id and local_id=p_local_id
     and intento_id=p_intento_id and estado='ACTIVA';
  if v_ids is null then raise exception 'reservas_activas_requeridas'; end if;
  perform private.abc_bloquear_ventas(p_empresa_id,p_local_id,v_ids);
  v_aplicado:=private.abc_aplicar_intento_confirmado(p_empresa_id,p_local_id,p_intento_id);

  update public.pago_intentos set estado='CONFIRMADO',
    authorized_amount=requested_amount,captured_amount=requested_amount,
    authorization_status='NO_APLICA',capture_status='NO_APLICA',settlement_status='NO_APLICA',
    resolved_at=now()
   where id=p_intento_id;
  update public.pagos set estado='CONFIRMADO',resolved_at=now(),version=version+1
   where id=v_pago.id;

  v_cash_operation_id:='abc.cash.'||
    private.abc_request_hash(jsonb_build_object('command',p_operation_id,'pago_id',v_pago.id));
  insert into public.caja_operaciones(
    operation_id,tipo,empresa_id,local_id,fecha,importe,efecto_efectivo,medio_pago,
    concepto,origen_tipo,origen_id,payload,actor_user_id,abc_command_id,caja_id,
    session_id,terminal_id,currency_code,operating_day,occurred_at,categoria
  ) values (
    v_cash_operation_id,'ENTRADA',p_empresa_id,p_local_id,p_operating_day,
    v_pago.importe_objetivo,v_pago.importe_objetivo,'EFECTIVO','Cobro ABC en efectivo',
    'ABC_PAGO',v_pago.id::text,
    jsonb_build_object('pago_id',v_pago.id,'intento_id',p_intento_id,
      'importe_recibido',v_pago.importe_recibido,'cambio_entregado',v_pago.cambio_entregado),
    auth.uid(),p_operation_id,p_caja_id,p_session_id,p_terminal_id,
    v_pago.payment_currency_code,p_operating_day,now(),'COBRO_VENTA'
  );

  v_checkout_estado:=private.abc_actualizar_checkout_estado(
    p_empresa_id,p_local_id,v_pago.checkout_id
  );
  insert into public.abc_eventos(
    empresa_id,local_id,operation_id,aggregate_type,aggregate_id,event_type,
    payload,actor_user_id,terminal_id,occurred_at,operating_day
  ) values (
    p_empresa_id,p_local_id,p_operation_id,'PAGO',v_pago.id::text,'PAGO_EFECTIVO_CONFIRMADO',
    jsonb_build_object('intento_id',p_intento_id,'aplicado',v_aplicado,
      'caja_operation_id',v_cash_operation_id,'checkout_estado',v_checkout_estado),
    auth.uid(),p_terminal_id,now(),p_operating_day
  );

  v_result:=jsonb_build_object('ok',true,'pago_id',v_pago.id,'intento_id',p_intento_id,
    'estado','CONFIRMADO','aplicado',v_aplicado,'caja_operation_id',v_cash_operation_id,
    'checkout_estado',v_checkout_estado);
  perform private.abc_operacion_completar(p_operation_id,v_result);
  return v_result;
end $function$;

CREATE OR REPLACE FUNCTION public.abc_resolver_intento(p_operation_id text, p_empresa_id text, p_local_id text, p_intento_id uuid, p_estado text, p_provider_code text, p_provider_reference text, p_authorized_amount numeric, p_captured_amount numeric, p_settled_amount numeric, p_provider_snapshot jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_estado text:=upper(btrim(coalesce(p_estado,'')));
  v_provider text:=nullif(btrim(coalesce(p_provider_code,'')),'');
  v_reference text:=nullif(btrim(coalesce(p_provider_reference,'')),'');
  v_request jsonb; v_cmd jsonb; v_intento public.pago_intentos%rowtype;
  v_pago public.pagos%rowtype; v_terminal uuid; v_day date; v_cuenta_id uuid;
  v_aplicado numeric(24,8):=0; v_liberado numeric(24,8):=0;
  v_checkout_estado text; v_ids uuid[]; v_result jsonb;
begin
  if v_estado not in ('AUTORIZADO','CONFIRMADO','RECHAZADO','CANCELADO','DESCONOCIDO') then
    raise exception 'estado_resolucion_invalido';
  end if;
  if v_provider is null or v_reference is null then raise exception 'provider_requerido'; end if;

  select * into v_intento from public.pago_intentos
   where empresa_id=p_empresa_id and local_id=p_local_id and id=p_intento_id;
  if not found then raise exception 'intento_no_encontrado'; end if;
  select * into v_pago from public.pagos
   where empresa_id=p_empresa_id and local_id=p_local_id and id=v_intento.pago_id;
  if v_pago.medio='EFECTIVO' then raise exception 'efectivo_usa_confirmacion_local'; end if;
  select terminal_id into v_terminal from public.abc_operaciones where operation_id=v_intento.abc_command_id;
  select operating_day into v_day from public.checkouts
   where empresa_id=p_empresa_id and local_id=p_local_id and id=v_pago.checkout_id;

  v_request:=jsonb_build_object('intento_id',p_intento_id,'estado',v_estado,
    'provider_code',v_provider,'provider_reference',v_reference,
    'authorized_amount',p_authorized_amount,'captured_amount',p_captured_amount,
    'settled_amount',p_settled_amount,'provider_snapshot',coalesce(p_provider_snapshot,'{}'::jsonb));
  v_cmd:=private.abc_operacion_iniciar_sistema(
    p_operation_id,p_empresa_id,p_local_id,'ABC_RESOLVER_INTENTO',
    v_request,v_pago.created_by,v_terminal,v_provider
  );
  if (v_cmd->>'replayed')::boolean then return coalesce(v_cmd->'resultado',v_cmd); end if;

  select * into v_intento from public.pago_intentos
   where empresa_id=p_empresa_id and local_id=p_local_id and id=p_intento_id for update;
  select * into v_pago from public.pagos
   where empresa_id=p_empresa_id and local_id=p_local_id and id=v_intento.pago_id for update;

  select c.cuenta_id into v_cuenta_id
    from public.checkouts c
   where c.empresa_id=p_empresa_id and c.local_id=p_local_id and c.id=v_pago.checkout_id;
  if v_cuenta_id is null then raise exception 'checkout_no_encontrado'; end if;
  perform private.abc_bloquear_cuenta_cobro_interlock(p_empresa_id,p_local_id,v_cuenta_id);

  if v_intento.estado in ('CONFIRMADO','RECHAZADO','CANCELADO') then
    if v_intento.estado=v_estado
       and v_intento.provider_code is not distinct from v_provider
       and v_intento.provider_reference is not distinct from v_reference
       and v_intento.authorized_amount is not distinct from
         (case when v_estado='CONFIRMADO'
               then coalesce(p_authorized_amount,p_captured_amount)
               else p_authorized_amount end)
       and v_intento.captured_amount is not distinct from p_captured_amount
       and v_intento.settled_amount is not distinct from p_settled_amount then
      perform private.abc_completar_efecto_dedupe(
        p_empresa_id,'pago-intento:'||p_intento_id::text
      );
      v_result:=jsonb_build_object(
        'ok',true,'already_resolved',true,
        'intento_id',p_intento_id,'pago_id',v_pago.id,
        'estado',v_estado
      );
      perform private.abc_operacion_completar(p_operation_id,v_result);
      return v_result;
    end if;
    raise exception 'intento_ya_resuelto';
  end if;
  if v_intento.provider_code is not null
     and (v_intento.provider_code<>v_provider
          or v_intento.provider_reference is distinct from v_reference) then
    raise exception 'provider_reference_conflict';
  end if;

  if v_estado='AUTORIZADO' then
    if p_authorized_amount is null or p_authorized_amount<=0
       or p_authorized_amount>v_intento.requested_amount then
      raise exception 'importe_autorizado_invalido';
    end if;
    update public.pago_intentos set estado='AUTORIZADO',
      provider_code=v_provider,provider_reference=v_reference,
      authorized_amount=p_authorized_amount,captured_amount=null,settled_amount=null,
      authorization_status='AUTORIZADO',capture_status='PENDIENTE',
      settlement_status='PENDIENTE',provider_snapshot=coalesce(p_provider_snapshot,'{}'::jsonb),
      resolved_at=null where id=p_intento_id;
    update public.pagos set estado='AUTORIZADO',resolved_at=null,version=version+1 where id=v_pago.id;
  elsif v_estado='DESCONOCIDO' then
    update public.pago_intentos set estado='DESCONOCIDO',
      provider_code=v_provider,provider_reference=v_reference,
      authorized_amount=p_authorized_amount,captured_amount=p_captured_amount,
      settled_amount=p_settled_amount,
      authorization_status=case when p_authorized_amount is null then 'DESCONOCIDO' else 'AUTORIZADO' end,
      capture_status='DESCONOCIDO',settlement_status='PENDIENTE',
      provider_snapshot=coalesce(p_provider_snapshot,'{}'::jsonb),resolved_at=null
      where id=p_intento_id;
    update public.pagos set estado='DESCONOCIDO',resolved_at=null,version=version+1 where id=v_pago.id;
  elsif v_estado in ('RECHAZADO','CANCELADO') then
    v_liberado:=private.abc_liberar_reservas_intento(p_empresa_id,p_local_id,p_intento_id);
    update public.pago_intentos set estado=v_estado,
      provider_code=v_provider,provider_reference=v_reference,
      authorized_amount=p_authorized_amount,captured_amount=p_captured_amount,settled_amount=p_settled_amount,
      authorization_status=case when v_estado='RECHAZADO' then 'RECHAZADO' else 'CANCELADO' end,
      capture_status=case when v_estado='RECHAZADO' then 'RECHAZADO' else 'CANCELADO' end,
      settlement_status=case when v_estado='RECHAZADO' then 'RECHAZADO' else 'CANCELADO' end,
      provider_snapshot=coalesce(p_provider_snapshot,'{}'::jsonb),resolved_at=now()
      where id=p_intento_id;
    update public.pagos set estado=v_estado,resolved_at=now(),version=version+1 where id=v_pago.id;
  else
    if p_captured_amount is null or p_captured_amount<>v_intento.requested_amount
       or p_captured_amount<>v_pago.importe_objetivo then
      raise exception 'captura_parcial_no_habilitada';
    end if;
    if p_authorized_amount is not null and p_authorized_amount<p_captured_amount then
      raise exception 'captura_supera_autorizacion';
    end if;
    select array_agg(venta_fiscal_id order by venta_fiscal_id) into v_ids
      from public.reservas_saldo
     where empresa_id=p_empresa_id and local_id=p_local_id
       and intento_id=p_intento_id and estado='ACTIVA';
    if v_ids is null then raise exception 'reservas_activas_requeridas'; end if;
    perform private.abc_bloquear_ventas(p_empresa_id,p_local_id,v_ids);
    v_aplicado:=private.abc_aplicar_intento_confirmado(p_empresa_id,p_local_id,p_intento_id);
    update public.pago_intentos set estado='CONFIRMADO',
      provider_code=v_provider,provider_reference=v_reference,
      authorized_amount=coalesce(p_authorized_amount,p_captured_amount),
      captured_amount=p_captured_amount,settled_amount=p_settled_amount,
      authorization_status='AUTORIZADO',capture_status='CONFIRMADO',
      settlement_status=case when p_settled_amount is null then 'PENDIENTE' else 'LIQUIDADO' end,
      provider_snapshot=coalesce(p_provider_snapshot,'{}'::jsonb),resolved_at=now()
      where id=p_intento_id;
    update public.pagos set estado='CONFIRMADO',resolved_at=now(),version=version+1 where id=v_pago.id;
    v_checkout_estado:=private.abc_actualizar_checkout_estado(p_empresa_id,p_local_id,v_pago.checkout_id);
  end if;

  if v_estado in ('CONFIRMADO','RECHAZADO','CANCELADO') then
    perform private.abc_completar_efecto_dedupe(
      p_empresa_id,'pago-intento:'||p_intento_id::text
    );
  end if;

  insert into public.abc_eventos(
    empresa_id,local_id,operation_id,aggregate_type,aggregate_id,event_type,payload,
    actor_user_id,terminal_id,occurred_at,operating_day,executor_kind,executor_ref
  ) values (
    p_empresa_id,p_local_id,p_operation_id,'PAGO',v_pago.id::text,'PAGO_INTENTO_RESUELTO',
    jsonb_build_object('intento_id',p_intento_id,'estado',v_estado,'provider_code',v_provider,
      'provider_reference',v_reference,'aplicado',v_aplicado,'liberado',v_liberado,
      'checkout_estado',v_checkout_estado),
    v_pago.created_by,v_terminal,now(),v_day,'SYSTEM_PROVIDER',v_provider
  );

  v_result:=jsonb_build_object('ok',true,'intento_id',p_intento_id,'pago_id',v_pago.id,
    'estado',v_estado,'aplicado',v_aplicado,'liberado',v_liberado,
    'checkout_estado',v_checkout_estado);
  perform private.abc_operacion_completar(p_operation_id,v_result);
  return v_result;
end $function$;

CREATE OR REPLACE FUNCTION public.abc_mover_cantidad_linea_cuenta(p_operation_id text, p_empresa_id text, p_local_id text, p_linea_id uuid, p_cuenta_origen_id uuid, p_cuenta_destino_id uuid, p_cantidad numeric, p_comensal_ref text, p_expected_origen_version bigint, p_expected_destino_version bigint, p_expected_linea_version bigint, p_terminal_id uuid, p_session_id uuid, p_operating_day date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_origen public.cuentas_comerciales%rowtype;
  v_destino public.cuentas_comerciales%rowtype;
  v_linea public.pedido_lineas%rowtype;
  v_src public.cuenta_linea_repartos%rowtype;
  v_dst public.cuenta_linea_repartos%rowtype;
  v_request jsonb; v_cmd jsonb; v_result jsonb;
  v_fiscalizada numeric;
  v_ratio numeric(32,16);
  v_desc numeric(24,8); v_base numeric(24,8); v_tax numeric(24,8); v_total numeric(24,8);
  v_src_new_version bigint; v_dst_new_version bigint;
  v_origen_new_version bigint; v_destino_new_version bigint;
  v_fraccionable boolean;
  v_precision integer;
  v_comensal text:=nullif(btrim(coalesce(p_comensal_ref,'')),'');
begin
  if auth.uid() is null
     or not private.abc_tiene_capacidad(p_empresa_id,p_local_id,'ABC_CUENTA_REPARTIR') then
    raise exception 'reparto_cuenta_no_autorizado';
  end if;
  if p_linea_id is null or p_cuenta_origen_id is null or p_cuenta_destino_id is null
     or p_cuenta_origen_id=p_cuenta_destino_id
     or p_cantidad is null or p_cantidad<=0
     or p_expected_origen_version is null or p_expected_destino_version is null
     or p_expected_linea_version is null
     or p_terminal_id is null or p_session_id is null or p_operating_day is null then
    raise exception 'reparto_parametros_invalidos';
  end if;
  if p_cantidad<>round(p_cantidad,8) then raise exception 'reparto_cantidad_precision_maxima'; end if;
  if not private.abc_terminal_sesion_operativa(
    p_empresa_id,p_local_id,p_terminal_id,p_session_id
  ) then raise exception 'terminal_sesion_no_operativa'; end if;

  v_request:=jsonb_build_object(
    'linea_id',p_linea_id,'cuenta_origen_id',p_cuenta_origen_id,
    'cuenta_destino_id',p_cuenta_destino_id,'cantidad',p_cantidad,
    'comensal_ref',v_comensal,
    'expected_origen_version',p_expected_origen_version,
    'expected_destino_version',p_expected_destino_version,
    'expected_linea_version',p_expected_linea_version,
    'terminal_id',p_terminal_id,'session_id',p_session_id,
    'operating_day',p_operating_day
  );
  v_cmd:=private.abc_operacion_iniciar(
    p_operation_id,p_empresa_id,p_local_id,
    'ABC_MOVER_CANTIDAD_LINEA_CUENTA',v_request,p_terminal_id
  );
  if (v_cmd->>'replayed')::boolean then
    return coalesce(v_cmd->'resultado',v_cmd);
  end if;

  perform 1
  from public.cuentas_comerciales c
  where c.empresa_id=p_empresa_id and c.local_id=p_local_id
    and c.id in (p_cuenta_origen_id,p_cuenta_destino_id)
  order by c.id
  for update;

  select * into v_origen
  from public.cuentas_comerciales
  where empresa_id=p_empresa_id and local_id=p_local_id and id=p_cuenta_origen_id;
  select * into v_destino
  from public.cuentas_comerciales
  where empresa_id=p_empresa_id and local_id=p_local_id and id=p_cuenta_destino_id;

  if v_origen.id is null or v_destino.id is null then raise exception 'reparto_cuenta_no_encontrada'; end if;
  if v_origen.estado<>'ABIERTA' or v_destino.estado<>'ABIERTA' then raise exception 'reparto_cuenta_no_abierta'; end if;
  if v_origen.version<>p_expected_origen_version then raise exception 'cuenta_origen_version_conflict'; end if;
  if v_destino.version<>p_expected_destino_version then raise exception 'cuenta_destino_version_conflict'; end if;
  if v_origen.currency_code<>v_destino.currency_code then raise exception 'reparto_moneda_incompatible'; end if;
  if v_origen.opened_operating_day<>p_operating_day
     or v_destino.opened_operating_day<>p_operating_day then
    raise exception 'reparto_operating_day_incompatible';
  end if;

  perform private.abc_exigir_cuenta_sin_cobro_incierto(p_empresa_id,p_local_id,p_cuenta_origen_id);
  perform private.abc_exigir_cuenta_sin_cobro_incierto(p_empresa_id,p_local_id,p_cuenta_destino_id);

  if exists(
    select 1 from public.cuenta_cuotas_importe q
    where q.empresa_id=p_empresa_id and q.local_id=p_local_id
      and q.estado='ACTIVA'
      and (
        q.cuenta_origen_id in (p_cuenta_origen_id,p_cuenta_destino_id)
        or q.cuenta_destino_id in (p_cuenta_origen_id,p_cuenta_destino_id)
      )
  ) then raise exception 'cuota_activa_incompatible_con_reparto_linea'; end if;

  select * into v_linea
  from public.pedido_lineas
  where empresa_id=p_empresa_id and local_id=p_local_id and id=p_linea_id
  for update;
  if not found then raise exception 'reparto_linea_no_encontrada'; end if;
  if v_linea.version<>p_expected_linea_version then raise exception 'linea_version_conflict'; end if;
  if v_linea.estado in ('BORRADOR','CANCELADA') then raise exception 'reparto_linea_no_repartible'; end if;

  v_fraccionable:=coalesce((v_linea.snapshot_comercial->>'fraccionable')::boolean,false);
  v_precision:=coalesce((v_linea.snapshot_comercial->>'precision_cantidad')::integer,0);
  if not v_fraccionable and p_cantidad<>trunc(p_cantidad) then
    raise exception 'reparto_cantidad_no_fraccionable';
  end if;
  if round(p_cantidad,v_precision)<>p_cantidad then
    raise exception 'reparto_cantidad_precision_invalida';
  end if;

  perform private.abc_materializar_reparto_linea(p_empresa_id,p_local_id,p_linea_id);

  select * into v_src
  from public.cuenta_linea_repartos
  where empresa_id=p_empresa_id and local_id=p_local_id
    and source_line_id=p_linea_id
    and cuenta_id=p_cuenta_origen_id
    and estado='ACTIVO'
  for update;
  if not found then raise exception 'cuenta_origen_sin_reparto_linea'; end if;
  if p_cantidad>v_src.cantidad then raise exception 'reparto_cantidad_excede_disponible'; end if;

  v_fiscalizada:=private.abc_cantidad_fiscalizada_linea_cuenta(
    p_empresa_id,p_local_id,p_linea_id,p_cuenta_origen_id
  );
  if v_src.cantidad-p_cantidad<v_fiscalizada then
    raise exception 'reparto_parte_fiscalizada_inmovil';
  end if;

  select * into v_dst
  from public.cuenta_linea_repartos
  where empresa_id=p_empresa_id and local_id=p_local_id
    and source_line_id=p_linea_id
    and cuenta_id=p_cuenta_destino_id
    and estado='ACTIVO'
  for update;

  if found and v_dst.comensal_ref is distinct from v_comensal
     and v_dst.comensal_ref is not null and v_comensal is not null then
    raise exception 'reparto_comensal_conflict';
  end if;

  if p_cantidad=v_src.cantidad then
    v_desc:=v_src.descuento; v_base:=v_src.base;
    v_tax:=v_src.impuestos; v_total:=v_src.total;
  else
    v_ratio:=p_cantidad/v_src.cantidad;
    v_desc:=round(v_src.descuento*v_ratio,8);
    v_base:=round(v_src.base*v_ratio,8);
    v_total:=round(v_src.total*v_ratio,8);
    v_tax:=(v_total-v_base)::numeric(24,8);
  end if;

  if p_cantidad=v_src.cantidad then
    update public.cuenta_linea_repartos
       set estado='CERRADO',closed_at=now(),version=version+1
     where id=v_src.id
    returning version into v_src_new_version;
  else
    update public.cuenta_linea_repartos
       set cantidad=cantidad-p_cantidad,
           descuento=descuento-v_desc,
           base=base-v_base,
           impuestos=impuestos-v_tax,
           total=total-v_total,
           version=version+1
     where id=v_src.id
    returning version into v_src_new_version;
  end if;

  if v_dst.id is null then
    insert into public.cuenta_linea_repartos(
      empresa_id,local_id,source_line_id,cuenta_id,cantidad,
      descuento,base,impuestos,total,comensal_ref,created_by
    ) values(
      p_empresa_id,p_local_id,p_linea_id,p_cuenta_destino_id,p_cantidad,
      v_desc,v_base,v_tax,v_total,v_comensal,auth.uid()
    )
    returning version into v_dst_new_version;
  else
    update public.cuenta_linea_repartos
       set cantidad=cantidad+p_cantidad,
           descuento=descuento+v_desc,
           base=base+v_base,
           impuestos=impuestos+v_tax,
           total=total+v_total,
           comensal_ref=coalesce(comensal_ref,v_comensal),
           version=version+1
     where id=v_dst.id
    returning version into v_dst_new_version;
  end if;

  insert into public.cuenta_relaciones(
    empresa_id,local_id,cuenta_origen_id,cuenta_destino_id,tipo,motivo,
    operation_id,actor_user_id,terminal_id,session_id,operating_day
  ) values(
    p_empresa_id,p_local_id,p_cuenta_origen_id,p_cuenta_destino_id,'DIVISION',
    'REPARTO_LINEA',p_operation_id,auth.uid(),p_terminal_id,p_session_id,p_operating_day
  )
  on conflict(empresa_id,local_id,cuenta_origen_id,cuenta_destino_id,tipo) do nothing;

  update public.cuentas_comerciales
     set version=version+1
   where empresa_id=p_empresa_id and local_id=p_local_id and id=p_cuenta_origen_id
  returning version into v_origen_new_version;

  update public.cuentas_comerciales
     set version=version+1
   where empresa_id=p_empresa_id and local_id=p_local_id and id=p_cuenta_destino_id
  returning version into v_destino_new_version;

  insert into public.abc_eventos(
    empresa_id,local_id,operation_id,aggregate_type,aggregate_id,event_type,
    payload,actor_user_id,terminal_id,occurred_at,operating_day
  ) values(
    p_empresa_id,p_local_id,p_operation_id,'PEDIDO_LINEA',p_linea_id::text,
    'CUENTA_REPARTO_LINEA_MOVIDO',
    jsonb_build_object(
      'cuenta_origen_id',p_cuenta_origen_id,
      'cuenta_destino_id',p_cuenta_destino_id,
      'cantidad',p_cantidad,
      'descuento',v_desc,'base',v_base,'impuestos',v_tax,'total',v_total,
      'comensal_ref',v_comensal,
      'cuenta_origen_version',v_origen_new_version,
      'cuenta_destino_version',v_destino_new_version,
      'linea_version',v_linea.version,
      'session_id',p_session_id
    ),
    auth.uid(),p_terminal_id,now(),p_operating_day
  );

  v_result:=jsonb_build_object(
    'ok',true,'linea_id',p_linea_id,
    'cuenta_origen_id',p_cuenta_origen_id,
    'cuenta_destino_id',p_cuenta_destino_id,
    'cantidad',p_cantidad,'total',v_total,
    'comensal_ref',v_comensal,
    'cuenta_origen_version',v_origen_new_version,
    'cuenta_destino_version',v_destino_new_version,
    'linea_version',v_linea.version
  );
  perform private.abc_operacion_completar(p_operation_id,v_result);
  return v_result;
end $function$;

CREATE OR REPLACE FUNCTION public.abc_asignar_cuota_importe(p_operation_id text, p_empresa_id text, p_local_id text, p_cuenta_origen_id uuid, p_cuenta_destino_id uuid, p_importe numeric, p_etiqueta text, p_expected_origen_version bigint, p_expected_destino_version bigint, p_terminal_id uuid, p_session_id uuid, p_operating_day date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_origen public.cuentas_comerciales%rowtype;
  v_destino public.cuentas_comerciales%rowtype;
  v_request jsonb; v_cmd jsonb; v_result jsonb;
  v_cuota_id uuid:=gen_random_uuid();
  v_origen_new bigint; v_destino_new bigint;
  v_disponible numeric;
  v_etiqueta text:=nullif(btrim(coalesce(p_etiqueta,'')),'');
begin
  if auth.uid() is null
     or not private.abc_tiene_capacidad(p_empresa_id,p_local_id,'ABC_CUENTA_REPARTIR') then
    raise exception 'cuota_importe_no_autorizada';
  end if;
  if p_cuenta_origen_id is null or p_cuenta_destino_id is null
     or p_cuenta_origen_id=p_cuenta_destino_id
     or p_importe is null or p_importe<=0 or p_importe<>round(p_importe,8)
     or p_expected_origen_version is null or p_expected_destino_version is null
     or p_terminal_id is null or p_session_id is null or p_operating_day is null then
    raise exception 'cuota_importe_parametros_invalidos';
  end if;
  if not private.abc_terminal_sesion_operativa(
    p_empresa_id,p_local_id,p_terminal_id,p_session_id
  ) then raise exception 'terminal_sesion_no_operativa'; end if;

  v_request:=jsonb_build_object(
    'cuenta_origen_id',p_cuenta_origen_id,'cuenta_destino_id',p_cuenta_destino_id,
    'importe',p_importe,'etiqueta',v_etiqueta,
    'expected_origen_version',p_expected_origen_version,
    'expected_destino_version',p_expected_destino_version,
    'terminal_id',p_terminal_id,'session_id',p_session_id,'operating_day',p_operating_day
  );
  v_cmd:=private.abc_operacion_iniciar(
    p_operation_id,p_empresa_id,p_local_id,'ABC_ASIGNAR_CUOTA_IMPORTE',v_request,p_terminal_id
  );
  if (v_cmd->>'replayed')::boolean then return coalesce(v_cmd->'resultado',v_cmd); end if;

  perform 1
  from public.cuentas_comerciales c
  where c.empresa_id=p_empresa_id and c.local_id=p_local_id
    and c.id in(p_cuenta_origen_id,p_cuenta_destino_id)
  order by c.id for update;

  select * into v_origen from public.cuentas_comerciales
   where empresa_id=p_empresa_id and local_id=p_local_id and id=p_cuenta_origen_id;
  select * into v_destino from public.cuentas_comerciales
   where empresa_id=p_empresa_id and local_id=p_local_id and id=p_cuenta_destino_id;

  if v_origen.id is null or v_destino.id is null then raise exception 'cuota_cuenta_no_encontrada'; end if;
  if v_origen.estado<>'ABIERTA' or v_destino.estado<>'ABIERTA' then raise exception 'cuota_cuenta_no_abierta'; end if;
  if v_origen.version<>p_expected_origen_version then raise exception 'cuenta_origen_version_conflict'; end if;
  if v_destino.version<>p_expected_destino_version then raise exception 'cuenta_destino_version_conflict'; end if;
  if v_origen.currency_code<>v_destino.currency_code then raise exception 'cuota_moneda_incompatible'; end if;
  if v_origen.opened_operating_day<>p_operating_day
     or v_destino.opened_operating_day<>p_operating_day then raise exception 'cuota_operating_day_incompatible'; end if;

  perform private.abc_exigir_cuenta_sin_cobro_incierto(p_empresa_id,p_local_id,p_cuenta_origen_id);
  perform private.abc_exigir_cuenta_sin_cobro_incierto(p_empresa_id,p_local_id,p_cuenta_destino_id);

  if exists(
    select 1 from public.ventas_fiscales v
    where v.empresa_id=p_empresa_id and v.local_id=p_local_id
      and v.cuenta_id in(p_cuenta_origen_id,p_cuenta_destino_id)
  ) then raise exception 'cuota_cuenta_con_fiscalizacion'; end if;

  if exists(
    select 1
    from public.cuenta_linea_repartos r
    join public.pedido_lineas l
      on l.empresa_id=r.empresa_id and l.local_id=r.local_id and l.id=r.source_line_id
    join public.pedidos_tpv p
      on p.empresa_id=l.empresa_id and p.local_id=l.local_id and p.id=l.pedido_id
    where r.empresa_id=p_empresa_id and r.local_id=p_local_id
      and r.estado='ACTIVO'
      and (
        r.cuenta_id in(p_cuenta_origen_id,p_cuenta_destino_id)
        or p.cuenta_id in(p_cuenta_origen_id,p_cuenta_destino_id)
      )
      and r.cuenta_id<>p.cuenta_id
  ) then raise exception 'reparto_linea_activo_incompatible_con_cuota'; end if;

  v_disponible:=private.abc_total_comercial_cuenta(
    p_empresa_id,p_local_id,p_cuenta_origen_id
  );
  if p_importe>v_disponible then raise exception 'cuota_importe_excede_disponible'; end if;

  insert into public.cuenta_cuotas_importe(
    id,empresa_id,local_id,cuenta_origen_id,cuenta_destino_id,
    currency_code,importe,etiqueta,created_by
  ) values(
    v_cuota_id,p_empresa_id,p_local_id,p_cuenta_origen_id,p_cuenta_destino_id,
    v_origen.currency_code,p_importe,v_etiqueta,auth.uid()
  );

  insert into public.cuenta_relaciones(
    empresa_id,local_id,cuenta_origen_id,cuenta_destino_id,tipo,motivo,
    operation_id,actor_user_id,terminal_id,session_id,operating_day
  ) values(
    p_empresa_id,p_local_id,p_cuenta_origen_id,p_cuenta_destino_id,'DIVISION',
    'CUOTA_IMPORTE',p_operation_id,auth.uid(),p_terminal_id,p_session_id,p_operating_day
  )
  on conflict(empresa_id,local_id,cuenta_origen_id,cuenta_destino_id,tipo) do nothing;

  update public.cuentas_comerciales set version=version+1
   where empresa_id=p_empresa_id and local_id=p_local_id and id=p_cuenta_origen_id
  returning version into v_origen_new;
  update public.cuentas_comerciales set version=version+1
   where empresa_id=p_empresa_id and local_id=p_local_id and id=p_cuenta_destino_id
  returning version into v_destino_new;

  insert into public.abc_eventos(
    empresa_id,local_id,operation_id,aggregate_type,aggregate_id,event_type,
    payload,actor_user_id,terminal_id,occurred_at,operating_day
  ) values(
    p_empresa_id,p_local_id,p_operation_id,'CUENTA',p_cuenta_origen_id::text,
    'CUENTA_CUOTA_IMPORTE_ASIGNADA',
    jsonb_build_object(
      'cuota_id',v_cuota_id,'cuenta_destino_id',p_cuenta_destino_id,
      'importe',p_importe,'etiqueta',v_etiqueta,
      'cuenta_origen_version',v_origen_new,
      'cuenta_destino_version',v_destino_new,
      'session_id',p_session_id
    ),
    auth.uid(),p_terminal_id,now(),p_operating_day
  );

  v_result:=jsonb_build_object(
    'ok',true,'cuota_id',v_cuota_id,
    'cuenta_origen_id',p_cuenta_origen_id,'cuenta_destino_id',p_cuenta_destino_id,
    'importe',p_importe,'currency_code',v_origen.currency_code,
    'cuenta_origen_version',v_origen_new,'cuenta_destino_version',v_destino_new
  );
  perform private.abc_operacion_completar(p_operation_id,v_result);
  return v_result;
end $function$;

CREATE OR REPLACE FUNCTION public.abc_revertir_cuota_importe(p_operation_id text, p_empresa_id text, p_local_id text, p_cuota_id uuid, p_expected_cuota_version bigint, p_expected_origen_version bigint, p_expected_destino_version bigint, p_terminal_id uuid, p_session_id uuid, p_operating_day date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_q public.cuenta_cuotas_importe%rowtype;
  v_origen public.cuentas_comerciales%rowtype;
  v_destino public.cuentas_comerciales%rowtype;
  v_request jsonb; v_cmd jsonb; v_result jsonb;
  v_q_new bigint; v_o_new bigint; v_d_new bigint;
begin
  if auth.uid() is null
     or not private.abc_tiene_capacidad(p_empresa_id,p_local_id,'ABC_REPARTO_REVERTIR') then
    raise exception 'cuota_revertir_no_autorizada';
  end if;
  if p_cuota_id is null or p_expected_cuota_version is null
     or p_expected_origen_version is null or p_expected_destino_version is null
     or p_terminal_id is null or p_session_id is null or p_operating_day is null then
    raise exception 'cuota_revertir_parametros_invalidos';
  end if;
  if not private.abc_terminal_sesion_operativa(
    p_empresa_id,p_local_id,p_terminal_id,p_session_id
  ) then raise exception 'terminal_sesion_no_operativa'; end if;

  v_request:=jsonb_build_object(
    'cuota_id',p_cuota_id,'expected_cuota_version',p_expected_cuota_version,
    'expected_origen_version',p_expected_origen_version,
    'expected_destino_version',p_expected_destino_version,
    'terminal_id',p_terminal_id,'session_id',p_session_id,'operating_day',p_operating_day
  );
  v_cmd:=private.abc_operacion_iniciar(
    p_operation_id,p_empresa_id,p_local_id,'ABC_REVERTIR_CUOTA_IMPORTE',v_request,p_terminal_id
  );
  if (v_cmd->>'replayed')::boolean then return coalesce(v_cmd->'resultado',v_cmd); end if;

  select * into v_q
  from public.cuenta_cuotas_importe
  where empresa_id=p_empresa_id and local_id=p_local_id and id=p_cuota_id
  for update;
  if not found then raise exception 'cuota_no_encontrada'; end if;
  if v_q.estado<>'ACTIVA' then raise exception 'cuota_no_activa'; end if;
  if v_q.version<>p_expected_cuota_version then raise exception 'cuota_version_conflict'; end if;

  perform 1
  from public.cuentas_comerciales c
  where c.empresa_id=p_empresa_id and c.local_id=p_local_id
    and c.id in(v_q.cuenta_origen_id,v_q.cuenta_destino_id)
  order by c.id for update;

  select * into v_origen from public.cuentas_comerciales where id=v_q.cuenta_origen_id;
  select * into v_destino from public.cuentas_comerciales where id=v_q.cuenta_destino_id;
  if v_origen.version<>p_expected_origen_version then raise exception 'cuenta_origen_version_conflict'; end if;
  if v_destino.version<>p_expected_destino_version then raise exception 'cuenta_destino_version_conflict'; end if;
  if v_origen.opened_operating_day<>p_operating_day or v_destino.opened_operating_day<>p_operating_day then
    raise exception 'cuota_operating_day_incompatible';
  end if;

  perform private.abc_exigir_cuenta_sin_cobro_incierto(p_empresa_id,p_local_id,v_q.cuenta_origen_id);
  perform private.abc_exigir_cuenta_sin_cobro_incierto(p_empresa_id,p_local_id,v_q.cuenta_destino_id);

  if exists(
    select 1 from public.ventas_fiscales v
    where v.empresa_id=p_empresa_id and v.local_id=p_local_id
      and v.cuenta_id in(v_q.cuenta_origen_id,v_q.cuenta_destino_id)
  ) then raise exception 'cuota_cuenta_con_fiscalizacion'; end if;

  update public.cuenta_cuotas_importe
     set estado='CERRADA',closed_at=now(),version=version+1
   where id=v_q.id
  returning version into v_q_new;

  update public.cuentas_comerciales set version=version+1
   where id=v_q.cuenta_origen_id returning version into v_o_new;
  update public.cuentas_comerciales set version=version+1
   where id=v_q.cuenta_destino_id returning version into v_d_new;

  insert into public.abc_eventos(
    empresa_id,local_id,operation_id,aggregate_type,aggregate_id,event_type,
    payload,actor_user_id,terminal_id,occurred_at,operating_day
  ) values(
    p_empresa_id,p_local_id,p_operation_id,'CUENTA',v_q.cuenta_origen_id::text,
    'CUENTA_CUOTA_IMPORTE_REVERTIDA',
    jsonb_build_object(
      'cuota_id',v_q.id,'cuenta_destino_id',v_q.cuenta_destino_id,
      'importe',v_q.importe,'cuota_version',v_q_new,
      'cuenta_origen_version',v_o_new,'cuenta_destino_version',v_d_new,
      'session_id',p_session_id
    ),
    auth.uid(),p_terminal_id,now(),p_operating_day
  );

  v_result:=jsonb_build_object(
    'ok',true,'cuota_id',v_q.id,'estado','CERRADA',
    'cuota_version',v_q_new,'cuenta_origen_version',v_o_new,
    'cuenta_destino_version',v_d_new
  );
  perform private.abc_operacion_completar(p_operation_id,v_result);
  return v_result;
end $function$;

CREATE OR REPLACE FUNCTION public.abc_unir_cuentas(p_operation_id text, p_empresa_id text, p_local_id text, p_cuenta_origen_id uuid, p_cuenta_destino_id uuid, p_motivo text, p_expected_origen_version bigint, p_expected_destino_version bigint, p_terminal_id uuid, p_session_id uuid, p_operating_day date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_origen public.cuentas_comerciales%rowtype;
  v_destino public.cuentas_comerciales%rowtype;
  v_src_asig public.cuenta_mesa_asignaciones%rowtype;
  v_dst_asig public.cuenta_mesa_asignaciones%rowtype;
  v_motivo text:=nullif(btrim(coalesce(p_motivo,'')),'');
  v_request jsonb; v_cmd jsonb; v_result jsonb;
  v_o_new bigint; v_d_new bigint; v_mesa_new bigint;
  v_r record; v_dst_r public.cuenta_linea_repartos%rowtype;
begin
  if auth.uid() is null
     or not private.abc_tiene_capacidad(p_empresa_id,p_local_id,'ABC_CUENTA_UNIR') then
    raise exception 'cuentas_unir_no_autorizado';
  end if;
  if p_cuenta_origen_id is null or p_cuenta_destino_id is null
     or p_cuenta_origen_id=p_cuenta_destino_id or v_motivo is null
     or p_expected_origen_version is null or p_expected_destino_version is null
     or p_terminal_id is null or p_session_id is null or p_operating_day is null then
    raise exception 'cuentas_unir_parametros_invalidos';
  end if;
  if not private.abc_terminal_sesion_operativa(
    p_empresa_id,p_local_id,p_terminal_id,p_session_id
  ) then raise exception 'terminal_sesion_no_operativa'; end if;

  v_request:=jsonb_build_object(
    'cuenta_origen_id',p_cuenta_origen_id,'cuenta_destino_id',p_cuenta_destino_id,
    'motivo',v_motivo,'expected_origen_version',p_expected_origen_version,
    'expected_destino_version',p_expected_destino_version,
    'terminal_id',p_terminal_id,'session_id',p_session_id,'operating_day',p_operating_day
  );
  v_cmd:=private.abc_operacion_iniciar(
    p_operation_id,p_empresa_id,p_local_id,'ABC_UNIR_CUENTAS',v_request,p_terminal_id
  );
  if (v_cmd->>'replayed')::boolean then return coalesce(v_cmd->'resultado',v_cmd); end if;

  perform 1
  from public.cuentas_comerciales c
  where c.empresa_id=p_empresa_id and c.local_id=p_local_id
    and c.id in(p_cuenta_origen_id,p_cuenta_destino_id)
  order by c.id for update;

  select * into v_origen from public.cuentas_comerciales
   where empresa_id=p_empresa_id and local_id=p_local_id and id=p_cuenta_origen_id;
  select * into v_destino from public.cuentas_comerciales
   where empresa_id=p_empresa_id and local_id=p_local_id and id=p_cuenta_destino_id;

  if v_origen.id is null or v_destino.id is null then raise exception 'cuentas_unir_no_encontradas'; end if;
  if v_origen.estado<>'ABIERTA' or v_destino.estado<>'ABIERTA' then raise exception 'cuentas_unir_no_abiertas'; end if;
  if v_origen.version<>p_expected_origen_version then raise exception 'cuenta_origen_version_conflict'; end if;
  if v_destino.version<>p_expected_destino_version then raise exception 'cuenta_destino_version_conflict'; end if;
  if v_origen.currency_code<>v_destino.currency_code then raise exception 'cuentas_unir_moneda_incompatible'; end if;
  if v_origen.opened_operating_day<>p_operating_day or v_destino.opened_operating_day<>p_operating_day then
    raise exception 'cuentas_unir_operating_day_incompatible';
  end if;

  perform private.abc_exigir_cuenta_sin_cobro_incierto(p_empresa_id,p_local_id,p_cuenta_origen_id);
  perform private.abc_exigir_cuenta_sin_cobro_incierto(p_empresa_id,p_local_id,p_cuenta_destino_id);

  if exists(
    select 1 from public.ventas_fiscales v
    where v.empresa_id=p_empresa_id and v.local_id=p_local_id
      and v.cuenta_id in(p_cuenta_origen_id,p_cuenta_destino_id)
  ) then raise exception 'cuentas_unir_con_fiscalizacion'; end if;

  if exists(
    select 1 from public.cuenta_cuotas_importe q
    where q.empresa_id=p_empresa_id and q.local_id=p_local_id and q.estado='ACTIVA'
      and (
        q.cuenta_origen_id in(p_cuenta_origen_id,p_cuenta_destino_id)
        or q.cuenta_destino_id in(p_cuenta_origen_id,p_cuenta_destino_id)
      )
  ) then raise exception 'cuentas_unir_con_cuotas_activas'; end if;

  if exists(
    select 1 from public.pedidos_tpv p
    where p.empresa_id=p_empresa_id and p.local_id=p_local_id
      and p.cuenta_id=p_cuenta_origen_id
      and p.estado in('BORRADOR','ABIERTO')
  ) then raise exception 'cuenta_origen_con_pedido_editable'; end if;

  if exists(
    select 1
    from public.pedido_lineas l
    join public.pedidos_tpv p
      on p.empresa_id=l.empresa_id and p.local_id=l.local_id and p.id=l.pedido_id
    where p.empresa_id=p_empresa_id and p.local_id=p_local_id
      and p.cuenta_id=p_cuenta_origen_id
      and l.estado not in('SERVIDA','CANCELADA')
  ) then raise exception 'cuenta_origen_con_lineas_no_terminales'; end if;

  select * into v_src_asig
  from public.cuenta_mesa_asignaciones
  where empresa_id=p_empresa_id and local_id=p_local_id
    and cuenta_id=p_cuenta_origen_id and hasta is null
  for update;

  select * into v_dst_asig
  from public.cuenta_mesa_asignaciones
  where empresa_id=p_empresa_id and local_id=p_local_id
    and cuenta_id=p_cuenta_destino_id and hasta is null
  for update;

  if v_src_asig.id is not null and v_dst_asig.id is not null
     and v_src_asig.mesa_id<>v_dst_asig.mesa_id then
    raise exception 'cuentas_unir_mesas_distintas';
  end if;

  if v_src_asig.id is not null then
    perform 1 from public.tpv_mesas m
     where m.empresa_id=p_empresa_id and m.local_id=p_local_id
       and m.id=v_src_asig.mesa_id
     for update;
  end if;

  for v_r in
    select l.id
    from public.pedido_lineas l
    join public.pedidos_tpv p
      on p.empresa_id=l.empresa_id and p.local_id=l.local_id and p.id=l.pedido_id
    where p.empresa_id=p_empresa_id and p.local_id=p_local_id
      and p.cuenta_id=p_cuenta_origen_id
      and l.estado<>'CANCELADA'
    order by l.id
  loop
    perform private.abc_materializar_reparto_linea(p_empresa_id,p_local_id,v_r.id);
  end loop;

  for v_r in
    select *
    from public.cuenta_linea_repartos r
    where r.empresa_id=p_empresa_id and r.local_id=p_local_id
      and r.cuenta_id=p_cuenta_origen_id and r.estado='ACTIVO'
    order by r.source_line_id,r.id
    for update
  loop
    select * into v_dst_r
    from public.cuenta_linea_repartos
    where empresa_id=p_empresa_id and local_id=p_local_id
      and source_line_id=v_r.source_line_id
      and cuenta_id=p_cuenta_destino_id
      and estado='ACTIVO'
    for update;

    if found then
      update public.cuenta_linea_repartos
         set cantidad=cantidad+v_r.cantidad,
             descuento=descuento+v_r.descuento,
             base=base+v_r.base,
             impuestos=impuestos+v_r.impuestos,
             total=total+v_r.total,
             version=version+1
       where id=v_dst_r.id;
      update public.cuenta_linea_repartos
         set estado='CERRADO',closed_at=now(),version=version+1
       where id=v_r.id;
    else
      update public.cuenta_linea_repartos
         set cuenta_id=p_cuenta_destino_id,version=version+1
       where id=v_r.id;
    end if;
  end loop;

  insert into public.cuenta_relaciones(
    empresa_id,local_id,cuenta_origen_id,cuenta_destino_id,tipo,motivo,
    operation_id,actor_user_id,terminal_id,session_id,operating_day
  ) values(
    p_empresa_id,p_local_id,p_cuenta_origen_id,p_cuenta_destino_id,'FUSION',
    v_motivo,p_operation_id,auth.uid(),p_terminal_id,p_session_id,p_operating_day
  );

  update public.cuentas_comerciales
     set estado='CERRADA',closed_at=now(),version=version+1
   where id=p_cuenta_origen_id
  returning version into v_o_new;

  update public.cuentas_comerciales
     set version=version+1
   where id=p_cuenta_destino_id
  returning version into v_d_new;

  if v_src_asig.id is not null then
    update public.cuenta_mesa_asignaciones
       set hasta=now(),motivo_fin='FUSION_CUENTA'
     where id=v_src_asig.id;

    update public.tpv_mesas
       set version=version+1,updated_at=now()
     where id=v_src_asig.mesa_id
    returning version into v_mesa_new;

    if v_dst_asig.id is null then
      insert into public.cuenta_mesa_asignaciones(
        empresa_id,local_id,cuenta_id,mesa_id,comensales,
        actor_user_id,terminal_id,session_id,operating_day,
        cuenta_version_resultante,mesa_version_resultante,snapshot
      ) values(
        p_empresa_id,p_local_id,p_cuenta_destino_id,v_src_asig.mesa_id,
        v_src_asig.comensales,auth.uid(),p_terminal_id,p_session_id,p_operating_day,
        v_d_new,v_mesa_new,
        jsonb_build_object('origen','A08_FUSION','cuenta_origen_id',p_cuenta_origen_id)
      );
    else
      update public.cuenta_mesa_asignaciones
         set comensales=comensales+v_src_asig.comensales,
             cuenta_version_resultante=v_d_new,
             mesa_version_resultante=v_mesa_new
       where id=v_dst_asig.id;
    end if;
  end if;

  insert into public.abc_eventos(
    empresa_id,local_id,operation_id,aggregate_type,aggregate_id,event_type,
    payload,actor_user_id,terminal_id,occurred_at,operating_day
  ) values(
    p_empresa_id,p_local_id,p_operation_id,'CUENTA',p_cuenta_destino_id::text,
    'CUENTAS_UNIDAS',
    jsonb_build_object(
      'cuenta_origen_id',p_cuenta_origen_id,'cuenta_destino_id',p_cuenta_destino_id,
      'motivo',v_motivo,'cuenta_origen_version',v_o_new,
      'cuenta_destino_version',v_d_new,'mesa_version',v_mesa_new,
      'session_id',p_session_id
    ),
    auth.uid(),p_terminal_id,now(),p_operating_day
  );

  v_result:=jsonb_build_object(
    'ok',true,'cuenta_origen_id',p_cuenta_origen_id,
    'cuenta_destino_id',p_cuenta_destino_id,
    'cuenta_origen_estado','CERRADA',
    'cuenta_origen_version',v_o_new,
    'cuenta_destino_version',v_d_new,
    'mesa_version',v_mesa_new
  );
  perform private.abc_operacion_completar(p_operation_id,v_result);
  return v_result;
end $function$;

revoke all on function private.abc_cuenta_tiene_cobro_incierto(text,text,uuid)
  from public,anon,authenticated,service_role;
revoke all on function private.abc_bloquear_cuenta_cobro_interlock(text,text,uuid)
  from public,anon,authenticated,service_role;
revoke all on function private.abc_exigir_cuenta_sin_cobro_incierto(text,text,uuid)
  from public,anon,authenticated,service_role;

-- A08.2.2 (concurrencia determinista con dos cajas) se valida en un punto separado.
