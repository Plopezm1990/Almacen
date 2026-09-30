\set ON_ERROR_STOP on

-- F4 B07 / simulador: recorrido completo con un proveedor ficticio de QA.
-- Nunca se reutiliza como configuración de producción ni contiene secretos.

insert into private.abc_b07_proveedores(
  provider_code,display_name,adapter_key,signature_config,normalization_config,enabled
) values (
  'SIMULATOR','B07 QA Simulator','GENERIC_HMAC',
  '{"location":"HEADER","algorithm":"HMAC_SHA256","encoding":"HEX","name":"x-signature"}'::jsonb,
  '{"event_id":"event_id","account_id":"merchant","reference":"reference","amount":"amount","currency":"currency","status":"status","status_map":{"paid":"CONFIRMADO"},"occurred_at":"occurred_at"}'::jsonb,
  true
);
insert into private.abc_b07_cuentas_comerciales(
  provider_code,provider_account_id,empresa_id,local_id,secret_ref,enabled
) values (
  'SIMULATOR','sim-qa-b07','emp-f4b04','loc-f4b04','ABC_B07_SIMULATOR_SECRET',true
);

insert into public.cuentas_comerciales(id,empresa_id,local_id,currency_code,modalidad,estado,version,created_by,opened_operating_day,responsable_actual)
values ('50000000-2222-3333-4444-555555555563','emp-f4b04','loc-f4b04','EUR','BARRA','ABIERTA',1,'11111111-2222-3333-4444-555555555561','2026-09-29','11111111-2222-3333-4444-555555555561');
insert into public.pedidos_tpv(id,empresa_id,local_id,cuenta_id,currency_code,estado,version,created_by,created_operating_day)
values ('60000000-2222-3333-4444-555555555563','emp-f4b04','loc-f4b04','50000000-2222-3333-4444-555555555563','EUR','ENVIADO',1,'11111111-2222-3333-4444-555555555561','2026-09-29');
insert into public.pedido_lineas(id,empresa_id,local_id,pedido_id,producto_id,cantidad,unidad,estado,version,entidad_fiscal_id,currency_code,precio_unitario,descuento_total,base,impuestos,total,snapshot_comercial,snapshot_calculo,created_by,created_operating_day)
values ('70000000-2222-3333-4444-555555555563','emp-f4b04','loc-f4b04','60000000-2222-3333-4444-555555555563','prod-b07-sim',1,'ud','ENVIADA',1,'10000000-2222-3333-4444-555555555561','EUR',20,0,20,2,22,'{"test":true}','{"modo":"TEST_F4_B07_SIMULATOR"}','11111111-2222-3333-4444-555555555561','2026-09-29');

select set_config('request.jwt.claim.sub','11111111-2222-3333-4444-555555555561',false);
set role authenticated;
select public.abc_preparar_checkout_cuenta(
  'b07.sim.prepare.01','emp-f4b04','loc-f4b04',
  '80000000-2222-3333-4444-555555555563',
  '50000000-2222-3333-4444-555555555563',1,
  '20000000-2222-3333-4444-555555555561',
  '40000000-2222-3333-4444-555555555561','2026-09-29'
);
select public.abc_iniciar_cobro(
  'b07.sim.pay.0001','emp-f4b04','loc-f4b04',
  '80000000-2222-3333-4444-555555555563',
  '81000000-2222-3333-4444-555555555563',
  '82000000-2222-3333-4444-555555555563',
  'TARJETA',22,'EUR','20000000-2222-3333-4444-555555555561',null,null
);
reset role;

-- Fixture de la referencia que normalmente devolvería el proveedor.
update public.pago_intentos
   set provider_code='SIMULATOR',provider_reference='sim-qa-ref-001'
 where id='82000000-2222-3333-4444-555555555563';

set role service_role;
select public.abc_b07_procesar_evento(
  'SIMULATOR','sim-qa-b07','evt-b07-sim-001','sim-qa-ref-001',
  'PAYMENT_STATUS_CHANGED','CONFIRMADO',22,'EUR','2026-09-30T12:00:00Z'::timestamptz,
  '{"event_id":"evt-b07-sim-001","merchant":"sim-qa-b07","reference":"sim-qa-ref-001","amount":"22.00","currency":"EUR","status":"paid"}'::jsonb
);
-- Replay exacto: no crea otra aplicación.
select public.abc_b07_procesar_evento(
  'SIMULATOR','sim-qa-b07','evt-b07-sim-001','sim-qa-ref-001',
  'PAYMENT_STATUS_CHANGED','CONFIRMADO',22,'EUR','2026-09-30T12:00:00Z'::timestamptz,
  '{"event_id":"evt-b07-sim-001","merchant":"sim-qa-b07","reference":"sim-qa-ref-001","amount":"22.00","currency":"EUR","status":"paid"}'::jsonb
);
-- Misma clave con contenido distinto: conflicto, sin segundo efecto.
select public.abc_b07_procesar_evento(
  'SIMULATOR','sim-qa-b07','evt-b07-sim-001','sim-qa-ref-001',
  'PAYMENT_STATUS_CHANGED','CONFIRMADO',23,'EUR','2026-09-30T12:00:00Z'::timestamptz,
  '{"event_id":"evt-b07-sim-001","merchant":"sim-qa-b07","reference":"sim-qa-ref-001","amount":"23.00","currency":"EUR","status":"paid"}'::jsonb
);
-- Importe diferente con otra clave: rechazo sin mutar el pago confirmado.
select public.abc_b07_procesar_evento(
  'SIMULATOR','sim-qa-b07','evt-b07-sim-002','sim-qa-ref-001',
  'PAYMENT_STATUS_CHANGED','CONFIRMADO',23,'EUR','2026-09-30T12:01:00Z'::timestamptz,
  '{"event_id":"evt-b07-sim-002","merchant":"sim-qa-b07","reference":"sim-qa-ref-001","amount":"23.00","currency":"EUR","status":"paid"}'::jsonb
);
reset role;

do $$
declare
  v_pago text;
  v_intento text;
  v_aplicaciones integer;
  v_event_status text;
  v_conflicts integer;
  v_rejected text;
begin
  select estado into v_pago from public.pagos where id='81000000-2222-3333-4444-555555555563';
  select estado into v_intento from public.pago_intentos where id='82000000-2222-3333-4444-555555555563';
  select count(*) into v_aplicaciones from public.pago_aplicaciones where intento_id='82000000-2222-3333-4444-555555555563';
  select processing_status,conflict_count into v_event_status,v_conflicts
    from public.abc_b07_eventos_proveedor
   where provider_code='SIMULATOR' and provider_account_id='sim-qa-b07' and provider_event_id='evt-b07-sim-001';
  select processing_status into v_rejected
    from public.abc_b07_eventos_proveedor
   where provider_code='SIMULATOR' and provider_account_id='sim-qa-b07' and provider_event_id='evt-b07-sim-002';
  if v_pago<>'CONFIRMADO' or v_intento<>'CONFIRMADO' or v_aplicaciones<>1
     or v_event_status<>'APLICADO' or v_conflicts<>1 or v_rejected<>'RECHAZADO' then
    raise exception 'F4_B07_SIM_FAIL: pago=% intento=% aplicaciones=% evento=% conflictos=% rechazo=%',
      v_pago,v_intento,v_aplicaciones,v_event_status,v_conflicts,v_rejected;
  end if;
end $$;

select 'ABC_F4_B07_SIMULATOR=PASS' as result;
