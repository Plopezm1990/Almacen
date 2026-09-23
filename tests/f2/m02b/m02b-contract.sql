\set ON_ERROR_STOP on

do $$
declare missing text[];
begin
  select array_agg(x) into missing
  from unnest(array[
    'checkouts','checkout_ventas','pagos','pago_intentos',
    'reservas_saldo','pago_aplicaciones','reembolsos','reembolso_aplicaciones'
  ]) x
  where to_regclass('public.'||x) is null;
  if missing is not null then
    raise exception 'M02B tablas ausentes: %',missing;
  end if;
end $$;

insert into public.empresas(id,nombre) values
  ('E1','Empresa 1'),
  ('E2','Empresa 2');

insert into public.locales(id,empresa_id,nombre) values
  ('L1','E1','Local 1'),
  ('L2','E2','Local 2');

insert into auth.users(id) values
  ('11111111-1111-1111-1111-111111111111'),
  ('22222222-2222-2222-2222-222222222222');

insert into public.entidades_fiscales(
  id,empresa_id,nombre_legal,identificador_fiscal,country_code,simulada
) values
  ('10000000-0000-0000-0000-000000000001','E1','Entidad Fiscal A','SIM-A','ES',true),
  ('10000000-0000-0000-0000-000000000002','E1','Entidad Fiscal B','SIM-B','ES',true),
  ('20000000-0000-0000-0000-000000000001','E2','Entidad Fiscal E2','SIM-E2','ES',true);

insert into public.entidad_fiscal_monedas(
  empresa_id,entidad_fiscal_id,currency_code,es_principal,activa
) values
  ('E1','10000000-0000-0000-0000-000000000001','EUR',true,true),
  ('E1','10000000-0000-0000-0000-000000000002','EUR',true,true),
  ('E2','20000000-0000-0000-0000-000000000001','EUR',true,true);

insert into public.entidad_fiscal_locales(
  empresa_id,local_id,entidad_fiscal_id,activa
) values
  ('E1','L1','10000000-0000-0000-0000-000000000001',true),
  ('E1','L1','10000000-0000-0000-0000-000000000002',true),
  ('E2','L2','20000000-0000-0000-0000-000000000001',true);

insert into public.entidad_fiscal_local_monedas(
  empresa_id,local_id,entidad_fiscal_id,currency_code,activa
) values
  ('E1','L1','10000000-0000-0000-0000-000000000001','EUR',true),
  ('E1','L1','10000000-0000-0000-0000-000000000002','EUR',true),
  ('E2','L2','20000000-0000-0000-0000-000000000001','EUR',true);

insert into public.cuentas_comerciales(
  id,empresa_id,local_id,currency_code,modalidad,estado,version,
  created_by,opened_operating_day
) values
  ('30000000-0000-0000-0000-000000000001','E1','L1','EUR','MESA','ABIERTA',1,
   '11111111-1111-1111-1111-111111111111','2026-09-23'),
  ('30000000-0000-0000-0000-000000000002','E2','L2','EUR','MESA','ABIERTA',1,
   '22222222-2222-2222-2222-222222222222','2026-09-23');

insert into public.ventas_fiscales(
  id,empresa_id,local_id,cuenta_id,entidad_fiscal_id,currency_code,estado,version,
  subtotal,descuento_total,impuestos_total,total,snapshot_calculo,
  created_by,created_operating_day
) values
  ('70000000-0000-0000-0000-000000000001','E1','L1',
   '30000000-0000-0000-0000-000000000001',
   '10000000-0000-0000-0000-000000000001','EUR','ABIERTA',1,
   10.07,0,0,10.07,'{}',
   '11111111-1111-1111-1111-111111111111','2026-09-23'),
  ('70000000-0000-0000-0000-000000000002','E1','L1',
   '30000000-0000-0000-0000-000000000001',
   '10000000-0000-0000-0000-000000000002','EUR','ABIERTA',1,
   10.97,0,0,10.97,'{}',
   '11111111-1111-1111-1111-111111111111','2026-09-23'),
  ('70000000-0000-0000-0000-000000000003','E2','L2',
   '30000000-0000-0000-0000-000000000002',
   '20000000-0000-0000-0000-000000000001','EUR','ABIERTA',1,
   5,0,0,5,'{}',
   '22222222-2222-2222-2222-222222222222','2026-09-23');

insert into public.checkouts(
  id,empresa_id,local_id,cuenta_id,currency_code,estado,version,created_by,operating_day
) values (
  '40000000-0000-0000-0000-000000000001','E1','L1',
  '30000000-0000-0000-0000-000000000001','EUR','EN_COBRO',1,
  '11111111-1111-1111-1111-111111111111','2026-09-23'
);

insert into public.checkout_ventas(
  id,empresa_id,local_id,checkout_id,venta_fiscal_id,currency_code,importe_objetivo
) values
  ('41000000-0000-0000-0000-000000000001','E1','L1',
   '40000000-0000-0000-0000-000000000001',
   '70000000-0000-0000-0000-000000000001','EUR',10.07),
  ('41000000-0000-0000-0000-000000000002','E1','L1',
   '40000000-0000-0000-0000-000000000001',
   '70000000-0000-0000-0000-000000000002','EUR',10.97);

do $$
begin
  begin
    insert into public.checkout_ventas(
      id,empresa_id,local_id,checkout_id,venta_fiscal_id,currency_code,importe_objetivo
    ) values (
      '41000000-0000-0000-0000-000000000003','E1','L1',
      '40000000-0000-0000-0000-000000000001',
      '70000000-0000-0000-0000-000000000003','EUR',5
    );
    raise exception 'M02B_FAIL: checkout cross-tenant aceptado';
  exception when foreign_key_violation then null;
  end;
end $$;

insert into public.pagos(
  id,empresa_id,local_id,checkout_id,medio,estado,
  sale_currency_code,payment_currency_code,importe_objetivo,
  importe_recibido,cambio_entregado,version,created_by
) values (
  '50000000-0000-0000-0000-000000000001','E1','L1',
  '40000000-0000-0000-0000-000000000001','TARJETA','PENDIENTE',
  'EUR','EUR',21.04,null,null,1,
  '11111111-1111-1111-1111-111111111111'
);

do $$
begin
  begin
    insert into public.pagos(
      id,empresa_id,local_id,checkout_id,medio,estado,
      sale_currency_code,payment_currency_code,importe_objetivo,
      importe_recibido,cambio_entregado,version,created_by
    ) values (
      '50000000-0000-0000-0000-000000000002','E1','L1',
      '40000000-0000-0000-0000-000000000001','EFECTIVO','PENDIENTE',
      'EUR','EUR',10,20,5,1,
      '11111111-1111-1111-1111-111111111111'
    );
    raise exception 'M02B_FAIL: cambio de efectivo inconsistente aceptado';
  exception when check_violation then null;
  end;
end $$;

insert into public.abc_operaciones(
  operation_id,empresa_id,local_id,command_type,request_hash,status,
  actor_user_id,request
) values
  ('M02B:pay:attempt:0001','E1','L1','ABC_PAYMENT_ATTEMPT',
   repeat('a',64),'PROCESANDO',
   '11111111-1111-1111-1111-111111111111','{}'),
  ('M02B:refund:000001','E1','L1','ABC_REFUND',
   repeat('b',64),'PROCESANDO',
   '11111111-1111-1111-1111-111111111111','{}');

insert into public.pago_intentos(
  id,empresa_id,local_id,pago_id,abc_command_id,estado,
  provider_code,provider_reference,requested_amount,payment_currency_code,
  authorization_status,capture_status,settlement_status
) values (
  '60000000-0000-0000-0000-000000000001','E1','L1',
  '50000000-0000-0000-0000-000000000001',
  'M02B:pay:attempt:0001','DESCONOCIDO',
  'SIM','SIM-PAY-001',21.04,'EUR',
  'DESCONOCIDO','DESCONOCIDO','PENDIENTE'
);

insert into public.reservas_saldo(
  id,empresa_id,local_id,intento_id,checkout_venta_id,venta_fiscal_id,
  sale_currency_code,importe_reservado,estado
) values
  ('61000000-0000-0000-0000-000000000001','E1','L1',
   '60000000-0000-0000-0000-000000000001',
   '41000000-0000-0000-0000-000000000001',
   '70000000-0000-0000-0000-000000000001','EUR',10.07,'ACTIVA'),
  ('61000000-0000-0000-0000-000000000002','E1','L1',
   '60000000-0000-0000-0000-000000000001',
   '41000000-0000-0000-0000-000000000002',
   '70000000-0000-0000-0000-000000000002','EUR',10.97,'ACTIVA');

do $$
declare n integer;
begin
  select count(*) into n
  from public.reservas_saldo r
  join public.pago_intentos i on i.id=r.intento_id
  where i.estado='DESCONOCIDO' and r.estado='ACTIVA';
  if n<>2 then
    raise exception 'M02B_FAIL: intento DESCONOCIDO no conserva 2 reservas activas: %',n;
  end if;
end $$;

update public.pago_intentos
set estado='CONFIRMADO',
    authorized_amount=21.04,
    captured_amount=21.04,
    authorization_status='AUTORIZADO',
    capture_status='CONFIRMADO',
    settlement_status='PENDIENTE',
    resolved_at=now()
where id='60000000-0000-0000-0000-000000000001';

update public.pagos
set estado='CONFIRMADO',resolved_at=now()
where id='50000000-0000-0000-0000-000000000001';

update public.reservas_saldo
set estado='CONSUMIDA',consumed_at=now()
where intento_id='60000000-0000-0000-0000-000000000001';

insert into public.pago_aplicaciones(
  id,empresa_id,local_id,pago_id,intento_id,checkout_venta_id,venta_fiscal_id,
  payment_amount,payment_currency_code,sale_amount,sale_currency_code,
  fx_snapshot,confirmed_at
) values
  ('62000000-0000-0000-0000-000000000001','E1','L1',
   '50000000-0000-0000-0000-000000000001',
   '60000000-0000-0000-0000-000000000001',
   '41000000-0000-0000-0000-000000000001',
   '70000000-0000-0000-0000-000000000001',
   10.07,'EUR',10.07,'EUR','{}',now()),
  ('62000000-0000-0000-0000-000000000002','E1','L1',
   '50000000-0000-0000-0000-000000000001',
   '60000000-0000-0000-0000-000000000001',
   '41000000-0000-0000-0000-000000000002',
   '70000000-0000-0000-0000-000000000002',
   10.97,'EUR',10.97,'EUR','{}',now());

insert into public.reembolsos(
  id,empresa_id,local_id,pago_id,abc_command_id,estado,
  payment_currency_code,importe_solicitado,provider_code,provider_reference,
  motivo,created_by,resolved_at
) values (
  '80000000-0000-0000-0000-000000000001','E1','L1',
  '50000000-0000-0000-0000-000000000001',
  'M02B:refund:000001','CONFIRMADO','EUR',5.00,
  'SIM','SIM-REF-001','Prueba parcial',
  '11111111-1111-1111-1111-111111111111',now()
);

insert into public.reembolso_aplicaciones(
  id,empresa_id,local_id,reembolso_id,pago_aplicacion_id,venta_fiscal_id,
  importe_venta,sale_currency_code,importe_pago,payment_currency_code
) values (
  '81000000-0000-0000-0000-000000000001','E1','L1',
  '80000000-0000-0000-0000-000000000001',
  '62000000-0000-0000-0000-000000000001',
  '70000000-0000-0000-0000-000000000001',
  5.00,'EUR',5.00,'EUR'
);

do $$
declare n integer;
begin
  select count(*) into n from pg_class c join pg_namespace s on s.oid=c.relnamespace
  where s.nspname='public'
    and c.relname in (
      'checkouts','checkout_ventas','pagos','pago_intentos',
      'reservas_saldo','pago_aplicaciones','reembolsos','reembolso_aplicaciones'
    )
    and c.relrowsecurity;
  if n<>8 then raise exception 'M02B_FAIL: esperaba RLS en 8 tablas y obtuvo %',n; end if;

  select count(*) into n from pg_policies
  where schemaname='public'
    and tablename in (
      'checkouts','checkout_ventas','pagos','pago_intentos',
      'reservas_saldo','pago_aplicaciones','reembolsos','reembolso_aplicaciones'
    )
    and cmd='SELECT';
  if n<>8 then raise exception 'M02B_FAIL: esperaba 8 policies SELECT y obtuvo %',n; end if;

  select count(*) into n
  from information_schema.role_table_grants
  where table_schema='public'
    and table_name in (
      'checkouts','checkout_ventas','pagos','pago_intentos',
      'reservas_saldo','pago_aplicaciones','reembolsos','reembolso_aplicaciones'
    )
    and grantee='authenticated'
    and privilege_type in ('INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER');
  if n<>0 then raise exception 'M02B_FAIL: authenticated conserva privilegios de mutación: %',n; end if;

  select count(*) into n
  from information_schema.role_table_grants
  where table_schema='public'
    and table_name in (
      'checkouts','checkout_ventas','pagos','pago_intentos',
      'reservas_saldo','pago_aplicaciones','reembolsos','reembolso_aplicaciones'
    )
    and grantee='anon';
  if n<>0 then raise exception 'M02B_FAIL: anon conserva privilegios directos: %',n; end if;

  select count(distinct table_name) into n
  from information_schema.role_table_grants
  where table_schema='public'
    and table_name in ('checkouts','checkout_ventas','pagos','reembolsos')
    and grantee='authenticated'
    and privilege_type='SELECT';
  if n<>4 then raise exception 'M02B_FAIL: SELECT visible esperaba 4 tablas y obtuvo %',n; end if;

  select count(*) into n
  from information_schema.role_table_grants
  where table_schema='public'
    and table_name in (
      'pago_intentos','reservas_saldo','pago_aplicaciones','reembolso_aplicaciones'
    )
    and grantee='authenticated'
    and privilege_type='SELECT';
  if n<>0 then raise exception 'M02B_FAIL: tablas internas con SELECT authenticated: %',n; end if;
end $$;

set role authenticated;
select set_config('app.test_empresa','E1',false);
select set_config('app.test_local','L1',false);

do $$
declare n integer;
begin
  select count(*) into n from public.checkouts;
  if n<>1 then raise exception 'M02B_FAIL: RLS checkout esperaba 1 y obtuvo %',n; end if;

  select count(*) into n from public.checkout_ventas;
  if n<>2 then raise exception 'M02B_FAIL: RLS checkout_ventas esperaba 2 y obtuvo %',n; end if;

  select count(*) into n from public.pagos;
  if n<>1 then raise exception 'M02B_FAIL: RLS pagos esperaba 1 y obtuvo %',n; end if;

  select count(*) into n from public.reembolsos;
  if n<>1 then raise exception 'M02B_FAIL: RLS reembolsos esperaba 1 y obtuvo %',n; end if;
end $$;

reset role;

select 'ABC_F2_M02B_CONTRACT=PASS' as resultado;
