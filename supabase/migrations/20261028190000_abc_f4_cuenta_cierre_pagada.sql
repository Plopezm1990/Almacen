-- QA-first: cierre autoritativo de una cuenta comercial cuyo checkout ya está
-- completamente pagado. No modifica producción por sí solo.

do $$
declare
  v_missing text[] := array[]::text[];
begin
  if to_regclass('public.cuentas_comerciales') is null then v_missing := array_append(v_missing,'cuentas_comerciales'); end if;
  if to_regclass('public.checkouts') is null then v_missing := array_append(v_missing,'checkouts'); end if;
  if to_regclass('public.checkout_ventas') is null then v_missing := array_append(v_missing,'checkout_ventas'); end if;
  if to_regclass('public.pagos') is null then v_missing := array_append(v_missing,'pagos'); end if;
  if to_regclass('public.pago_aplicaciones') is null then v_missing := array_append(v_missing,'pago_aplicaciones'); end if;
  if to_regclass('public.pago_intentos') is null then v_missing := array_append(v_missing,'pago_intentos'); end if;
  if to_regclass('public.ventas_fiscales') is null then v_missing := array_append(v_missing,'ventas_fiscales'); end if;
  if to_regclass('public.pedidos_tpv') is null then v_missing := array_append(v_missing,'pedidos_tpv'); end if;
  if to_regclass('public.abc_eventos') is null then v_missing := array_append(v_missing,'abc_eventos'); end if;
  if to_regprocedure('private.abc_tiene_capacidad(text,text,text)') is null then v_missing := array_append(v_missing,'abc_tiene_capacidad'); end if;
  if to_regprocedure('private.abc_terminal_sesion_operativa(text,text,uuid,uuid)') is null then v_missing := array_append(v_missing,'abc_terminal_sesion_operativa'); end if;
  if to_regprocedure('private.abc_operacion_iniciar(text,text,text,text,jsonb,uuid)') is null then v_missing := array_append(v_missing,'abc_operacion_iniciar'); end if;
  if to_regprocedure('private.abc_operacion_completar(text,jsonb)') is null then v_missing := array_append(v_missing,'abc_operacion_completar'); end if;
  if to_regprocedure('private.abc_operacion_fallar(text,jsonb)') is null then v_missing := array_append(v_missing,'abc_operacion_fallar'); end if;
  if to_regprocedure('private.abc_registrar_transicion_pedido(text,text,uuid,text,text,text,text,uuid,uuid,uuid,date,jsonb)') is null then v_missing := array_append(v_missing,'abc_registrar_transicion_pedido'); end if;
  if cardinality(v_missing) > 0 then
    raise exception 'ABC_F4_CIERRE_CUENTA_PREFLIGHT_FALLO:%', array_to_string(v_missing, ',');
  end if;
end $$;

create or replace function public.abc_cerrar_cuenta_pagada(
  p_operation_id text,
  p_empresa_id text,
  p_local_id text,
  p_cuenta_id uuid,
  p_checkout_id uuid,
  p_expected_cuenta_version bigint,
  p_terminal_id uuid,
  p_session_id uuid,
  p_operating_day date
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_cmd jsonb;
  v_request jsonb;
  v_result jsonb;
  v_cuenta public.cuentas_comerciales%rowtype;
  v_checkout public.checkouts%rowtype;
  v_total numeric(24,8) := 0;
  v_confirmado numeric(24,8) := 0;
  v_pedidos_cerrados integer := 0;
  v_pedido record;
  v_pedido_ids uuid[] := array[]::uuid[];
begin
  if auth.uid() is null
     or not private.abc_tiene_capacidad(p_empresa_id,p_local_id,'ABC_CUENTA_OPERAR') then
    raise exception 'cuenta_cierre_no_autorizado';
  end if;
  if nullif(btrim(coalesce(p_operation_id,'')),'') is null
     or p_empresa_id is null or p_local_id is null or p_cuenta_id is null
     or p_checkout_id is null or p_expected_cuenta_version is null
     or p_terminal_id is null or p_session_id is null or p_operating_day is null then
    raise exception 'cuenta_cierre_parametros_requeridos';
  end if;
  if not private.abc_terminal_sesion_operativa(
    p_empresa_id,p_local_id,p_terminal_id,p_session_id
  ) then
    raise exception 'terminal_sesion_no_operativa';
  end if;

  v_request := jsonb_build_object(
    'cuenta_id',p_cuenta_id,
    'checkout_id',p_checkout_id,
    'expected_cuenta_version',p_expected_cuenta_version,
    'terminal_id',p_terminal_id,
    'session_id',p_session_id,
    'operating_day',p_operating_day
  );
  v_cmd := private.abc_operacion_iniciar(
    p_operation_id,p_empresa_id,p_local_id,'ABC_CERRAR_CUENTA_PAGADA',v_request,p_terminal_id
  );
  if (v_cmd->>'replayed')::boolean then
    return coalesce(v_cmd->'resultado',v_cmd);
  end if;

  select * into v_cuenta
    from public.cuentas_comerciales
   where empresa_id=p_empresa_id and local_id=p_local_id and id=p_cuenta_id
   for update;
  if not found then raise exception 'cuenta_no_encontrada'; end if;
  if v_cuenta.estado='CERRADA' then raise exception 'cuenta_ya_cerrada'; end if;
  if v_cuenta.estado<>'ABIERTA' then raise exception 'cuenta_no_cerrable'; end if;
  if v_cuenta.version<>p_expected_cuenta_version then raise exception 'cuenta_version_conflict'; end if;

  select * into v_checkout
    from public.checkouts
   where empresa_id=p_empresa_id and local_id=p_local_id and id=p_checkout_id
     and cuenta_id=p_cuenta_id and estado='COMPLETADO'
   for update;
  if not found then raise exception 'checkout_no_completado'; end if;
  if v_checkout.operating_day<>p_operating_day then raise exception 'operating_day_checkout_inconsistente'; end if;

  if exists(
    select 1 from public.checkouts c
     where c.empresa_id=p_empresa_id and c.local_id=p_local_id
       and c.cuenta_id=p_cuenta_id and c.estado in ('ABIERTO','EN_COBRO')
  ) then
    raise exception 'cuenta_checkout_abierto';
  end if;
  if not exists(
    select 1 from public.checkout_ventas cv
     where cv.empresa_id=p_empresa_id and cv.local_id=p_local_id
       and cv.checkout_id=p_checkout_id
  ) then
    raise exception 'checkout_sin_ventas';
  end if;

  select coalesce(sum(v.total),0)::numeric(24,8)
    into v_total
    from public.ventas_fiscales v
   where v.empresa_id=p_empresa_id and v.local_id=p_local_id
     and v.cuenta_id=p_cuenta_id and v.estado<>'CANCELADA';
  select coalesce(sum(a.sale_amount),0)::numeric(24,8)
    into v_confirmado
    from public.pago_aplicaciones a
    join public.pago_intentos i
      on i.empresa_id=a.empresa_id and i.local_id=a.local_id and i.id=a.intento_id
    join public.ventas_fiscales v
      on v.empresa_id=a.empresa_id and v.local_id=a.local_id and v.id=a.venta_fiscal_id
   where a.empresa_id=p_empresa_id and a.local_id=p_local_id
     and v.cuenta_id=p_cuenta_id and v.estado<>'CANCELADA' and i.estado='CONFIRMADO';
  if v_total<=0 then raise exception 'cuenta_sin_importe_cobrable'; end if;
  if abs(v_total-v_confirmado)>0.000001 then raise exception 'cuenta_saldo_pendiente'; end if;

  if exists(
    select 1 from public.pagos p
     where p.empresa_id=p_empresa_id and p.local_id=p_local_id
       and p.checkout_id=p_checkout_id
       and p.estado not in ('CONFIRMADO','REEMBOLSADO')
  ) then
    raise exception 'cuenta_pago_no_resuelto';
  end if;
  if exists(
    select 1
      from public.reservas_saldo r
      join public.checkout_ventas cv
        on cv.empresa_id=r.empresa_id and cv.local_id=r.local_id and cv.id=r.checkout_venta_id
     where r.empresa_id=p_empresa_id and r.local_id=p_local_id
       and cv.checkout_id=p_checkout_id and r.estado='ACTIVA'
  ) then
    raise exception 'cuenta_reserva_saldo_activa';
  end if;
  if to_regclass('public.abc_cobro_incidencias') is not null and exists(
    select 1
      from public.abc_cobro_incidencias i
      join public.pago_intentos pi
        on pi.empresa_id=i.empresa_id and pi.local_id=i.local_id and pi.id=i.intento_id
      join public.pagos p
        on p.empresa_id=pi.empresa_id and p.local_id=pi.local_id and p.id=pi.pago_id
      join public.checkouts c
        on c.empresa_id=p.empresa_id and c.local_id=p.local_id and c.id=p.checkout_id
     where i.empresa_id=p_empresa_id and i.local_id=p_local_id
       and c.cuenta_id=p_cuenta_id and i.estado='ABIERTA'
  ) then
    raise exception 'cuenta_incidencia_cobro_abierta';
  end if;

  for v_pedido in
    select p.*
      from public.pedidos_tpv p
     where p.empresa_id=p_empresa_id and p.local_id=p_local_id and p.cuenta_id=p_cuenta_id
     order by p.created_at,p.id
     for update
  loop
    if v_pedido.estado not in ('SERVIDO','CERRADO','CANCELADO') then
      raise exception 'cuenta_pedido_no_cerrable';
    end if;
    if v_pedido.estado='SERVIDO' then
      update public.pedidos_tpv
         set estado='CERRADO',closed_at=now(),version=version+1
       where empresa_id=p_empresa_id and local_id=p_local_id and id=v_pedido.id;
      perform private.abc_registrar_transicion_pedido(
        p_empresa_id,p_local_id,v_pedido.id,p_operation_id,
        v_pedido.estado,'CERRADO',null,auth.uid(),p_terminal_id,p_session_id,
        p_operating_day,jsonb_build_object('cierre','CUENTA_PAGADA','checkout_id',p_checkout_id)
      );
      v_pedidos_cerrados:=v_pedidos_cerrados+1;
      v_pedido_ids:=array_append(v_pedido_ids,v_pedido.id);
    end if;
  end loop;

  update public.cuentas_comerciales
     set estado='CERRADA',closed_at=now(),version=version+1
   where empresa_id=p_empresa_id and local_id=p_local_id and id=p_cuenta_id
  returning version into v_cuenta.version;

  insert into public.abc_eventos(
    empresa_id,local_id,operation_id,aggregate_type,aggregate_id,event_type,
    payload,actor_user_id,terminal_id,occurred_at,operating_day
  ) values (
    p_empresa_id,p_local_id,p_operation_id,'CUENTA',p_cuenta_id::text,
    'CUENTA_CERRADA_PAGADA',
    jsonb_build_object(
      'checkout_id',p_checkout_id,
      'importe_total',v_total,
      'importe_confirmado',v_confirmado,
      'cuenta_version',v_cuenta.version,
      'pedidos_cerrados',v_pedidos_cerrados,
      'pedido_ids',to_jsonb(v_pedido_ids)
    ),
    auth.uid(),p_terminal_id,now(),p_operating_day
  );

  v_result:=jsonb_build_object(
    'ok',true,'replayed',false,'cuenta_id',p_cuenta_id,
    'checkout_id',p_checkout_id,'estado','CERRADA',
    'cuenta_version',v_cuenta.version,'closed_at',now(),
    'importe_total',v_total,'importe_confirmado',v_confirmado,
    'pedidos_cerrados',v_pedidos_cerrados
  );
  perform private.abc_operacion_completar(p_operation_id,v_result);
  return v_result;
exception when others then
  begin
    perform private.abc_operacion_fallar(
      p_operation_id,jsonb_build_object('sqlstate',sqlstate,'message',sqlerrm)
    );
  exception when others then null; end;
  raise;
end $$;

revoke all on function public.abc_cerrar_cuenta_pagada(text,text,text,uuid,uuid,bigint,uuid,uuid,date)
  from public,anon,authenticated,service_role;
grant execute on function public.abc_cerrar_cuenta_pagada(text,text,text,uuid,uuid,bigint,uuid,uuid,date)
  to authenticated;

-- Expone el estado comercial junto al estado del cobro para que el TPV pueda
-- distinguir PAGADO de cuenta ABIERTA/CERRADA tras una recarga.
create or replace function public.abc_estado_cobro_cuenta(
  p_empresa_id text,
  p_local_id text,
  p_cuenta_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_total numeric(24,8);
  v_confirmado numeric(24,8);
  v_saldo numeric(24,8);
  v_estado text;
  v_cuenta_estado text;
  v_cuenta_version bigint;
  v_closed_at timestamptz;
begin
  if auth.uid() is null
     or not private.abc_tiene_capacidad(p_empresa_id,p_local_id,'ABC_CUENTA_OPERAR') then
    raise exception 'estado_cobro_no_autorizado';
  end if;

  select c.estado,c.version,c.closed_at
    into v_cuenta_estado,v_cuenta_version,v_closed_at
    from public.cuentas_comerciales c
   where c.empresa_id=p_empresa_id and c.local_id=p_local_id and c.id=p_cuenta_id;
  if not found then raise exception 'cuenta_no_encontrada'; end if;

  select coalesce(sum(v.total),0)::numeric(24,8)
    into v_total
    from public.ventas_fiscales v
   where v.empresa_id=p_empresa_id and v.local_id=p_local_id
     and v.cuenta_id=p_cuenta_id and v.estado<>'CANCELADA';
  select coalesce(sum(a.sale_amount),0)::numeric(24,8)
    into v_confirmado
    from public.pago_aplicaciones a
    join public.pago_intentos i
      on i.empresa_id=a.empresa_id and i.local_id=a.local_id and i.id=a.intento_id
    join public.ventas_fiscales v
      on v.empresa_id=a.empresa_id and v.local_id=a.local_id and v.id=a.venta_fiscal_id
   where a.empresa_id=p_empresa_id and a.local_id=p_local_id
     and v.cuenta_id=p_cuenta_id and v.estado<>'CANCELADA' and i.estado='CONFIRMADO';

  if v_confirmado>v_total then raise exception 'estado_cobro_inconsistente'; end if;
  v_saldo:=(v_total-v_confirmado)::numeric(24,8);
  v_estado:=case
    when v_total=0 then 'SIN_COBRO'
    when v_confirmado=0 then 'PENDIENTE'
    when v_confirmado<v_total then 'PARCIALMENTE_PAGADO'
    else 'PAGADO'
  end;
  return jsonb_build_object(
    'cuenta_id',p_cuenta_id,'estado',v_estado,'total',v_total,
    'confirmado',v_confirmado,'saldo',v_saldo,
    'cuenta_estado',v_cuenta_estado,'cuenta_version',v_cuenta_version,
    'closed_at',v_closed_at
  );
end $$;

revoke all on function public.abc_estado_cobro_cuenta(text,text,uuid)
  from public,anon,authenticated,service_role;
grant execute on function public.abc_estado_cobro_cuenta(text,text,uuid)
  to authenticated;
