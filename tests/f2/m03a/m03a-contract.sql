\set ON_ERROR_STOP on

insert into public.empresas(id,nombre) values
  ('E1','Empresa 1'),
  ('E2','Empresa 2');

insert into public.locales(id,empresa_id,nombre) values
  ('L1','E1','Local 1'),
  ('L2','E1','Local 2'),
  ('X1','E2','Local X1');

insert into auth.users(id) values
  ('11111111-1111-1111-1111-111111111111'),
  ('22222222-2222-2222-2222-222222222222');

insert into public.membresias_usuario(
  user_id,empresa_id,local_id,todos_locales,rol,activo
) values
  ('11111111-1111-1111-1111-111111111111','E1',null,true,'Cajero/a',true),
  ('11111111-1111-1111-1111-111111111111','E1','L2',false,'Camarero/a',true),
  ('22222222-2222-2222-2222-222222222222','E2','X1',false,'Propietario',true);

select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false);
select set_config('app.test_empresa','E1',false);
select set_config('app.test_local','L1',false);

do $$
begin
  if not private.abc_tiene_capacidad('E1','L1','ABC_COBRO_INICIAR') then
    raise exception 'M03A_FAIL: Cajero debe iniciar cobro';
  end if;
  if not private.abc_tiene_capacidad('E1','L1','ABC_COBRO_EFECTIVO') then
    raise exception 'M03A_FAIL: Cajero debe cobrar efectivo';
  end if;
  if private.abc_tiene_capacidad('E1','L1','ABC_REEMBOLSO_CONFIRMAR') then
    raise exception 'M03A_FAIL: Cajero no debe confirmar reembolso';
  end if;
  if private.abc_tiene_capacidad('E1','L1','CAPACIDAD_INEXISTENTE') then
    raise exception 'M03A_FAIL: capacidad desconocida concedida';
  end if;
end $$;

select set_config('app.test_local','L2',false);
do $$
begin
  if not private.abc_tiene_capacidad('E1','L2','ABC_COBRO_INICIAR') then
    raise exception 'M03A_FAIL: Camarero local debe iniciar cobro';
  end if;
  if private.abc_tiene_capacidad('E1','L2','ABC_COBRO_EFECTIVO') then
    raise exception 'M03A_FAIL: rol local Camarero debe prevalecer sobre Cajero todos_locales';
  end if;
end $$;
select set_config('app.test_local','L1',false);

do $$
declare h1 text; h2 text; h3 text;
begin
  h1:=private.abc_request_hash('{"a":1,"b":2}'::jsonb);
  h2:=private.abc_request_hash('{"b":2,"a":1}'::jsonb);
  h3:=private.abc_request_hash('{"a":1,"b":3}'::jsonb);
  if h1<>h2 then raise exception 'M03A_FAIL: hash JSONB no canonico'; end if;
  if h1=h3 then raise exception 'M03A_FAIL: hash no distingue request'; end if;
  if h1 !~ '^[0-9a-f]{64}$' then raise exception 'M03A_FAIL: hash no SHA256 hex'; end if;
end $$;

do $$
declare r jsonb;
begin
  r:=private.abc_operacion_iniciar(
    'M03A:idem:test:0001','E1','L1','TEST_COMMAND',
    '{"a":1,"b":2}'::jsonb,null
  );
  if (r->>'replayed')::boolean then raise exception 'M03A_FAIL: primer comando replay'; end if;

  perform private.abc_operacion_completar(
    'M03A:idem:test:0001','{"done":true}'::jsonb
  );

  r:=private.abc_operacion_iniciar(
    'M03A:idem:test:0001','E1','L1','TEST_COMMAND',
    '{"b":2,"a":1}'::jsonb,null
  );
  if not (r->>'replayed')::boolean or r->>'status'<>'COMPLETADA' then
    raise exception 'M03A_FAIL: replay equivalente no reconocido';
  end if;
  if r->'resultado'<>'{"done":true}'::jsonb then
    raise exception 'M03A_FAIL: resultado replay incorrecto';
  end if;

  begin
    perform private.abc_operacion_iniciar(
      'M03A:idem:test:0001','E1','L1','TEST_COMMAND',
      '{"a":999}'::jsonb,null
    );
    raise exception 'M03A_FAIL: operation_id conflict no bloqueado';
  exception when others then
    if sqlerrm not like '%operation_id_conflict%' then raise; end if;
  end;
end $$;

insert into public.caja_operaciones(
  operation_id,tipo,empresa_id,local_id,fecha,importe,efecto_efectivo,
  medio_pago,concepto,origen_tipo,payload,actor_user_id
) values (
  'M03A:legacy:collision:01','ENTRADA','E1','L1','2026-09-23',
  1,1,'EFECTIVO','Test','MANUAL','{}',
  '11111111-1111-1111-1111-111111111111'
);

do $$
begin
  begin
    perform private.abc_operacion_iniciar(
      'M03A:legacy:collision:01','E1','L1','TEST_COMMAND','{}',null
    );
    raise exception 'M03A_FAIL: operation_id global collision aceptada';
  exception when others then
    if sqlerrm not like '%operation_id_conflict%' then raise; end if;
  end;
end $$;

insert into public.entidades_fiscales(
  id,empresa_id,nombre_legal,identificador_fiscal,country_code,simulada
) values (
  '10000000-0000-0000-0000-000000000001','E1',
  'Entidad Fiscal A','SIM-A','ES',true
);
insert into public.entidad_fiscal_monedas(
  empresa_id,entidad_fiscal_id,currency_code,es_principal,activa
) values (
  'E1','10000000-0000-0000-0000-000000000001','EUR',true,true
);
insert into public.entidad_fiscal_locales(
  empresa_id,local_id,entidad_fiscal_id,activa
) values (
  'E1','L1','10000000-0000-0000-0000-000000000001',true
);
insert into public.entidad_fiscal_local_monedas(
  empresa_id,local_id,entidad_fiscal_id,currency_code,activa
) values (
  'E1','L1','10000000-0000-0000-0000-000000000001','EUR',true
);

insert into public.cuentas_comerciales(
  id,empresa_id,local_id,currency_code,modalidad,estado,version,
  created_by,opened_operating_day
) values (
  '30000000-0000-0000-0000-000000000001','E1','L1','EUR','MESA','ABIERTA',1,
  '11111111-1111-1111-1111-111111111111','2026-09-23'
);

insert into public.ventas_fiscales(
  id,empresa_id,local_id,cuenta_id,entidad_fiscal_id,currency_code,estado,version,
  subtotal,descuento_total,impuestos_total,total,snapshot_calculo,
  created_by,created_operating_day
) values (
  '70000000-0000-0000-0000-000000000001','E1','L1',
  '30000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001','EUR','ABIERTA',1,
  20,0,0,20,'{}',
  '11111111-1111-1111-1111-111111111111','2026-09-23'
);

insert into public.checkouts(
  id,empresa_id,local_id,cuenta_id,currency_code,estado,version,created_by,operating_day
) values (
  '40000000-0000-0000-0000-000000000001','E1','L1',
  '30000000-0000-0000-0000-000000000001','EUR','EN_COBRO',1,
  '11111111-1111-1111-1111-111111111111','2026-09-23'
);
insert into public.checkout_ventas(
  id,empresa_id,local_id,checkout_id,venta_fiscal_id,currency_code,importe_objetivo
) values (
  '41000000-0000-0000-0000-000000000001','E1','L1',
  '40000000-0000-0000-0000-000000000001',
  '70000000-0000-0000-0000-000000000001','EUR',20
);

select private.abc_operacion_iniciar(
  'M03A:pay:confirmed:01','E1','L1','PAY_CONFIRMED','{}',null
);
select private.abc_operacion_completar(
  'M03A:pay:confirmed:01','{"state":"confirmed"}'
);

insert into public.pagos(
  id,empresa_id,local_id,checkout_id,medio,estado,
  sale_currency_code,payment_currency_code,importe_objetivo,
  version,created_by,resolved_at
) values (
  '50000000-0000-0000-0000-000000000001','E1','L1',
  '40000000-0000-0000-0000-000000000001','TARJETA','CONFIRMADO',
  'EUR','EUR',8,1,'11111111-1111-1111-1111-111111111111',now()
);
insert into public.pago_intentos(
  id,empresa_id,local_id,pago_id,abc_command_id,estado,
  provider_code,provider_reference,requested_amount,payment_currency_code,
  authorized_amount,captured_amount,authorization_status,capture_status,
  settlement_status,resolved_at
) values (
  '60000000-0000-0000-0000-000000000001','E1','L1',
  '50000000-0000-0000-0000-000000000001',
  'M03A:pay:confirmed:01','CONFIRMADO','SIM','SIM-CONF-1',8,'EUR',
  8,8,'AUTORIZADO','CONFIRMADO','PENDIENTE',now()
);
insert into public.pago_aplicaciones(
  id,empresa_id,local_id,pago_id,intento_id,checkout_venta_id,venta_fiscal_id,
  payment_amount,payment_currency_code,sale_amount,sale_currency_code,
  fx_snapshot,confirmed_at
) values (
  '62000000-0000-0000-0000-000000000001','E1','L1',
  '50000000-0000-0000-0000-000000000001',
  '60000000-0000-0000-0000-000000000001',
  '41000000-0000-0000-0000-000000000001',
  '70000000-0000-0000-0000-000000000001',
  8,'EUR',8,'EUR','{}',now()
);

select private.abc_operacion_iniciar(
  'M03A:pay:unknown:0001','E1','L1','PAY_UNKNOWN','{}',null
);
select private.abc_operacion_completar(
  'M03A:pay:unknown:0001','{"state":"unknown"}'
);

insert into public.pagos(
  id,empresa_id,local_id,checkout_id,medio,estado,
  sale_currency_code,payment_currency_code,importe_objetivo,
  version,created_by
) values (
  '50000000-0000-0000-0000-000000000002','E1','L1',
  '40000000-0000-0000-0000-000000000001','TARJETA','DESCONOCIDO',
  'EUR','EUR',5,1,'11111111-1111-1111-1111-111111111111'
);
insert into public.pago_intentos(
  id,empresa_id,local_id,pago_id,abc_command_id,estado,
  provider_code,provider_reference,requested_amount,payment_currency_code,
  authorization_status,capture_status,settlement_status
) values (
  '60000000-0000-0000-0000-000000000002','E1','L1',
  '50000000-0000-0000-0000-000000000002',
  'M03A:pay:unknown:0001','DESCONOCIDO','SIM','SIM-UNK-1',5,'EUR',
  'DESCONOCIDO','DESCONOCIDO','PENDIENTE'
);
insert into public.reservas_saldo(
  id,empresa_id,local_id,intento_id,checkout_venta_id,venta_fiscal_id,
  sale_currency_code,importe_reservado,estado
) values (
  '61000000-0000-0000-0000-000000000001','E1','L1',
  '60000000-0000-0000-0000-000000000002',
  '41000000-0000-0000-0000-000000000001',
  '70000000-0000-0000-0000-000000000001','EUR',5,'ACTIVA'
);

do $$
declare c numeric; d numeric;
begin
  c:=private.abc_saldo_cobrable(
    'E1','L1','70000000-0000-0000-0000-000000000001'
  );
  d:=private.abc_saldo_disponible(
    'E1','L1','70000000-0000-0000-0000-000000000001'
  );
  if c<>12 then raise exception 'M03A_FAIL: saldo cobrable esperado 12, obtenido %',c; end if;
  if d<>7 then raise exception 'M03A_FAIL: saldo disponible esperado 7, obtenido %',d; end if;
  if not exists(
    select 1
      from public.reservas_saldo r
      join public.pago_intentos i on i.id=r.intento_id
     where i.estado='DESCONOCIDO' and r.estado='ACTIVA'
  ) then
    raise exception 'M03A_FAIL: UNKNOWN no conserva reserva activa';
  end if;
end $$;

select private.abc_operacion_iniciar(
  'M03A:refund:pending:1','E1','L1','REFUND_PENDING','{}',null
);
select private.abc_operacion_completar(
  'M03A:refund:pending:1','{"state":"pending"}'
);
insert into public.reembolsos(
  id,empresa_id,local_id,pago_id,abc_command_id,estado,
  payment_currency_code,importe_solicitado,motivo,created_by
) values (
  '80000000-0000-0000-0000-000000000001','E1','L1',
  '50000000-0000-0000-0000-000000000001',
  'M03A:refund:pending:1','PENDIENTE','EUR',3,
  'Test pendiente','11111111-1111-1111-1111-111111111111'
);
insert into public.reembolso_aplicaciones(
  id,empresa_id,local_id,reembolso_id,pago_aplicacion_id,venta_fiscal_id,
  importe_venta,sale_currency_code,importe_pago,payment_currency_code
) values (
  '81000000-0000-0000-0000-000000000001','E1','L1',
  '80000000-0000-0000-0000-000000000001',
  '62000000-0000-0000-0000-000000000001',
  '70000000-0000-0000-0000-000000000001',
  3,'EUR',3,'EUR'
);

select private.abc_operacion_iniciar(
  'M03A:refund:reject:01','E1','L1','REFUND_REJECT','{}',null
);
select private.abc_operacion_completar(
  'M03A:refund:reject:01','{"state":"rejected"}'
);
insert into public.reembolsos(
  id,empresa_id,local_id,pago_id,abc_command_id,estado,
  payment_currency_code,importe_solicitado,motivo,created_by,resolved_at
) values (
  '80000000-0000-0000-0000-000000000002','E1','L1',
  '50000000-0000-0000-0000-000000000001',
  'M03A:refund:reject:01','RECHAZADO','EUR',2,
  'Test rechazado','11111111-1111-1111-1111-111111111111',now()
);
insert into public.reembolso_aplicaciones(
  id,empresa_id,local_id,reembolso_id,pago_aplicacion_id,venta_fiscal_id,
  importe_venta,sale_currency_code,importe_pago,payment_currency_code
) values (
  '81000000-0000-0000-0000-000000000002','E1','L1',
  '80000000-0000-0000-0000-000000000002',
  '62000000-0000-0000-0000-000000000001',
  '70000000-0000-0000-0000-000000000001',
  2,'EUR',2,'EUR'
);

do $$
declare p numeric; s numeric;
begin
  p:=private.abc_max_reembolsable_pago(
    'E1','L1','62000000-0000-0000-0000-000000000001'
  );
  s:=private.abc_max_reembolsable_venta(
    'E1','L1','62000000-0000-0000-0000-000000000001'
  );
  if p<>5 or s<>5 then
    raise exception 'M03A_FAIL: max reembolsable esperado 5/5, obtenido %/%',p,s;
  end if;
end $$;

select private.abc_bloquear_ventas(
  'E1','L1',array['70000000-0000-0000-0000-000000000001'::uuid]
);
select private.abc_bloquear_aplicaciones(
  'E1','L1',array['62000000-0000-0000-0000-000000000001'::uuid]
);

do $$
declare n integer;
begin
  select count(*) into n
    from pg_proc p join pg_namespace ns on ns.oid=p.pronamespace
   where ns.nspname='private'
     and p.proname in (
       'abc_tiene_capacidad','abc_request_hash','abc_lock_operation_id',
       'abc_operacion_iniciar','abc_operacion_completar','abc_operacion_fallar',
       'abc_saldo_cobrable','abc_saldo_disponible',
       'abc_max_reembolsable_pago','abc_max_reembolsable_venta',
       'abc_bloquear_ventas','abc_bloquear_aplicaciones'
     );
  if n<>12 then raise exception 'M03A_FAIL: esperaba 12 funciones, obtuvo %',n; end if;

  select count(*) into n
    from pg_proc p join pg_namespace ns on ns.oid=p.pronamespace
   where ns.nspname='public' and p.proname like 'abc_%';
  if n<>0 then raise exception 'M03A_FAIL: se expusieron funciones abc publicas: %',n; end if;

  if has_function_privilege(
       'authenticated','private.abc_tiene_capacidad(text,text,text)','EXECUTE'
     )
     or has_function_privilege(
       'authenticated','private.abc_operacion_iniciar(text,text,text,text,jsonb,uuid)','EXECUTE'
     )
     or has_function_privilege(
       'anon','private.abc_operacion_iniciar(text,text,text,text,jsonb,uuid)','EXECUTE'
     ) then
    raise exception 'M03A_FAIL: helpers privados ejecutables por cliente';
  end if;
end $$;

select 'ABC_F2_M03A_CONTRACT=PASS' as resultado;
