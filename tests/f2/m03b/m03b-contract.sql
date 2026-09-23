\set ON_ERROR_STOP on

insert into public.empresas(id,nombre) values ('E1','Empresa 1'),('E2','Empresa 2');
insert into public.locales(id,empresa_id,nombre) values ('L1','E1','Local 1'),('L2','E2','Local 2');

insert into auth.users(id) values
  ('11111111-1111-1111-1111-111111111111'),
  ('22222222-2222-2222-2222-222222222222');

insert into public.membresias_usuario(user_id,empresa_id,local_id,todos_locales,rol,activo) values
  ('11111111-1111-1111-1111-111111111111','E1','L1',false,'Propietario',true),
  ('22222222-2222-2222-2222-222222222222','E2','L2',false,'Propietario',true);

insert into public.entidades_fiscales(id,empresa_id,nombre_legal,identificador_fiscal,country_code,simulada)
values ('10000000-0000-0000-0000-000000000001','E1','Entidad Fiscal A','SIM-A','ES',true);

insert into public.entidad_fiscal_monedas(empresa_id,entidad_fiscal_id,currency_code,es_principal,activa)
values ('E1','10000000-0000-0000-0000-000000000001','EUR',true,true);

insert into public.entidad_fiscal_locales(empresa_id,local_id,entidad_fiscal_id,activa)
values ('E1','L1','10000000-0000-0000-0000-000000000001',true);

insert into public.entidad_fiscal_local_monedas(empresa_id,local_id,entidad_fiscal_id,currency_code,activa)
values ('E1','L1','10000000-0000-0000-0000-000000000001','EUR',true);

insert into public.cuentas_comerciales(
  id,empresa_id,local_id,currency_code,modalidad,estado,version,created_by,opened_operating_day
) values
  ('30000000-0000-0000-0000-000000000001','E1','L1','EUR','MESA','ABIERTA',1,'11111111-1111-1111-1111-111111111111','2026-09-23'),
  ('30000000-0000-0000-0000-000000000002','E1','L1','EUR','MESA','ABIERTA',1,'11111111-1111-1111-1111-111111111111','2026-09-23'),
  ('30000000-0000-0000-0000-000000000003','E1','L1','EUR','MESA','ABIERTA',1,'11111111-1111-1111-1111-111111111111','2026-09-23');

insert into public.ventas_fiscales(
  id,empresa_id,local_id,cuenta_id,entidad_fiscal_id,currency_code,estado,version,
  subtotal,descuento_total,impuestos_total,total,snapshot_calculo,created_by,created_operating_day
) values
  ('70000000-0000-0000-0000-000000000001','E1','L1','30000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','EUR','ABIERTA',1,20,0,0,20,'{}','11111111-1111-1111-1111-111111111111','2026-09-23'),
  ('70000000-0000-0000-0000-000000000002','E1','L1','30000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','EUR','ABIERTA',1,10,0,0,10,'{}','11111111-1111-1111-1111-111111111111','2026-09-23'),
  ('70000000-0000-0000-0000-000000000003','E1','L1','30000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000001','EUR','ABIERTA',1,15,0,0,15,'{}','11111111-1111-1111-1111-111111111111','2026-09-23');

insert into public.terminales_tpv(id,empresa_id,local_id,nombre,activo)
values ('90000000-0000-0000-0000-000000000001','E1','L1','TPV 1',true);

insert into public.cajas_fisicas(id,empresa_id,local_id,nombre,activo)
values ('91000000-0000-0000-0000-000000000001','E1','L1','Caja 1',true);

insert into public.caja_sesiones(id,empresa_id,local_id,caja_id,estado,version,abierta_at,abierta_por)
values ('92000000-0000-0000-0000-000000000001','E1','L1','91000000-0000-0000-0000-000000000001','ABIERTA',1,now(),'11111111-1111-1111-1111-111111111111');

insert into public.caja_sesion_terminales(id,empresa_id,local_id,session_id,terminal_id,desde)
values ('93000000-0000-0000-0000-000000000001','E1','L1','92000000-0000-0000-0000-000000000001','90000000-0000-0000-0000-000000000001',now());

select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false);
select set_config('app.test_empresa','E1',false);
select set_config('app.test_local','L1',false);

set role authenticated;

select public.abc_abrir_checkout(
  'M03B:checkout:000001','E1','L1','40000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000001',
  array['70000000-0000-0000-0000-000000000001'::uuid],'2026-09-23'
);

do $$
declare r jsonb;
begin
  r:=public.abc_abrir_checkout(
    'M03B:checkout:000001','E1','L1','40000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000001',
    array['70000000-0000-0000-0000-000000000001'::uuid],'2026-09-23'
  );
  if r->>'checkout_id'<>'40000000-0000-0000-0000-000000000001' then
    raise exception 'M03B_FAIL: replay checkout';
  end if;
end $$;

select public.abc_iniciar_cobro(
  'M03B:pay:start:0001','E1','L1','40000000-0000-0000-0000-000000000001',
  '50000000-0000-0000-0000-000000000001','60000000-0000-0000-0000-000000000001',
  'TARJETA',12,'EUR','90000000-0000-0000-0000-000000000001',null,null
);

do $$
declare r numeric;
begin
  select sum(importe_reservado) into r from public.reservas_saldo
   where intento_id='60000000-0000-0000-0000-000000000001' and estado='ACTIVA';
  if r<>12 then raise exception 'M03B_FAIL: reserva esperada 12, obtuvo %',r; end if;

  begin
    perform public.abc_iniciar_cobro(
      'M03B:pay:start:0002','E1','L1','40000000-0000-0000-0000-000000000001',
      '50000000-0000-0000-0000-000000000002','60000000-0000-0000-0000-000000000002',
      'TARJETA',9,'EUR','90000000-0000-0000-0000-000000000001',null,null
    );
    raise exception 'M03B_FAIL: doble reserva aceptada';
  exception when others then
    if sqlerrm not like '%saldo_insuficiente%' then raise; end if;
  end;
end $$;

reset role;
set role service_role;

select public.abc_resolver_intento(
  'M03B:resolve:unknown:1','E1','L1','60000000-0000-0000-0000-000000000001',
  'DESCONOCIDO','SIM','SIM-PAY-001',null,null,null,'{"step":"timeout"}'
);

do $$
declare n integer;
begin
  select count(*) into n from public.reservas_saldo
   where intento_id='60000000-0000-0000-0000-000000000001' and estado='ACTIVA';
  if n<>1 then raise exception 'M03B_FAIL: UNKNOWN libero reserva'; end if;
end $$;

select public.abc_resolver_intento(
  'M03B:resolve:confirm:1','E1','L1','60000000-0000-0000-0000-000000000001',
  'CONFIRMADO','SIM','SIM-PAY-001',12,12,null,'{"step":"confirmed"}'
);

reset role;
set role authenticated;

select public.abc_abrir_checkout(
  'M03B:checkout:cash:1','E1','L1','40000000-0000-0000-0000-000000000002',
  '30000000-0000-0000-0000-000000000002',
  array['70000000-0000-0000-0000-000000000002'::uuid],'2026-09-23'
);

select public.abc_iniciar_cobro(
  'M03B:pay:cash:start','E1','L1','40000000-0000-0000-0000-000000000002',
  '50000000-0000-0000-0000-000000000003','60000000-0000-0000-0000-000000000003',
  'EFECTIVO',10,'EUR','90000000-0000-0000-0000-000000000001',20,10
);

select public.abc_confirmar_efectivo(
  'M03B:pay:cash:confirm','E1','L1','60000000-0000-0000-0000-000000000003',
  '91000000-0000-0000-0000-000000000001','92000000-0000-0000-0000-000000000001',
  '90000000-0000-0000-0000-000000000001','2026-09-23'
);

select public.abc_abrir_checkout(
  'M03B:checkout:conc:1','E1','L1','40000000-0000-0000-0000-000000000003',
  '30000000-0000-0000-0000-000000000003',
  array['70000000-0000-0000-0000-000000000003'::uuid],'2026-09-23'
);

reset role;

do $$
declare n integer; e numeric; s text;
begin
  select count(*) into n from public.caja_operaciones
   where abc_command_id='M03B:pay:cash:confirm' and categoria='COBRO_VENTA';
  if n<>1 then raise exception 'M03B_FAIL: movimiento caja esperado 1, obtuvo %',n; end if;

  select efecto_efectivo into e from public.caja_operaciones
   where abc_command_id='M03B:pay:cash:confirm';
  if e<>10 then raise exception 'M03B_FAIL: efecto efectivo esperado 10, obtuvo %',e; end if;

  select estado into s from public.checkouts where id='40000000-0000-0000-0000-000000000002';
  if s<>'COMPLETADO' then raise exception 'M03B_FAIL: checkout efectivo no completado: %',s; end if;

  select count(*) into n from information_schema.columns
   where table_schema='public' and table_name='abc_operaciones'
     and column_name in ('executor_kind','executor_ref');
  if n<>2 then raise exception 'M03B_FAIL: executor columns operaciones'; end if;

  select count(*) into n from information_schema.columns
   where table_schema='public' and table_name='abc_eventos'
     and column_name in ('executor_kind','executor_ref');
  if n<>2 then raise exception 'M03B_FAIL: executor columns eventos'; end if;

  if not has_function_privilege(
    'authenticated','public.abc_abrir_checkout(text,text,text,uuid,uuid,uuid[],date)','EXECUTE'
  ) then raise exception 'M03B_FAIL: authenticated sin abrir checkout'; end if;

  if not has_function_privilege(
    'authenticated','public.abc_iniciar_cobro(text,text,text,uuid,uuid,uuid,text,numeric,text,uuid,numeric,numeric)','EXECUTE'
  ) then raise exception 'M03B_FAIL: authenticated sin iniciar cobro'; end if;

  if not has_function_privilege(
    'authenticated','public.abc_confirmar_efectivo(text,text,text,uuid,uuid,uuid,uuid,date)','EXECUTE'
  ) then raise exception 'M03B_FAIL: authenticated sin confirmar efectivo'; end if;

  if has_function_privilege(
    'authenticated','public.abc_resolver_intento(text,text,text,uuid,text,text,text,numeric,numeric,numeric,jsonb)','EXECUTE'
  ) then raise exception 'M03B_FAIL: resolver expuesto a authenticated'; end if;

  if not has_function_privilege(
    'service_role','public.abc_resolver_intento(text,text,text,uuid,text,text,text,numeric,numeric,numeric,jsonb)','EXECUTE'
  ) then raise exception 'M03B_FAIL: service_role sin resolver intento'; end if;

  if has_function_privilege(
    'anon','public.abc_iniciar_cobro(text,text,text,uuid,uuid,uuid,text,numeric,text,uuid,numeric,numeric)','EXECUTE'
  ) then raise exception 'M03B_FAIL: anon puede iniciar cobro'; end if;
end $$;

select 'ABC_F2_M03B_CONTRACT=PASS' as resultado;
