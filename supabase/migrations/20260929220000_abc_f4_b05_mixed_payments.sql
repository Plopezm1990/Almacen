-- ABC F4 B05 — efectivo, pagos parciales y pagos mixtos.
-- La escritura sigue pasando por abc_iniciar_cobro/abc_confirmar_efectivo,
-- que bloquean el checkout y calculan el saldo disponible en el servidor.
-- Esta RPC expone el desglose necesario para explicar el saldo sin confiar
-- en cálculos del navegador y conserva la trazabilidad de caja.

do $$
declare
  v_missing text[] := array[]::text[];
begin
  if to_regprocedure('public.abc_estado_cobro_cuenta(text,text,uuid)') is null then
    v_missing:=array_append(v_missing,'abc_estado_cobro_cuenta');
  end if;
  if to_regclass('public.checkouts') is null then v_missing:=array_append(v_missing,'checkouts'); end if;
  if to_regclass('public.pagos') is null then v_missing:=array_append(v_missing,'pagos'); end if;
  if to_regclass('public.pago_intentos') is null then v_missing:=array_append(v_missing,'pago_intentos'); end if;
  if to_regclass('public.reservas_saldo') is null then v_missing:=array_append(v_missing,'reservas_saldo'); end if;
  if to_regclass('public.caja_operaciones') is null then v_missing:=array_append(v_missing,'caja_operaciones'); end if;
  if to_regprocedure('private.abc_tiene_capacidad(text,text,text)') is null then
    v_missing:=array_append(v_missing,'abc_tiene_capacidad');
  end if;
  if cardinality(v_missing)>0 then
    raise exception 'ABC_F4_B05_PREFLIGHT_FALLO:%',array_to_string(v_missing,',');
  end if;
  if to_regprocedure('public.abc_estado_pago_mixto_cuenta(text,text,uuid)') is not null then
    raise exception 'ABC_F4_B05_PREFLIGHT_FALLO: RPC ya existe';
  end if;
end $$;

create function public.abc_estado_pago_mixto_cuenta(
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
  v_resumen jsonb;
  v_pagos jsonb;
  v_intentos jsonb;
  v_cajas jsonb;
  v_reservado numeric(24,8);
  v_efectivo_recibido numeric(24,8);
  v_cambio numeric(24,8);
begin
  if auth.uid() is null
     or not private.abc_tiene_capacidad(p_empresa_id,p_local_id,'ABC_CUENTA_OPERAR') then
    raise exception 'estado_cobro_no_autorizado';
  end if;

  v_resumen:=public.abc_estado_cobro_cuenta(p_empresa_id,p_local_id,p_cuenta_id);

  if not exists(
    select 1 from public.cuentas_comerciales c
     where c.empresa_id=p_empresa_id and c.local_id=p_local_id and c.id=p_cuenta_id
  ) then
    raise exception 'cuenta_no_encontrada';
  end if;

  select coalesce(sum(r.importe_reservado),0)::numeric(24,8)
    into v_reservado
    from public.reservas_saldo r
    join public.checkout_ventas cv
      on cv.empresa_id=r.empresa_id and cv.local_id=r.local_id
     and cv.id=r.checkout_venta_id and cv.venta_fiscal_id=r.venta_fiscal_id
    join public.checkouts c
      on c.empresa_id=cv.empresa_id and c.local_id=cv.local_id
     and c.id=cv.checkout_id
   where r.empresa_id=p_empresa_id and r.local_id=p_local_id
     and c.cuenta_id=p_cuenta_id and r.estado='ACTIVA';

  select coalesce(sum(case when p.medio='EFECTIVO' then p.importe_recibido else 0 end),0)::numeric(24,8),
         coalesce(sum(case when p.medio='EFECTIVO' then p.cambio_entregado else 0 end),0)::numeric(24,8)
    into v_efectivo_recibido,v_cambio
    from public.pagos p
    join public.checkouts c
      on c.empresa_id=p.empresa_id and c.local_id=p.local_id and c.id=p.checkout_id
   where p.empresa_id=p_empresa_id and p.local_id=p_local_id
     and c.cuenta_id=p_cuenta_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',p.id,'checkout_id',p.checkout_id,'medio',p.medio,'estado',p.estado,
    'importe_objetivo',p.importe_objetivo,'importe_recibido',p.importe_recibido,
    'cambio_entregado',p.cambio_entregado,'payment_currency_code',p.payment_currency_code,
    'created_at',p.created_at,'resolved_at',p.resolved_at
  ) order by p.created_at desc),'[]'::jsonb)
    into v_pagos
    from public.pagos p
    join public.checkouts c
      on c.empresa_id=p.empresa_id and c.local_id=p.local_id and c.id=p.checkout_id
   where p.empresa_id=p_empresa_id and p.local_id=p_local_id and c.cuenta_id=p_cuenta_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',i.id,'pago_id',i.pago_id,'estado',i.estado,'provider_code',i.provider_code,
    'provider_reference',i.provider_reference,'requested_amount',i.requested_amount,
    'authorized_amount',i.authorized_amount,'captured_amount',i.captured_amount,
    'settled_amount',i.settled_amount,'authorization_status',i.authorization_status,
    'capture_status',i.capture_status,'settlement_status',i.settlement_status,
    'started_at',i.started_at,'resolved_at',i.resolved_at
  ) order by i.started_at desc),'[]'::jsonb)
    into v_intentos
    from public.pago_intentos i
    join public.pagos p
      on p.empresa_id=i.empresa_id and p.local_id=i.local_id and p.id=i.pago_id
    join public.checkouts c
      on c.empresa_id=p.empresa_id and c.local_id=p.local_id and c.id=p.checkout_id
   where i.empresa_id=p_empresa_id and i.local_id=p_local_id and c.cuenta_id=p_cuenta_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'pago_id',o.origen_id,'caja_id',o.caja_id,'session_id',o.session_id,
    'terminal_id',o.terminal_id,'importe',o.importe,'efecto_efectivo',o.efecto_efectivo,
    'payload',o.payload,'created_at',o.created_at
  ) order by o.created_at desc),'[]'::jsonb)
    into v_cajas
    from public.caja_operaciones o
   where o.empresa_id=p_empresa_id and o.local_id=p_local_id
     and o.origen_tipo='ABC_PAGO'
     and exists(
       select 1 from public.pagos p
       join public.checkouts c
         on c.empresa_id=p.empresa_id and c.local_id=p.local_id and c.id=p.checkout_id
        and c.cuenta_id=p_cuenta_id
       where p.empresa_id=o.empresa_id and p.local_id=o.local_id and p.id::text=o.origen_id
     );

  return v_resumen || jsonb_build_object(
    'reservado',v_reservado,
    'disponible_para_nuevo_cobro',greatest(0,(v_resumen->>'saldo')::numeric-v_reservado),
    'efectivo_recibido',v_efectivo_recibido,
    'cambio_entregado',v_cambio,
    'pagos',v_pagos,
    'intentos',v_intentos,
    'cajas',v_cajas
  );
end $$;

revoke all on function public.abc_estado_pago_mixto_cuenta(text,text,uuid)
  from public,anon,authenticated,service_role;
grant execute on function public.abc_estado_pago_mixto_cuenta(text,text,uuid)
  to authenticated;

comment on function public.abc_estado_pago_mixto_cuenta(text,text,uuid) is
  'B05: desglose server-authoritative de pagos parciales/mixtos, cambio y caja; no calcula ni confirma cobros.';
