\set ON_ERROR_STOP on

-- Base multi-tenant minima.
insert into public.empresas(id,nombre) values
  ('E1','Empresa 1'),
  ('E2','Empresa 2');

insert into public.locales(id,empresa_id,nombre) values
  ('L1','E1','Local 1'),
  ('L2','E2','Local 2');

insert into auth.users(id) values
  ('11111111-1111-1111-1111-111111111111'),
  ('22222222-2222-2222-2222-222222222222');

insert into public.membresias_usuario(
  user_id,empresa_id,local_id,todos_locales,rol,activo
) values
  ('11111111-1111-1111-1111-111111111111','E1','L1',false,'Propietario',true),
  ('22222222-2222-2222-2222-222222222222','E2','L2',false,'Propietario',true);

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
) values
  ('30000000-0000-0000-0000-000000000101','E1','L1','EUR','MESA','ABIERTA',1,
   '11111111-1111-1111-1111-111111111111','2026-09-23'),
  ('30000000-0000-0000-0000-000000000102','E1','L1','EUR','MESA','ABIERTA',1,
   '11111111-1111-1111-1111-111111111111','2026-09-23'),
  ('30000000-0000-0000-0000-000000000103','E1','L1','EUR','MESA','ABIERTA',1,
   '11111111-1111-1111-1111-111111111111','2026-09-23');

insert into public.ventas_fiscales(
  id,empresa_id,local_id,cuenta_id,entidad_fiscal_id,currency_code,estado,version,
  subtotal,descuento_total,impuestos_total,total,snapshot_calculo,
  created_by,created_operating_day
) values
  ('70000000-0000-0000-0000-000000000101','E1','L1',
   '30000000-0000-0000-0000-000000000101',
   '10000000-0000-0000-0000-000000000001','EUR','ABIERTA',1,
   20,0,0,20,'{}','11111111-1111-1111-1111-111111111111','2026-09-23'),
  ('70000000-0000-0000-0000-000000000102','E1','L1',
   '30000000-0000-0000-0000-000000000102',
   '10000000-0000-0000-0000-000000000001','EUR','ABIERTA',1,
   10,0,0,10,'{}','11111111-1111-1111-1111-111111111111','2026-09-23'),
  ('70000000-0000-0000-0000-000000000103','E1','L1',
   '30000000-0000-0000-0000-000000000103',
   '10000000-0000-0000-0000-000000000001','EUR','ABIERTA',1,
   15,0,0,15,'{}','11111111-1111-1111-1111-111111111111','2026-09-23');

insert into public.terminales_tpv(
  id,empresa_id,local_id,nombre,activo
) values (
  '90000000-0000-0000-0000-000000000101','E1','L1','TPV Refund',true
);

insert into public.cajas_fisicas(
  id,empresa_id,local_id,nombre,activo
) values (
  '91000000-0000-0000-0000-000000000101','E1','L1','Caja Refund',true
);

insert into public.caja_sesiones(
  id,empresa_id,local_id,caja_id,estado,version,abierta_at,abierta_por
) values (
  '92000000-0000-0000-0000-000000000101','E1','L1',
  '91000000-0000-0000-0000-000000000101',
  'ABIERTA',1,now(),'11111111-1111-1111-1111-111111111111'
);

insert into public.caja_sesion_terminales(
  id,empresa_id,local_id,session_id,terminal_id,desde
) values (
  '93000000-0000-0000-0000-000000000101','E1','L1',
  '92000000-0000-0000-0000-000000000101',
  '90000000-0000-0000-0000-000000000101',now()
);

select set_config(
  'request.jwt.claim.sub',
  '11111111-1111-1111-1111-111111111111',
  false
);
select set_config('app.test_empresa','E1',false);
select set_config('app.test_local','L1',false);

-- Pago A: tarjeta 20 EUR.
set role authenticated;

select public.abc_abrir_checkout(
  'M03C:checkout:card:A','E1','L1',
  '40000000-0000-0000-0000-000000000101',
  '30000000-0000-0000-0000-000000000101',
  array['70000000-0000-0000-0000-000000000101'::uuid],
  '2026-09-23'
);

select public.abc_iniciar_cobro(
  'M03C:pay:card:A','E1','L1',
  '40000000-0000-0000-0000-000000000101',
  '50000000-0000-0000-0000-000000000101',
  '60000000-0000-0000-0000-000000000101',
  'TARJETA',20,'EUR',
  '90000000-0000-0000-0000-000000000101',
  null,null
);

reset role;
set role service_role;

select public.abc_resolver_intento(
  'M03C:pay:card:A:confirm','E1','L1',
  '60000000-0000-0000-0000-000000000101',
  'CONFIRMADO','SIM','SIM-PAY-M03C-A',
  20,20,null,'{"source":"fixture"}'
);

reset role;
set role authenticated;

-- Reserva economica de 8 EUR.
select public.abc_solicitar_reembolso(
  'M03C:refund:A1:request','E1','L1',
  '80000000-0000-0000-0000-000000000101',
  '50000000-0000-0000-0000-000000000101',
  8,'Devolucion parcial A1',
  '90000000-0000-0000-0000-000000000101',
  '2026-09-23'
);

-- Replay exacto: no debe duplicar reembolso.
select public.abc_solicitar_reembolso(
  'M03C:refund:A1:request','E1','L1',
  '80000000-0000-0000-0000-000000000101',
  '50000000-0000-0000-0000-000000000101',
  8,'Devolucion parcial A1',
  '90000000-0000-0000-0000-000000000101',
  '2026-09-23'
);

reset role;

do $$
declare
  v_max numeric;
  v_n integer;
begin
  select count(*) into v_n
    from public.reembolsos
   where id='80000000-0000-0000-0000-000000000101';
  if v_n<>1 then raise exception 'M03C_FAIL: replay duplico reembolso'; end if;

  select private.abc_max_reembolsable_pago(
    'E1','L1',
    (select id from public.pago_aplicaciones
      where pago_id='50000000-0000-0000-0000-000000000101'
      limit 1)
  ) into v_max;

  if v_max<>12 then
    raise exception 'M03C_FAIL: pendiente no comprometio 8; max=%',v_max;
  end if;
end $$;

set role service_role;

-- UNKNOWN conserva el compromiso.
select public.abc_resolver_reembolso(
  'M03C:refund:A1:unknown','E1','L1',
  '80000000-0000-0000-0000-000000000101',
  'DESCONOCIDO','SIM','SIM-REF-M03C-A1',
  '{"step":"timeout"}','2026-09-23'
);

reset role;

do $$
declare
  v_max numeric;
  v_estado text;
begin
  select estado into v_estado
    from public.reembolsos
   where id='80000000-0000-0000-0000-000000000101';
  if v_estado<>'DESCONOCIDO' then
    raise exception 'M03C_FAIL: estado UNKNOWN no persistio';
  end if;

  select private.abc_max_reembolsable_pago(
    'E1','L1',
    (select id from public.pago_aplicaciones
      where pago_id='50000000-0000-0000-0000-000000000101'
      limit 1)
  ) into v_max;
  if v_max<>12 then
    raise exception 'M03C_FAIL: UNKNOWN libero capacidad; max=%',v_max;
  end if;
end $$;

set role authenticated;

do $$
begin
  begin
    perform public.abc_solicitar_reembolso(
      'M03C:refund:A:too-much','E1','L1',
      '80000000-0000-0000-0000-000000000109',
      '50000000-0000-0000-0000-000000000101',
      13,'Debe fallar por saldo comprometido',
      '90000000-0000-0000-0000-000000000101',
      '2026-09-23'
    );
    raise exception 'M03C_FAIL: permitio reembolso superior al disponible';
  exception when others then
    if sqlerrm not like '%saldo_reembolsable_insuficiente%' then raise; end if;
  end;
end $$;

reset role;
set role service_role;

-- Evidencia posterior confirma el UNKNOWN.
select public.abc_resolver_reembolso(
  'M03C:refund:A1:confirm','E1','L1',
  '80000000-0000-0000-0000-000000000101',
  'CONFIRMADO','SIM','SIM-REF-M03C-A1',
  '{"step":"confirmed"}','2026-09-23'
);

reset role;

do $$
declare
  v_estado text;
  v_snapshot jsonb;
begin
  select estado,provider_snapshot
    into v_estado,v_snapshot
    from public.reembolsos
   where id='80000000-0000-0000-0000-000000000101';

  if v_estado<>'CONFIRMADO' then
    raise exception 'M03C_FAIL: UNKNOWN no pudo resolverse a CONFIRMADO';
  end if;
  if v_snapshot->>'step'<>'confirmed' then
    raise exception 'M03C_FAIL: provider_snapshot no conserva evidencia final';
  end if;

  select estado into v_estado
    from public.pagos
   where id='50000000-0000-0000-0000-000000000101';
  if v_estado<>'CONFIRMADO' then
    raise exception 'M03C_FAIL: reembolso parcial marco pago completo';
  end if;
end $$;

set role authenticated;

-- Segundo reembolso completa los 20 EUR.
select public.abc_solicitar_reembolso(
  'M03C:refund:A2:request','E1','L1',
  '80000000-0000-0000-0000-000000000102',
  '50000000-0000-0000-0000-000000000101',
  12,'Completar devolucion A',
  '90000000-0000-0000-0000-000000000101',
  '2026-09-23'
);

reset role;
set role service_role;

select public.abc_resolver_reembolso(
  'M03C:refund:A2:confirm','E1','L1',
  '80000000-0000-0000-0000-000000000102',
  'CONFIRMADO','SIM','SIM-REF-M03C-A2',
  '{"step":"confirmed"}','2026-09-23'
);

reset role;

do $$
declare
  v_estado text;
  v_max numeric;
begin
  select estado into v_estado
    from public.pagos
   where id='50000000-0000-0000-0000-000000000101';
  if v_estado<>'REEMBOLSADO' then
    raise exception 'M03C_FAIL: pago totalmente devuelto no quedo REEMBOLSADO';
  end if;

  select private.abc_max_reembolsable_pago(
    'E1','L1',
    (select id from public.pago_aplicaciones
      where pago_id='50000000-0000-0000-0000-000000000101'
      limit 1)
  ) into v_max;
  if v_max<>0 then
    raise exception 'M03C_FAIL: pago totalmente devuelto conserva capacidad %',v_max;
  end if;
end $$;

-- Pago B: efectivo 10 EUR y reembolso de caja.
set role authenticated;

select public.abc_abrir_checkout(
  'M03C:checkout:cash:B','E1','L1',
  '40000000-0000-0000-0000-000000000102',
  '30000000-0000-0000-0000-000000000102',
  array['70000000-0000-0000-0000-000000000102'::uuid],
  '2026-09-23'
);

select public.abc_iniciar_cobro(
  'M03C:pay:cash:B','E1','L1',
  '40000000-0000-0000-0000-000000000102',
  '50000000-0000-0000-0000-000000000102',
  '60000000-0000-0000-0000-000000000102',
  'EFECTIVO',10,'EUR',
  '90000000-0000-0000-0000-000000000101',
  20,10
);

select public.abc_confirmar_efectivo(
  'M03C:pay:cash:B:confirm','E1','L1',
  '60000000-0000-0000-0000-000000000102',
  '91000000-0000-0000-0000-000000000101',
  '92000000-0000-0000-0000-000000000101',
  '90000000-0000-0000-0000-000000000101',
  '2026-09-23'
);

select public.abc_solicitar_reembolso(
  'M03C:refund:cash:B:request','E1','L1',
  '80000000-0000-0000-0000-000000000103',
  '50000000-0000-0000-0000-000000000102',
  10,'Reembolso efectivo B',
  '90000000-0000-0000-0000-000000000101',
  '2026-09-23'
);

select public.abc_confirmar_reembolso_efectivo(
  'M03C:refund:cash:B:confirm','E1','L1',
  '80000000-0000-0000-0000-000000000103',
  '91000000-0000-0000-0000-000000000101',
  '92000000-0000-0000-0000-000000000101',
  '90000000-0000-0000-0000-000000000101',
  '2026-09-23'
);

reset role;

do $$
declare
  v_n integer;
  v_effect numeric;
  v_estado text;
begin
  select count(*),min(efecto_efectivo)
    into v_n,v_effect
    from public.caja_operaciones
   where abc_command_id='M03C:refund:cash:B:confirm'
     and tipo='REEMBOLSO'
     and categoria='REEMBOLSO_VENTA';

  if v_n<>1 or v_effect<>-10 then
    raise exception 'M03C_FAIL: caja reembolso efectivo n=% efecto=%',v_n,v_effect;
  end if;

  select estado into v_estado
    from public.pagos
   where id='50000000-0000-0000-0000-000000000102';
  if v_estado<>'REEMBOLSADO' then
    raise exception 'M03C_FAIL: pago efectivo completo no REEMBOLSADO';
  end if;
end $$;

-- Pago C: tarjeta 15 EUR. Un reembolso cancelado debe liberar capacidad.
set role authenticated;

select public.abc_abrir_checkout(
  'M03C:checkout:card:C','E1','L1',
  '40000000-0000-0000-0000-000000000103',
  '30000000-0000-0000-0000-000000000103',
  array['70000000-0000-0000-0000-000000000103'::uuid],
  '2026-09-23'
);

select public.abc_iniciar_cobro(
  'M03C:pay:card:C','E1','L1',
  '40000000-0000-0000-0000-000000000103',
  '50000000-0000-0000-0000-000000000103',
  '60000000-0000-0000-0000-000000000103',
  'TARJETA',15,'EUR',
  '90000000-0000-0000-0000-000000000101',
  null,null
);

reset role;
set role service_role;

select public.abc_resolver_intento(
  'M03C:pay:card:C:confirm','E1','L1',
  '60000000-0000-0000-0000-000000000103',
  'CONFIRMADO','SIM','SIM-PAY-M03C-C',
  15,15,null,'{"source":"fixture"}'
);

reset role;
set role authenticated;

select public.abc_solicitar_reembolso(
  'M03C:refund:C:cancel:req','E1','L1',
  '80000000-0000-0000-0000-000000000104',
  '50000000-0000-0000-0000-000000000103',
  5,'Reserva que se cancelara',
  '90000000-0000-0000-0000-000000000101',
  '2026-09-23'
);

select public.abc_cancelar_reembolso(
  'M03C:refund:C:cancel','E1','L1',
  '80000000-0000-0000-0000-000000000104',
  'Cliente desiste',
  '90000000-0000-0000-0000-000000000101',
  '2026-09-23'
);

reset role;

do $$
declare
  v_max numeric;
  v_estado text;
begin
  select estado into v_estado
    from public.reembolsos
   where id='80000000-0000-0000-0000-000000000104';
  if v_estado<>'CANCELADO' then
    raise exception 'M03C_FAIL: cancelacion local no persistio';
  end if;

  select private.abc_max_reembolsable_pago(
    'E1','L1',
    (select id from public.pago_aplicaciones
      where pago_id='50000000-0000-0000-0000-000000000103'
      limit 1)
  ) into v_max;
  if v_max<>15 then
    raise exception 'M03C_FAIL: cancelacion no libero capacidad; max=%',v_max;
  end if;
end $$;

-- ACL y aislamiento.
do $$
begin
  if not has_function_privilege(
    'authenticated',
    'public.abc_solicitar_reembolso(text,text,text,uuid,uuid,numeric,text,uuid,date)',
    'EXECUTE'
  ) then raise exception 'M03C_FAIL: authenticated sin solicitar reembolso'; end if;

  if not has_function_privilege(
    'authenticated',
    'public.abc_cancelar_reembolso(text,text,text,uuid,text,uuid,date)',
    'EXECUTE'
  ) then raise exception 'M03C_FAIL: authenticated sin cancelar reembolso'; end if;

  if not has_function_privilege(
    'authenticated',
    'public.abc_confirmar_reembolso_efectivo(text,text,text,uuid,uuid,uuid,uuid,date)',
    'EXECUTE'
  ) then raise exception 'M03C_FAIL: authenticated sin confirmar reembolso efectivo'; end if;

  if has_function_privilege(
    'authenticated',
    'public.abc_resolver_reembolso(text,text,text,uuid,text,text,text,jsonb,date)',
    'EXECUTE'
  ) then raise exception 'M03C_FAIL: resolver reembolso expuesto a authenticated'; end if;

  if not has_function_privilege(
    'service_role',
    'public.abc_resolver_reembolso(text,text,text,uuid,text,text,text,jsonb,date)',
    'EXECUTE'
  ) then raise exception 'M03C_FAIL: service_role sin resolver reembolso'; end if;

  if has_function_privilege(
    'anon',
    'public.abc_solicitar_reembolso(text,text,text,uuid,uuid,numeric,text,uuid,date)',
    'EXECUTE'
  ) then raise exception 'M03C_FAIL: anon puede solicitar reembolso'; end if;

  if has_function_privilege(
    'authenticated',
    'private.abc_actualizar_pago_reembolso_estado(text,text,uuid)',
    'EXECUTE'
  ) then raise exception 'M03C_FAIL: helper privado expuesto'; end if;

  if not exists(
    select 1
      from public.abc_operaciones
     where operation_id='M03C:refund:A1:confirm'
       and executor_kind='SYSTEM_PROVIDER'
       and executor_ref='SIM'
  ) then
    raise exception 'M03C_FAIL: ejecutor proveedor no auditado';
  end if;
end $$;

select 'ABC_F2_M03C_CONTRACT=PASS' as resultado;
