-- ABC F2 M03B — checkout y cobro bajo autoridad de servidor.
-- Aditiva. Expone RPC controladas; no activa proveedor real ni frontend.
-- Depende de M01/M01b + M02A + M02B + M03A.

do $$
declare v_missing text[] := array[]::text[];
begin
  if to_regclass('public.checkouts') is null then v_missing:=array_append(v_missing,'checkouts'); end if;
  if to_regclass('public.pagos') is null then v_missing:=array_append(v_missing,'pagos'); end if;
  if to_regclass('public.pago_intentos') is null then v_missing:=array_append(v_missing,'pago_intentos'); end if;
  if to_regclass('public.reservas_saldo') is null then v_missing:=array_append(v_missing,'reservas_saldo'); end if;
  if to_regclass('public.pago_aplicaciones') is null then v_missing:=array_append(v_missing,'pago_aplicaciones'); end if;
  if to_regclass('public.caja_operaciones') is null then v_missing:=array_append(v_missing,'caja_operaciones'); end if;
  if to_regprocedure('private.abc_tiene_capacidad(text,text,text)') is null then v_missing:=array_append(v_missing,'abc_tiene_capacidad'); end if;
  if to_regprocedure('private.abc_operacion_iniciar(text,text,text,text,jsonb,uuid)') is null then v_missing:=array_append(v_missing,'abc_operacion_iniciar'); end if;
  if to_regprocedure('private.abc_saldo_disponible(text,text,uuid)') is null then v_missing:=array_append(v_missing,'abc_saldo_disponible'); end if;
  if not exists(select 1 from pg_roles where rolname='service_role') then v_missing:=array_append(v_missing,'service_role'); end if;
  if cardinality(v_missing)>0 then
    raise exception 'ABC_F2_M03B_PREFLIGHT_FALLO:%',array_to_string(v_missing,',');
  end if;

  if to_regprocedure('public.abc_abrir_checkout(text,text,text,uuid,uuid,uuid[],date)') is not null
     or to_regprocedure('public.abc_iniciar_cobro(text,text,text,uuid,uuid,uuid,text,numeric,text,uuid,numeric,numeric)') is not null
     or to_regprocedure('public.abc_confirmar_efectivo(text,text,text,uuid,uuid,uuid,uuid,date)') is not null
     or to_regprocedure('public.abc_resolver_intento(text,text,text,uuid,text,text,text,numeric,numeric,numeric,jsonb)') is not null then
    raise exception 'ABC_F2_M03B_PREFLIGHT_FALLO: RPC M03B ya existen';
  end if;
end $$;

-- F2-D06: el actor originador y el ejecutor técnico dejan de ser ambiguos.
alter table public.abc_operaciones
  add column executor_kind text not null default 'USER',
  add column executor_ref text,
  add constraint abc_operacion_executor check (
    (executor_kind='USER' and executor_ref is null)
    or (executor_kind in ('SYSTEM_PROVIDER','SYSTEM_INTERNAL')
        and nullif(btrim(executor_ref),'') is not null)
  );

alter table public.abc_eventos
  add column executor_kind text not null default 'USER',
  add column executor_ref text,
  add constraint abc_evento_executor check (
    (executor_kind='USER' and executor_ref is null)
    or (executor_kind in ('SYSTEM_PROVIDER','SYSTEM_INTERNAL')
        and nullif(btrim(executor_ref),'') is not null)
  );

create function private.abc_operacion_iniciar_sistema(
  p_operation_id text,p_empresa_id text,p_local_id text,p_command_type text,
  p_request jsonb,p_origin_actor_user_id uuid,p_terminal_id uuid,p_executor_ref text
) returns jsonb
language plpgsql volatile security definer set search_path=''
as $$
declare
  v_request jsonb:=coalesce(p_request,'{}'::jsonb);
  v_hash text; v_command text:=upper(btrim(coalesce(p_command_type,'')));
  v_ref text:=nullif(btrim(coalesce(p_executor_ref,'')),'');
  v_existente public.abc_operaciones%rowtype;
begin
  if p_origin_actor_user_id is null then raise exception 'origin_actor_requerido'; end if;
  if v_ref is null then raise exception 'executor_ref_requerido'; end if;
  perform private.abc_lock_operation_id(p_operation_id);
  v_hash:=private.abc_request_hash(v_request);

  select * into v_existente from public.abc_operaciones
   where operation_id=p_operation_id for update;
  if found then
    if v_existente.empresa_id is distinct from p_empresa_id
       or v_existente.local_id is distinct from p_local_id then
      raise exception 'contexto_no_autorizado';
    end if;
    if v_existente.command_type is distinct from v_command
       or v_existente.request_hash is distinct from v_hash
       or v_existente.executor_kind is distinct from 'SYSTEM_PROVIDER'
       or v_existente.executor_ref is distinct from v_ref then
      raise exception 'operation_id_conflict';
    end if;
    return jsonb_build_object('ok',true,'replayed',true,'status',v_existente.status,
      'resultado',v_existente.resultado,'error',v_existente.error);
  end if;

  insert into public.abc_operaciones(
    operation_id,empresa_id,local_id,command_type,request_hash,status,
    actor_user_id,terminal_id,request,executor_kind,executor_ref
  ) values (
    p_operation_id,p_empresa_id,p_local_id,v_command,v_hash,'PROCESANDO',
    p_origin_actor_user_id,p_terminal_id,v_request,'SYSTEM_PROVIDER',v_ref
  );
  return jsonb_build_object('ok',true,'replayed',false,'status','PROCESANDO');
end $$;

create function private.abc_liberar_reservas_intento(
  p_empresa_id text,p_local_id text,p_intento_id uuid
) returns numeric
language plpgsql volatile security definer set search_path=''
as $$
declare v_total numeric(24,8);
begin
  select coalesce(sum(importe_reservado),0)::numeric(24,8) into v_total
    from public.reservas_saldo
   where empresa_id=p_empresa_id and local_id=p_local_id
     and intento_id=p_intento_id and estado='ACTIVA';
  update public.reservas_saldo set estado='LIBERADA',released_at=now()
   where empresa_id=p_empresa_id and local_id=p_local_id
     and intento_id=p_intento_id and estado='ACTIVA';
  return v_total;
end $$;

create function private.abc_aplicar_intento_confirmado(
  p_empresa_id text,p_local_id text,p_intento_id uuid
) returns numeric
language plpgsql volatile security definer set search_path=''
as $$
declare
  v_pago public.pagos%rowtype;
  v_total numeric(24,8); v_aplicado numeric(24,8):=0; r record;
begin
  select p.* into v_pago
    from public.pago_intentos i
    join public.pagos p on p.empresa_id=i.empresa_id and p.local_id=i.local_id and p.id=i.pago_id
   where i.empresa_id=p_empresa_id and i.local_id=p_local_id and i.id=p_intento_id;
  if not found then raise exception 'intento_no_encontrado'; end if;
  if v_pago.payment_currency_code<>v_pago.sale_currency_code then
    raise exception 'conversion_divisa_no_habilitada';
  end if;
  if exists(select 1 from public.pago_aplicaciones a
    where a.empresa_id=p_empresa_id and a.local_id=p_local_id and a.intento_id=p_intento_id) then
    raise exception 'intento_ya_aplicado';
  end if;
  select coalesce(sum(importe_reservado),0)::numeric(24,8) into v_total
    from public.reservas_saldo
   where empresa_id=p_empresa_id and local_id=p_local_id
     and intento_id=p_intento_id and estado='ACTIVA';
  if v_total<=0 then raise exception 'reservas_activas_requeridas'; end if;
  if v_total<>v_pago.importe_objetivo then raise exception 'reservas_no_cubren_pago'; end if;

  for r in
    select * from public.reservas_saldo
     where empresa_id=p_empresa_id and local_id=p_local_id
       and intento_id=p_intento_id and estado='ACTIVA'
     order by venta_fiscal_id,id
  loop
    insert into public.pago_aplicaciones(
      id,empresa_id,local_id,pago_id,intento_id,checkout_venta_id,venta_fiscal_id,
      payment_amount,payment_currency_code,sale_amount,sale_currency_code,fx_snapshot,confirmed_at
    ) values (
      gen_random_uuid(),p_empresa_id,p_local_id,v_pago.id,p_intento_id,
      r.checkout_venta_id,r.venta_fiscal_id,r.importe_reservado,v_pago.payment_currency_code,
      r.importe_reservado,r.sale_currency_code,jsonb_build_object('mode','IDENTITY','rate','1'),now()
    );
    v_aplicado:=v_aplicado+r.importe_reservado;
  end loop;

  update public.reservas_saldo set estado='CONSUMIDA',consumed_at=now()
   where empresa_id=p_empresa_id and local_id=p_local_id
     and intento_id=p_intento_id and estado='ACTIVA';
  return v_aplicado;
end $$;

create function private.abc_actualizar_checkout_estado(
  p_empresa_id text,p_local_id text,p_checkout_id uuid
) returns text
language plpgsql volatile security definer set search_path=''
as $$
declare v_pendientes integer; v_estado text;
begin
  select count(*) into v_pendientes from public.checkout_ventas cv
   where cv.empresa_id=p_empresa_id and cv.local_id=p_local_id and cv.checkout_id=p_checkout_id
     and private.abc_saldo_cobrable(cv.empresa_id,cv.local_id,cv.venta_fiscal_id)>0;
  if v_pendientes=0 then
    update public.checkouts set estado='COMPLETADO',completed_at=coalesce(completed_at,now()),
      cancelled_at=null,version=version+1
     where empresa_id=p_empresa_id and local_id=p_local_id and id=p_checkout_id
       and estado<>'COMPLETADO' returning estado into v_estado;
  else
    update public.checkouts set estado='EN_COBRO',completed_at=null,cancelled_at=null,
      version=case when estado<>'EN_COBRO' then version+1 else version end
     where empresa_id=p_empresa_id and local_id=p_local_id and id=p_checkout_id
       and estado in ('ABIERTO','EN_COBRO') returning estado into v_estado;
  end if;
  if v_estado is null then
    select estado into v_estado from public.checkouts
     where empresa_id=p_empresa_id and local_id=p_local_id and id=p_checkout_id;
  end if;
  if v_estado is null then raise exception 'checkout_no_encontrado'; end if;
  return v_estado;
end $$;

create function public.abc_abrir_checkout(
  p_operation_id text,p_empresa_id text,p_local_id text,p_checkout_id uuid,
  p_cuenta_id uuid,p_venta_ids uuid[],p_operating_day date
) returns jsonb
language plpgsql volatile security definer set search_path=''
as $$
declare
  v_cmd jsonb; v_request jsonb; v_currency text; v_count integer;
  v_id uuid; v_saldo numeric(24,8); v_result jsonb;
begin
  if auth.uid() is null
     or not private.abc_tiene_capacidad(p_empresa_id,p_local_id,'ABC_CUENTA_OPERAR') then
    raise exception 'abc_checkout_no_autorizado';
  end if;
  if p_checkout_id is null or p_cuenta_id is null or p_operating_day is null then
    raise exception 'checkout_parametros_requeridos';
  end if;
  if p_venta_ids is null or cardinality(p_venta_ids)=0 or array_position(p_venta_ids,null) is not null then
    raise exception 'venta_ids_invalidos';
  end if;
  v_request:=jsonb_build_object(
    'checkout_id',p_checkout_id,'cuenta_id',p_cuenta_id,
    'venta_ids',(select jsonb_agg(x order by x) from (select distinct unnest(p_venta_ids) x) s),
    'operating_day',p_operating_day
  );
  v_cmd:=private.abc_operacion_iniciar(
    p_operation_id,p_empresa_id,p_local_id,'ABC_ABRIR_CHECKOUT',v_request,null
  );
  if (v_cmd->>'replayed')::boolean then return coalesce(v_cmd->'resultado',v_cmd); end if;

  select c.currency_code into v_currency from public.cuentas_comerciales c
   where c.empresa_id=p_empresa_id and c.local_id=p_local_id
     and c.id=p_cuenta_id and c.estado='ABIERTA' for update;
  if not found then raise exception 'cuenta_no_abierta_o_no_encontrada'; end if;

  perform private.abc_bloquear_ventas(p_empresa_id,p_local_id,p_venta_ids);
  select count(*) into v_count from public.ventas_fiscales v
   where v.empresa_id=p_empresa_id and v.local_id=p_local_id and v.id=any(p_venta_ids)
     and v.cuenta_id=p_cuenta_id and v.currency_code=v_currency
     and v.estado in ('ABIERTA','BLOQUEADA');
  if v_count<>(select count(distinct x) from unnest(p_venta_ids) u(x)) then
    raise exception 'ventas_checkout_invalidas';
  end if;

  insert into public.checkouts(
    id,empresa_id,local_id,cuenta_id,currency_code,estado,version,created_by,operating_day
  ) values (
    p_checkout_id,p_empresa_id,p_local_id,p_cuenta_id,v_currency,'ABIERTO',1,auth.uid(),p_operating_day
  );

  for v_id in select distinct x from unnest(p_venta_ids) u(x) order by x loop
    v_saldo:=private.abc_saldo_cobrable(p_empresa_id,p_local_id,v_id);
    if v_saldo<=0 then raise exception 'venta_sin_saldo_cobrable'; end if;
    insert into public.checkout_ventas(
      id,empresa_id,local_id,checkout_id,venta_fiscal_id,currency_code,importe_objetivo
    ) values (gen_random_uuid(),p_empresa_id,p_local_id,p_checkout_id,v_id,v_currency,v_saldo);
  end loop;

  insert into public.abc_eventos(
    empresa_id,local_id,operation_id,aggregate_type,aggregate_id,event_type,
    payload,actor_user_id,occurred_at,operating_day
  ) values (
    p_empresa_id,p_local_id,p_operation_id,'CHECKOUT',p_checkout_id::text,'CHECKOUT_ABIERTO',
    jsonb_build_object('cuenta_id',p_cuenta_id,'currency_code',v_currency),
    auth.uid(),now(),p_operating_day
  );

  v_result:=jsonb_build_object('ok',true,'checkout_id',p_checkout_id,
    'currency_code',v_currency,'estado','ABIERTO');
  perform private.abc_operacion_completar(p_operation_id,v_result);
  return v_result;
end $$;

create function public.abc_iniciar_cobro(
  p_operation_id text,p_empresa_id text,p_local_id text,p_checkout_id uuid,
  p_pago_id uuid,p_intento_id uuid,p_medio text,p_importe_objetivo numeric,
  p_payment_currency_code text,p_terminal_id uuid,
  p_importe_recibido numeric default null,p_cambio_entregado numeric default null
) returns jsonb
language plpgsql volatile security definer set search_path=''
as $$
declare
  v_cmd jsonb; v_request jsonb; v_medio text:=upper(btrim(coalesce(p_medio,'')));
  v_payment_currency text:=upper(btrim(coalesce(p_payment_currency_code,'')));
  v_sale_currency text; v_operating_day date; v_total numeric(24,8):=0;
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

  select c.currency_code,c.operating_day into v_sale_currency,v_operating_day
    from public.checkouts c
   where c.empresa_id=p_empresa_id and c.local_id=p_local_id and c.id=p_checkout_id
     and c.estado in ('ABIERTO','EN_COBRO') for update;
  if not found then raise exception 'checkout_no_cobrable'; end if;
  if v_payment_currency<>v_sale_currency then raise exception 'conversion_divisa_no_habilitada'; end if;

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

  v_result:=jsonb_build_object('ok',true,'pago_id',p_pago_id,'intento_id',p_intento_id,
    'estado','PENDIENTE','importe_reservado',p_importe_objetivo);
  perform private.abc_operacion_completar(p_operation_id,v_result);
  return v_result;
end $$;

create function public.abc_confirmar_efectivo(
  p_operation_id text,p_empresa_id text,p_local_id text,p_intento_id uuid,
  p_caja_id uuid,p_session_id uuid,p_terminal_id uuid,p_operating_day date
) returns jsonb
language plpgsql volatile security definer set search_path=''
as $$
declare
  v_cmd jsonb; v_request jsonb; v_pago public.pagos%rowtype;
  v_aplicado numeric(24,8); v_checkout_estado text; v_cash_operation_id text;
  v_ids uuid[]; v_result jsonb;
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
end $$;

create function public.abc_resolver_intento(
  p_operation_id text,p_empresa_id text,p_local_id text,p_intento_id uuid,p_estado text,
  p_provider_code text,p_provider_reference text,p_authorized_amount numeric,
  p_captured_amount numeric,p_settled_amount numeric,p_provider_snapshot jsonb default '{}'::jsonb
) returns jsonb
language plpgsql volatile security definer set search_path=''
as $$
declare
  v_estado text:=upper(btrim(coalesce(p_estado,'')));
  v_provider text:=nullif(btrim(coalesce(p_provider_code,'')),'');
  v_reference text:=nullif(btrim(coalesce(p_provider_reference,'')),'');
  v_request jsonb; v_cmd jsonb; v_intento public.pago_intentos%rowtype;
  v_pago public.pagos%rowtype; v_terminal uuid; v_day date;
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

  if v_intento.estado in ('CONFIRMADO','RECHAZADO','CANCELADO') then
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
end $$;

revoke all on function private.abc_operacion_iniciar_sistema(text,text,text,text,jsonb,uuid,uuid,text) from public,anon,authenticated,service_role;
revoke all on function private.abc_liberar_reservas_intento(text,text,uuid) from public,anon,authenticated,service_role;
revoke all on function private.abc_aplicar_intento_confirmado(text,text,uuid) from public,anon,authenticated,service_role;
revoke all on function private.abc_actualizar_checkout_estado(text,text,uuid) from public,anon,authenticated,service_role;

revoke all on function public.abc_abrir_checkout(text,text,text,uuid,uuid,uuid[],date) from public,anon,authenticated,service_role;
revoke all on function public.abc_iniciar_cobro(text,text,text,uuid,uuid,uuid,text,numeric,text,uuid,numeric,numeric) from public,anon,authenticated,service_role;
revoke all on function public.abc_confirmar_efectivo(text,text,text,uuid,uuid,uuid,uuid,date) from public,anon,authenticated,service_role;
revoke all on function public.abc_resolver_intento(text,text,text,uuid,text,text,text,numeric,numeric,numeric,jsonb) from public,anon,authenticated,service_role;

grant execute on function public.abc_abrir_checkout(text,text,text,uuid,uuid,uuid[],date) to authenticated;
grant execute on function public.abc_iniciar_cobro(text,text,text,uuid,uuid,uuid,text,numeric,text,uuid,numeric,numeric) to authenticated;
grant execute on function public.abc_confirmar_efectivo(text,text,text,uuid,uuid,uuid,uuid,date) to authenticated;
grant execute on function public.abc_resolver_intento(text,text,text,uuid,text,text,text,numeric,numeric,numeric,jsonb) to service_role;
