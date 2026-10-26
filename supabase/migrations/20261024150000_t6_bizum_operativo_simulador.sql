-- Plan Maestro L&A Suite — Etapa 5, T6: Bizum operativo (modo simulador QA).
-- Hoja QA-8 (Pedro, 24/10/2026).
--
-- Bizum quedó con solo un "handshake" (abc_preparar_bizum_qa, sin cobro
-- real) desde el 23/10/2026 (ETAPA5_T6_INICIO_QA_2026-10-23.md), a la
-- espera de "un medio BIZUM explícito, estado pendiente inequívoco,
-- operation_id idempotente, capacidad QA separada y un adaptador
-- simulado". Esta migración cierra esa parte, tratando Bizum exactamente
-- igual que la tarjeta simulada ya probada (Hoja QA-3): se inicia con
-- abc_iniciar_cobro (ahora admite medio BIZUM, sin mapearlo nunca
-- silenciosamente a TRANSFERENCIA/OTRO) y se resuelve con el mismo
-- simulador exclusivo de QA-EMP-A/QA-A1 que ya usa tarjeta. No se conecta
-- ningún proveedor real de Bizum.
--
-- Tres cambios puntuales, sin tocar ninguna lógica de efectivo/tarjeta/
-- vale regalo ya probada:
--   1. public.pagos admite BIZUM como medio.
--   2. abc_iniciar_cobro admite BIZUM (una sola línea de su lista de
--      medios válidos).
--   3. abc_qa_confirmar_pago_simulado (el resolutor de QA de tarjeta)
--      admite también BIZUM, derivando el proveedor QA del propio medio
--      del pago en vez de un valor fijo único para ambos.

alter table public.pagos drop constraint abc_pago_medio;
alter table public.pagos add constraint abc_pago_medio
  check (medio = any (array['EFECTIVO','TARJETA','TRANSFERENCIA','OTRO','BIZUM']));

create or replace function public.abc_iniciar_cobro(
  p_operation_id text,
  p_empresa_id text,
  p_local_id text,
  p_checkout_id uuid,
  p_pago_id uuid,
  p_intento_id uuid,
  p_medio text,
  p_importe_objetivo numeric,
  p_payment_currency_code text,
  p_terminal_id uuid,
  p_importe_recibido numeric default null::numeric,
  p_cambio_entregado numeric default null::numeric
)
returns jsonb
language plpgsql
volatile
security definer
set search_path=''
as $$
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
  if v_medio not in ('EFECTIVO','TARJETA','TRANSFERENCIA','OTRO','BIZUM') then raise exception 'medio_pago_invalido'; end if;
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
end $$;

create or replace function public.abc_qa_confirmar_pago_simulado(
  p_empresa_id text,
  p_local_id text,
  p_intento_id uuid,
  p_importe numeric
)
returns jsonb
language plpgsql
volatile
security definer
set search_path=''
as $$
declare
  v_empresa constant text := 'QA-EMP-A';
  v_local constant text := 'QA-A1';
  v_provider text;
  v_uid uuid := auth.uid();
  v_intento public.pago_intentos%rowtype;
  v_pago public.pagos%rowtype;
  v_checkout public.checkouts%rowtype;
  v_terminal uuid;
  v_reference text;
  v_operation_id text;
  v_result jsonb;
  v_checkout_estado text;
begin
  if v_uid is null then
    raise exception 'abc_qa_simulador_no_autenticado';
  end if;
  if p_empresa_id is distinct from v_empresa or p_local_id is distinct from v_local then
    raise exception 'abc_qa_simulador_solo_qa';
  end if;
  if p_importe is null or p_importe <= 0 then
    raise exception 'abc_qa_simulador_importe_invalido';
  end if;
  if not exists (
    select 1
      from public.locales l
     where l.empresa_id = v_empresa
       and l.id = v_local
       and l.activo = true
  ) then
    raise exception 'abc_qa_simulador_local_no_disponible';
  end if;
  if not exists (
    select 1
      from public.membresias_usuario m
     where m.user_id = v_uid
       and m.empresa_id = v_empresa
       and m.activo = true
       and m.rol = 'Propietario'
       and (
         (m.todos_locales = true and m.local_id is null)
         or (m.todos_locales = false and m.local_id = v_local)
       )
  ) then
    raise exception 'abc_qa_simulador_propietario_requerido';
  end if;

  select i.* into v_intento
    from public.pago_intentos i
   where i.empresa_id = v_empresa
     and i.local_id = v_local
     and i.id = p_intento_id;
  if not found then
    raise exception 'abc_qa_simulador_intento_no_encontrado';
  end if;
  select p.* into v_pago
    from public.pagos p
   where p.empresa_id = v_empresa
     and p.local_id = v_local
     and p.id = v_intento.pago_id;
  if not found then
    raise exception 'abc_qa_simulador_pago_no_encontrado';
  end if;
  if v_pago.medio not in ('TARJETA','BIZUM') then
    raise exception 'abc_qa_simulador_medio_no_soportado';
  end if;
  v_provider := 'QA_SIMULADO_' || v_pago.medio;
  if p_importe <> v_intento.requested_amount
     or p_importe <> v_pago.importe_objetivo then
    raise exception 'abc_qa_simulador_importe_distinto';
  end if;
  select c.* into v_checkout
    from public.checkouts c
   where c.empresa_id = v_empresa
     and c.local_id = v_local
     and c.id = v_pago.checkout_id;
  if not found then
    raise exception 'abc_qa_simulador_checkout_no_encontrado';
  end if;
  select o.terminal_id into v_terminal
    from public.abc_operaciones o
   where o.empresa_id = v_empresa
     and o.local_id = v_local
     and o.operation_id = v_intento.abc_command_id;
  if v_terminal is null then
    raise exception 'abc_qa_simulador_terminal_no_encontrado';
  end if;

  v_reference := 'QA-SIM-' || replace(p_intento_id::text, '-', '');
  v_operation_id := 'qa.f4.b02b.sim.' || replace(p_intento_id::text, '-', '');
  v_result := public.abc_resolver_intento(
    v_operation_id,
    v_empresa,
    v_local,
    p_intento_id,
    'CONFIRMADO',
    v_provider,
    v_reference,
    p_importe,
    p_importe,
    p_importe,
    jsonb_build_object(
      'modo', 'QA_SIMULADO',
      'resultado', 'APROBADO',
      'actor_user_id', v_uid,
      'intento_id', p_intento_id
    )
  );
  v_checkout_estado := coalesce(v_result->>'checkout_estado', 'COMPLETADO');

  insert into public.abc_eventos(
    empresa_id, local_id, operation_id, aggregate_type, aggregate_id,
    event_type, payload, actor_user_id, terminal_id, occurred_at,
    operating_day, executor_kind, executor_ref
  )
  select
    v_empresa, v_local, v_operation_id, 'PAGO', v_pago.id::text,
    'PAGO_CONFIRMADO',
    jsonb_build_object(
      'intento_id', p_intento_id,
      'pago_id', v_pago.id,
      'checkout_id', v_pago.checkout_id,
      'importe', p_importe,
      'currency_code', v_pago.payment_currency_code,
      'resultado', 'APROBADO',
      'checkout_estado', v_checkout_estado,
      'modo', 'QA_SIMULADO'
    ),
    v_uid, v_terminal, now(), v_checkout.operating_day,
    'SYSTEM_PROVIDER', v_provider
  where not exists (
    select 1
      from public.abc_eventos e
     where e.empresa_id = v_empresa
       and e.local_id = v_local
       and e.operation_id = v_operation_id
       and e.event_type = 'PAGO_CONFIRMADO'
  );

  return coalesce(v_result, '{}'::jsonb) || jsonb_build_object(
    'ok', true,
    'qa_simulado', true,
    'resultado', 'APROBADO',
    'provider_code', v_provider,
    'provider_reference', v_reference,
    'checkout_estado', v_checkout_estado
  );
end;
$$;
