\set ON_ERROR_STOP on

-- Base transaccional aislada M04C.
insert into public.empresas(id,nombre) values ('E1','Empresa 1'),('E2','Empresa 2');
insert into public.locales(id,empresa_id,nombre) values ('L1','E1','Local 1'),('L2','E2','Local 2');

insert into auth.users(id) values
  ('11111111-1111-1111-1111-111111111111'),
  ('22222222-2222-2222-2222-222222222222');

insert into public.membresias_usuario(user_id,empresa_id,local_id,todos_locales,rol,activo) values
  ('11111111-1111-1111-1111-111111111111','E1','L1',false,'Propietario',true),
  ('22222222-2222-2222-2222-222222222222','E2','L2',false,'Propietario',true);

insert into public.entidades_fiscales(
  id,empresa_id,nombre_legal,identificador_fiscal,country_code,simulada
) values ('10000000-0000-0000-0000-000000000201','E1','Entidad Fiscal','SIM-M04C','ES',true);

insert into public.entidad_fiscal_monedas(
  empresa_id,entidad_fiscal_id,currency_code,es_principal,activa
) values ('E1','10000000-0000-0000-0000-000000000201','EUR',true,true);

insert into public.entidad_fiscal_locales(
  empresa_id,local_id,entidad_fiscal_id,activa
) values ('E1','L1','10000000-0000-0000-0000-000000000201',true);

insert into public.entidad_fiscal_local_monedas(
  empresa_id,local_id,entidad_fiscal_id,currency_code,activa
) values ('E1','L1','10000000-0000-0000-0000-000000000201','EUR',true);

insert into public.cuentas_comerciales(
  id,empresa_id,local_id,currency_code,modalidad,estado,version,created_by,opened_operating_day
) values
  ('30000000-0000-0000-0000-000000000201','E1','L1','EUR','MESA','ABIERTA',1,'11111111-1111-1111-1111-111111111111','2026-09-23'),
  ('30000000-0000-0000-0000-000000000202','E1','L1','EUR','MESA','ABIERTA',1,'11111111-1111-1111-1111-111111111111','2026-09-23'),
  ('30000000-0000-0000-0000-000000000203','E1','L1','EUR','MESA','ABIERTA',1,'11111111-1111-1111-1111-111111111111','2026-09-23');

insert into public.ventas_fiscales(
  id,empresa_id,local_id,cuenta_id,entidad_fiscal_id,currency_code,estado,version,
  subtotal,descuento_total,impuestos_total,total,snapshot_calculo,created_by,created_operating_day
) values
  ('70000000-0000-0000-0000-000000000201','E1','L1','30000000-0000-0000-0000-000000000201','10000000-0000-0000-0000-000000000201','EUR','ABIERTA',1,20,0,0,20,'{}','11111111-1111-1111-1111-111111111111','2026-09-23'),
  ('70000000-0000-0000-0000-000000000202','E1','L1','30000000-0000-0000-0000-000000000202','10000000-0000-0000-0000-000000000201','EUR','ABIERTA',1,15,0,0,15,'{}','11111111-1111-1111-1111-111111111111','2026-09-23'),
  ('70000000-0000-0000-0000-000000000203','E1','L1','30000000-0000-0000-0000-000000000203','10000000-0000-0000-0000-000000000201','EUR','ABIERTA',1,10,0,0,10,'{}','11111111-1111-1111-1111-111111111111','2026-09-23');

insert into public.terminales_tpv(id,empresa_id,local_id,nombre,device_key,activo)
values ('90000000-0000-0000-0000-000000000201','E1','L1','TPV M04C','m04c-t1',true);

insert into public.cajas_fisicas(id,empresa_id,local_id,nombre,activo)
values ('91000000-0000-0000-0000-000000000201','E1','L1','Caja M04C',true);

insert into public.caja_sesiones(id,empresa_id,local_id,caja_id,estado,version,abierta_at,abierta_por)
values (
  '92000000-0000-0000-0000-000000000201','E1','L1',
  '91000000-0000-0000-0000-000000000201','ABIERTA',1,now(),
  '11111111-1111-1111-1111-111111111111'
);

insert into public.caja_sesion_terminales(
  id,empresa_id,local_id,session_id,terminal_id,desde
) values (
  '93000000-0000-0000-0000-000000000201','E1','L1',
  '92000000-0000-0000-0000-000000000201',
  '90000000-0000-0000-0000-000000000201',now()
);

insert into public.caja_sesion_responsables(
  empresa_id,local_id,session_id,user_id,asignado_por,motivo
) values (
  'E1','L1','92000000-0000-0000-0000-000000000201',
  '11111111-1111-1111-1111-111111111111',
  '11111111-1111-1111-1111-111111111111','APERTURA_FIXTURE'
);

select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false);
select set_config('app.test_empresa','E1',false);
select set_config('app.test_local','L1',false);

-- Pago externo A: debe crear exactamente un efecto en la misma transacción.
set role authenticated;

select public.abc_abrir_checkout(
  'M04C:checkout:A','E1','L1',
  '40000000-0000-0000-0000-000000000201',
  '30000000-0000-0000-0000-000000000201',
  array['70000000-0000-0000-0000-000000000201'::uuid],
  '2026-09-23'
);

select public.abc_iniciar_cobro(
  'M04C:pay:A:start','E1','L1',
  '40000000-0000-0000-0000-000000000201',
  '50000000-0000-0000-0000-000000000201',
  '60000000-0000-0000-0000-000000000201',
  'TARJETA',20,'EUR','90000000-0000-0000-0000-000000000201',null,null
);

-- Replay del comando: no duplica outbox.
select public.abc_iniciar_cobro(
  'M04C:pay:A:start','E1','L1',
  '40000000-0000-0000-0000-000000000201',
  '50000000-0000-0000-0000-000000000201',
  '60000000-0000-0000-0000-000000000201',
  'TARJETA',20,'EUR','90000000-0000-0000-0000-000000000201',null,null
);

reset role;

do $$
declare
  v_n integer;
  v_estado text;
  v_payload jsonb;
begin
  select count(*),min(estado),min(payload::text)::jsonb
    into v_n,v_estado,v_payload
    from public.efectos_pendientes
   where empresa_id='E1'
     and dedupe_key='pago-intento:60000000-0000-0000-0000-000000000201';

  if v_n<>1 or v_estado<>'PENDIENTE' then
    raise exception 'M04C_FAIL: outbox pago/replay n=% estado=%',v_n,v_estado;
  end if;
  if v_payload->>'intento_id'<>'60000000-0000-0000-0000-000000000201'
     or v_payload->>'medio'<>'TARJETA' then
    raise exception 'M04C_FAIL: payload pago incorrecto';
  end if;
  if lower(v_payload::text) ~ '(pan|cvv|card_number|numero_tarjeta)' then
    raise exception 'M04C_FAIL: payload contiene dato de tarjeta prohibido';
  end if;
end $$;

-- Worker A reclama.
set role service_role;
select * from public.abc_reclamar_efectos('worker-pay-a',1,60);
reset role;

select set_config(
  'app.m04c_pay_effect',
  (select id::text from public.efectos_pendientes
    where dedupe_key='pago-intento:60000000-0000-0000-0000-000000000201'),
  false
);

do $$
declare
  v_estado text;
  v_attempt integer;
  v_worker text;
begin
  select estado,attempt_count,worker_ref
    into v_estado,v_attempt,v_worker
    from public.efectos_pendientes
   where id=current_setting('app.m04c_pay_effect')::uuid;
  if v_estado<>'EN_PROCESO' or v_attempt<>1 or v_worker<>'worker-pay-a' then
    raise exception 'M04C_FAIL: claim inicial estado=% attempt=% worker=%',v_estado,v_attempt,v_worker;
  end if;
end $$;

-- UNKNOWN conserva reserva y el efecto sigue reclamado hasta que el worker lo reprograme.
set role service_role;
select public.abc_resolver_intento(
  'M04C:pay:A:unknown','E1','L1',
  '60000000-0000-0000-0000-000000000201',
  'DESCONOCIDO','SIM','SIM-M04C-PAY-A',null,null,null,'{"step":"timeout"}'
);

select public.abc_reprogramar_efecto(
  current_setting('app.m04c_pay_effect')::uuid,
  'worker-pay-a',
  now()
);

-- Worker B retoma el mismo efecto.
select * from public.abc_reclamar_efectos('worker-pay-b',1,60);

select public.abc_resolver_intento(
  'M04C:pay:A:confirm','E1','L1',
  '60000000-0000-0000-0000-000000000201',
  'CONFIRMADO','SIM','SIM-M04C-PAY-A',20,20,null,'{"step":"confirmed"}'
);

-- El ack posterior del worker es idempotente porque el resolver final cerró el outbox atómicamente.
select public.abc_completar_efecto(
  current_setting('app.m04c_pay_effect')::uuid,
  'worker-pay-b'
);

-- Replay final con otro operation_id: debe ser idempotente.
select public.abc_resolver_intento(
  'M04C:pay:A:confirm:replay','E1','L1',
  '60000000-0000-0000-0000-000000000201',
  'CONFIRMADO','SIM','SIM-M04C-PAY-A',20,20,null,'{"step":"confirmed-retry"}'
);
reset role;

do $$
declare
  v_estado text;
  v_attempt integer;
  v_completed timestamptz;
  v_apps integer;
begin
  select estado,attempt_count,completed_at
    into v_estado,v_attempt,v_completed
    from public.efectos_pendientes
   where id=current_setting('app.m04c_pay_effect')::uuid;
  if v_estado<>'COMPLETADO' or v_attempt<>2 or v_completed is null then
    raise exception 'M04C_FAIL: efecto pago final estado=% attempt=%',v_estado,v_attempt;
  end if;

  select count(*) into v_apps
    from public.pago_aplicaciones
   where pago_id='50000000-0000-0000-0000-000000000201';
  if v_apps<>1 then raise exception 'M04C_FAIL: replay final duplico aplicaciones %',v_apps; end if;

  if not exists(
    select 1 from public.abc_operaciones
     where operation_id='M04C:pay:A:confirm:replay'
       and status='COMPLETADA'
       and resultado->>'already_resolved'='true'
  ) then
    raise exception 'M04C_FAIL: replay final no quedo auditado como idempotente';
  end if;
end $$;

-- Reembolso A1: se encola y una cancelación antes del envío abandona el efecto.
set role authenticated;
select public.abc_solicitar_reembolso(
  'M04C:refund:A1:req','E1','L1',
  '80000000-0000-0000-0000-000000000201',
  '50000000-0000-0000-0000-000000000201',
  5,'Cancelar antes de proveedor',
  '90000000-0000-0000-0000-000000000201','2026-09-23'
);

select public.abc_cancelar_reembolso(
  'M04C:refund:A1:cancel','E1','L1',
  '80000000-0000-0000-0000-000000000201',
  'Cliente desiste',
  '90000000-0000-0000-0000-000000000201','2026-09-23'
);
reset role;

do $$
declare
  v_r text;
  v_e text;
begin
  select estado into v_r from public.reembolsos
   where id='80000000-0000-0000-0000-000000000201';
  select estado into v_e from public.efectos_pendientes
   where dedupe_key='reembolso:80000000-0000-0000-0000-000000000201';
  if v_r<>'CANCELADO' or v_e<>'ABANDONADO' then
    raise exception 'M04C_FAIL: cancelación no sincronizó outbox r=% e=%',v_r,v_e;
  end if;
end $$;

-- Reembolso A2: error de worker, retry, final confirmado y cierre automático del outbox.
set role authenticated;
select public.abc_solicitar_reembolso(
  'M04C:refund:A2:req','E1','L1',
  '80000000-0000-0000-0000-000000000202',
  '50000000-0000-0000-0000-000000000201',
  5,'Reembolso con retry',
  '90000000-0000-0000-0000-000000000201','2026-09-23'
);
reset role;

select set_config(
  'app.m04c_refund_effect',
  (select id::text from public.efectos_pendientes
    where dedupe_key='reembolso:80000000-0000-0000-0000-000000000202'),
  false
);

set role service_role;
select * from public.abc_reclamar_efectos('worker-refund-a',1,60);
select public.abc_registrar_error_efecto(
  current_setting('app.m04c_refund_effect')::uuid,
  'worker-refund-a',
  '{"code":"TEMP_PROVIDER"}'::jsonb,
  now()
);
select * from public.abc_reclamar_efectos('worker-refund-b',1,60);

select public.abc_resolver_reembolso(
  'M04C:refund:A2:confirm','E1','L1',
  '80000000-0000-0000-0000-000000000202',
  'CONFIRMADO','SIM','SIM-M04C-REF-A2',
  '{"step":"confirmed"}','2026-09-23'
);
reset role;

do $$
declare
  v_estado text;
  v_attempt integer;
begin
  select estado,attempt_count into v_estado,v_attempt
    from public.efectos_pendientes
   where id=current_setting('app.m04c_refund_effect')::uuid;
  if v_estado<>'COMPLETADO' or v_attempt<>2 then
    raise exception 'M04C_FAIL: retry reembolso estado=% attempt=%',v_estado,v_attempt;
  end if;
end $$;

-- Reembolso A3: probar abandono explícito del worker y posterior cancelación local.
set role authenticated;
select public.abc_solicitar_reembolso(
  'M04C:refund:A3:req','E1','L1',
  '80000000-0000-0000-0000-000000000203',
  '50000000-0000-0000-0000-000000000201',
  3,'Abandono controlado',
  '90000000-0000-0000-0000-000000000201','2026-09-23'
);
reset role;

select set_config(
  'app.m04c_refund_abandon_effect',
  (select id::text from public.efectos_pendientes
    where dedupe_key='reembolso:80000000-0000-0000-0000-000000000203'),
  false
);

set role service_role;
select * from public.abc_reclamar_efectos('worker-refund-abandon',1,60);
select public.abc_abandonar_efecto(
  current_setting('app.m04c_refund_abandon_effect')::uuid,
  'worker-refund-abandon',
  '{"code":"MANUAL_ABANDON"}'::jsonb
);
reset role;

set role authenticated;
select public.abc_cancelar_reembolso(
  'M04C:refund:A3:cancel','E1','L1',
  '80000000-0000-0000-0000-000000000203',
  'Abandono confirmado',
  '90000000-0000-0000-0000-000000000201','2026-09-23'
);
reset role;

-- Efectivo: no debe crear outbox de proveedor.
set role authenticated;
select public.abc_abrir_checkout(
  'M04C:checkout:cash','E1','L1',
  '40000000-0000-0000-0000-000000000203',
  '30000000-0000-0000-0000-000000000203',
  array['70000000-0000-0000-0000-000000000203'::uuid],
  '2026-09-23'
);
select public.abc_iniciar_cobro(
  'M04C:pay:cash:start','E1','L1',
  '40000000-0000-0000-0000-000000000203',
  '50000000-0000-0000-0000-000000000203',
  '60000000-0000-0000-0000-000000000203',
  'EFECTIVO',10,'EUR','90000000-0000-0000-0000-000000000201',20,10
);
reset role;

do $$
declare v_n integer;
begin
  select count(*) into v_n from public.efectos_pendientes
   where dedupe_key='pago-intento:60000000-0000-0000-0000-000000000203';
  if v_n<>0 then raise exception 'M04C_FAIL: efectivo creó outbox proveedor'; end if;
end $$;

-- Pago reservado exclusivamente para concurrencia del workflow.
set role authenticated;
select public.abc_abrir_checkout(
  'M04C:checkout:conc','E1','L1',
  '40000000-0000-0000-0000-000000000202',
  '30000000-0000-0000-0000-000000000202',
  array['70000000-0000-0000-0000-000000000202'::uuid],
  '2026-09-23'
);
select public.abc_iniciar_cobro(
  'M04C:pay:conc:start','E1','L1',
  '40000000-0000-0000-0000-000000000202',
  '50000000-0000-0000-0000-000000000202',
  '60000000-0000-0000-0000-000000000202',
  'TARJETA',15,'EUR','90000000-0000-0000-0000-000000000201',null,null
);
reset role;

-- ACL/tabla: worker solo por RPC, no DML directo.
do $$
begin
  if has_function_privilege(
    'authenticated','public.abc_reclamar_efectos(text,integer,integer)','EXECUTE'
  ) then raise exception 'M04C_FAIL: authenticated puede reclamar efectos'; end if;

  if not has_function_privilege(
    'service_role','public.abc_reclamar_efectos(text,integer,integer)','EXECUTE'
  ) then raise exception 'M04C_FAIL: service_role sin reclamar efectos'; end if;

  if not has_function_privilege(
    'service_role','public.abc_reprogramar_efecto(uuid,text,timestamptz)','EXECUTE'
  ) then raise exception 'M04C_FAIL: service_role sin reprogramar'; end if;

  if not has_function_privilege(
    'service_role','public.abc_registrar_error_efecto(uuid,text,jsonb,timestamptz)','EXECUTE'
  ) then raise exception 'M04C_FAIL: service_role sin registrar error'; end if;

  if not has_function_privilege(
    'service_role','public.abc_completar_efecto(uuid,text)','EXECUTE'
  ) then raise exception 'M04C_FAIL: service_role sin completar'; end if;

  if not has_function_privilege(
    'service_role','public.abc_abandonar_efecto(uuid,text,jsonb)','EXECUTE'
  ) then raise exception 'M04C_FAIL: service_role sin abandonar'; end if;

  if has_table_privilege('service_role','public.efectos_pendientes','INSERT')
     or has_table_privilege('service_role','public.efectos_pendientes','UPDATE')
     or has_table_privilege('service_role','public.efectos_pendientes','DELETE') then
    raise exception 'M04C_FAIL: service_role conserva DML directo outbox';
  end if;

  if has_function_privilege(
    'authenticated','private.abc_encolar_efecto(text,text,text,text,text,jsonb)','EXECUTE'
  ) then raise exception 'M04C_FAIL: helper enqueue expuesto'; end if;
end $$;

select 'ABC_F2_M04C_CONTRACT=PASS' as resultado;
