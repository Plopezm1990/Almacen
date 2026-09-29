\set ON_ERROR_STOP on

-- F4 B04: el cobro incierto queda bloqueado hasta resolverlo con referencia y evidencia.

do $$
declare
  v_oid oid;
begin
  if to_regclass('public.abc_cobro_incidencias') is null then
    raise exception 'F4_B04_FAIL: tabla de incidencias ausente';
  end if;
  if not exists(
    select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
     where n.nspname='public' and c.relname='abc_cobro_incidencias' and c.relrowsecurity
  ) then raise exception 'F4_B04_FAIL: RLS ausente'; end if;
  v_oid:=to_regprocedure('public.abc_abrir_incidencia_cobro(text,text,text,uuid,text,text,text,jsonb)');
  if v_oid is null or not has_function_privilege('authenticated',v_oid,'EXECUTE')
     or has_function_privilege('anon',v_oid,'EXECUTE') then
    raise exception 'F4_B04_FAIL: ACL de apertura incorrecta';
  end if;
  v_oid:=to_regprocedure('public.abc_resolver_incidencia_cobro(text,text,text,uuid,text,text,text,numeric,numeric,numeric,jsonb)');
  if v_oid is null or not has_function_privilege('authenticated',v_oid,'EXECUTE')
     or has_function_privilege('anon',v_oid,'EXECUTE') then
    raise exception 'F4_B04_FAIL: ACL de resolución incorrecta';
  end if;
  if has_function_privilege('authenticated','public.abc_resolver_intento(text,text,text,uuid,text,text,text,numeric,numeric,numeric,jsonb)','EXECUTE') then
    raise exception 'F4_B04_FAIL: resolver de proveedor expuesto al cliente';
  end if;
end $$;

insert into auth.users(id) values ('11111111-2222-3333-4444-555555555561');
insert into public.empresas(id,nombre,activo) values ('emp-f4b04','Empresa B04',true);
insert into public.locales(id,empresa_id,nombre,activo) values ('loc-f4b04','emp-f4b04','Local B04',true);
insert into public.membresias_usuario(user_id,empresa_id,local_id,todos_locales,rol,activo)
values ('11111111-2222-3333-4444-555555555561','emp-f4b04','loc-f4b04',false,'Propietario',true);
insert into public.entidades_fiscales(id,empresa_id,nombre_legal,identificador_fiscal,country_code,simulada,activa)
values ('10000000-2222-3333-4444-555555555561','emp-f4b04','Entidad B04','SIM-B04','ES',true,true);
insert into public.entidad_fiscal_monedas(empresa_id,entidad_fiscal_id,currency_code,es_principal,activa)
values ('emp-f4b04','10000000-2222-3333-4444-555555555561','EUR',true,true);
insert into public.entidad_fiscal_locales(empresa_id,local_id,entidad_fiscal_id,activa)
values ('emp-f4b04','loc-f4b04','10000000-2222-3333-4444-555555555561',true);
insert into public.entidad_fiscal_local_monedas(empresa_id,local_id,entidad_fiscal_id,currency_code)
values ('emp-f4b04','loc-f4b04','10000000-2222-3333-4444-555555555561','EUR');
insert into public.terminales_tpv(id,empresa_id,local_id,nombre,device_key,activo)
values ('20000000-2222-3333-4444-555555555561','emp-f4b04','loc-f4b04','Terminal B04','b04-device',true);
insert into public.cajas_fisicas(id,empresa_id,local_id,nombre,activo)
values ('30000000-2222-3333-4444-555555555561','emp-f4b04','loc-f4b04','Caja B04',true);
insert into public.caja_sesiones(id,empresa_id,local_id,caja_id,estado,version,abierta_at,abierta_por)
values ('40000000-2222-3333-4444-555555555561','emp-f4b04','loc-f4b04','30000000-2222-3333-4444-555555555561','ABIERTA',1,now(),'11111111-2222-3333-4444-555555555561');
insert into public.caja_sesion_terminales(empresa_id,local_id,session_id,terminal_id,desde)
values ('emp-f4b04','loc-f4b04','40000000-2222-3333-4444-555555555561','20000000-2222-3333-4444-555555555561',now());
insert into public.caja_sesion_responsables(empresa_id,local_id,session_id,user_id,desde,asignado_por,motivo)
values ('emp-f4b04','loc-f4b04','40000000-2222-3333-4444-555555555561','11111111-2222-3333-4444-555555555561',now(),'11111111-2222-3333-4444-555555555561','TEST_F4_B04');
insert into public.cuentas_comerciales(id,empresa_id,local_id,currency_code,modalidad,estado,version,created_by,opened_operating_day,responsable_actual)
values ('50000000-2222-3333-4444-555555555561','emp-f4b04','loc-f4b04','EUR','BARRA','ABIERTA',1,'11111111-2222-3333-4444-555555555561','2026-09-29','11111111-2222-3333-4444-555555555561');
insert into public.pedidos_tpv(id,empresa_id,local_id,cuenta_id,currency_code,estado,version,created_by,created_operating_day)
values ('60000000-2222-3333-4444-555555555561','emp-f4b04','loc-f4b04','50000000-2222-3333-4444-555555555561','EUR','ENVIADO',1,'11111111-2222-3333-4444-555555555561','2026-09-29');
insert into public.pedido_lineas(id,empresa_id,local_id,pedido_id,producto_id,cantidad,unidad,estado,version,entidad_fiscal_id,currency_code,precio_unitario,descuento_total,base,impuestos,total,snapshot_comercial,snapshot_calculo,created_by,created_operating_day)
values ('70000000-2222-3333-4444-555555555561','emp-f4b04','loc-f4b04','60000000-2222-3333-4444-555555555561','prod-b04',1,'ud','ENVIADA',1,'10000000-2222-3333-4444-555555555561','EUR',20,0,20,2,22,'{"test":true}','{"modo":"TEST_F4_B04"}','11111111-2222-3333-4444-555555555561','2026-09-29');
insert into public.cuentas_comerciales(id,empresa_id,local_id,currency_code,modalidad,estado,version,created_by,opened_operating_day,responsable_actual)
values ('50000000-2222-3333-4444-555555555562','emp-f4b04','loc-f4b04','EUR','BARRA','ABIERTA',1,'11111111-2222-3333-4444-555555555561','2026-09-29','11111111-2222-3333-4444-555555555561');
insert into public.pedidos_tpv(id,empresa_id,local_id,cuenta_id,currency_code,estado,version,created_by,created_operating_day)
values ('60000000-2222-3333-4444-555555555562','emp-f4b04','loc-f4b04','50000000-2222-3333-4444-555555555562','EUR','ENVIADO',1,'11111111-2222-3333-4444-555555555561','2026-09-29');
insert into public.pedido_lineas(id,empresa_id,local_id,pedido_id,producto_id,cantidad,unidad,estado,version,entidad_fiscal_id,currency_code,precio_unitario,descuento_total,base,impuestos,total,snapshot_comercial,snapshot_calculo,created_by,created_operating_day)
values ('70000000-2222-3333-4444-555555555562','emp-f4b04','loc-f4b04','60000000-2222-3333-4444-555555555562','prod-b04-cancel',1,'ud','ENVIADA',1,'10000000-2222-3333-4444-555555555561','EUR',10,0,10,1,11,'{"test":true}','{"modo":"TEST_F4_B04"}','11111111-2222-3333-4444-555555555561','2026-09-29');

select set_config('request.jwt.claim.sub','11111111-2222-3333-4444-555555555561',false);
set role authenticated;
select public.abc_preparar_checkout_cuenta('b04.prepare','emp-f4b04','loc-f4b04','80000000-2222-3333-4444-555555555561','50000000-2222-3333-4444-555555555561',1,'20000000-2222-3333-4444-555555555561','40000000-2222-3333-4444-555555555561','2026-09-29');
select public.abc_iniciar_cobro('b04.pay','emp-f4b04','loc-f4b04','80000000-2222-3333-4444-555555555561','81000000-2222-3333-4444-555555555561','82000000-2222-3333-4444-555555555561','TARJETA',22,'EUR','20000000-2222-3333-4444-555555555561',null,null);

select public.abc_abrir_incidencia_cobro('b04.incident.open','emp-f4b04','loc-f4b04','82000000-2222-3333-4444-555555555561','Respuesta del proveedor perdida','SIMULADOR','sim-b04-001','{"origen":"corte_respuesta","terminal":"TPV-01"}'::jsonb);

do $$
declare v_incident uuid; v_state text; v_attempt_state text; v_reservas integer;
begin
  select id,estado into v_incident,v_state
    from public.abc_listar_incidencias_cobro('emp-f4b04','loc-f4b04',null)
   where id is not null and motivo='Respuesta del proveedor perdida';
  select estado into v_attempt_state from public.pago_intentos where id='82000000-2222-3333-4444-555555555561';
  select count(*) into v_reservas from public.reservas_saldo where intento_id='82000000-2222-3333-4444-555555555561' and estado='ACTIVA';
  if v_incident is null or v_state<>'ABIERTA' or v_attempt_state<>'PENDIENTE' or v_reservas<>1 then
    raise exception 'F4_B04_FAIL: incidencia no bloquea correctamente estado=% intento=% reservas=%',v_state,v_attempt_state,v_reservas;
  end if;
  begin
    perform public.abc_abrir_incidencia_cobro('b04.incident.second','emp-f4b04','loc-f4b04','82000000-2222-3333-4444-555555555561','Duplicado','SIMULADOR','sim-b04-001','{}'::jsonb);
    raise exception 'F4_B04_FAIL: permitió dos incidencias abiertas';
  exception when others then
    if sqlerrm not like '%cobro_incidencia_ya_abierta%' then raise; end if;
  end;
end $$;

select public.abc_resolver_incidencia_cobro('b04.incident.resolve','emp-f4b04','loc-f4b04',(select id from public.abc_listar_incidencias_cobro('emp-f4b04','loc-f4b04',null) where motivo='Respuesta del proveedor perdida'),'CONFIRMADO','SIMULADOR','sim-b04-001',22,22,22,'{"verificado":"proveedor","evidencia_id":"B04-001"}'::jsonb);

select public.abc_preparar_checkout_cuenta('b04.cancel.prepare','emp-f4b04','loc-f4b04','80000000-2222-3333-4444-555555555562','50000000-2222-3333-4444-555555555562',1,'20000000-2222-3333-4444-555555555561','40000000-2222-3333-4444-555555555561','2026-09-29');
select public.abc_iniciar_cobro('b04.cancel.pay','emp-f4b04','loc-f4b04','80000000-2222-3333-4444-555555555562','81000000-2222-3333-4444-555555555562','82000000-2222-3333-4444-555555555562','TARJETA',11,'EUR','20000000-2222-3333-4444-555555555561',null,null);
select public.abc_abrir_incidencia_cobro('b04.cancel.incident','emp-f4b04','loc-f4b04','82000000-2222-3333-4444-555555555562','Autorización cancelada en el terminal','SIMULADOR','sim-b04-002','{"origen":"terminal","resultado":"cancelado"}'::jsonb);
select public.abc_resolver_incidencia_cobro('b04.cancel.resolve','emp-f4b04','loc-f4b04',(select id from public.abc_listar_incidencias_cobro('emp-f4b04','loc-f4b04',null) where motivo='Autorización cancelada en el terminal'),'CANCELADO','SIMULADOR','sim-b04-002',null,null,null,'{"verificado":"terminal","evidencia_id":"B04-002"}'::jsonb);

do $$
declare v_incident_state text; v_payment_state text; v_attempt_state text; v_reservas integer; v_count integer; v_cancel_payment text; v_cancel_attempt text; v_cancel_reservas integer;
begin
  select estado into v_incident_state
    from public.abc_listar_incidencias_cobro('emp-f4b04','loc-f4b04',null)
   where motivo='Respuesta del proveedor perdida';
  select estado into v_payment_state from public.pagos where id='81000000-2222-3333-4444-555555555561';
  select estado into v_attempt_state from public.pago_intentos where id='82000000-2222-3333-4444-555555555561';
  select count(*) into v_reservas from public.reservas_saldo where intento_id='82000000-2222-3333-4444-555555555561' and estado='ACTIVA';
  select count(*) into v_count from public.abc_listar_incidencias_cobro('emp-f4b04','loc-f4b04',null);
  select estado into v_cancel_payment from public.pagos where id='81000000-2222-3333-4444-555555555562';
  select estado into v_cancel_attempt from public.pago_intentos where id='82000000-2222-3333-4444-555555555562';
  select count(*) into v_cancel_reservas from public.reservas_saldo where intento_id='82000000-2222-3333-4444-555555555562' and estado='ACTIVA';
  if v_incident_state<>'RESUELTA' or v_payment_state<>'CONFIRMADO' or v_attempt_state<>'CONFIRMADO' or v_reservas<>0 or v_count<>2
     or v_cancel_payment<>'CANCELADO' or v_cancel_attempt<>'CANCELADO' or v_cancel_reservas<>0 then
    raise exception 'F4_B04_FAIL: resolución incorrecta incidencia=% pago=% intento=% reservas=% incidencias=% cancel_pago=% cancel_intento=% cancel_reservas=%',
      v_incident_state,v_payment_state,v_attempt_state,v_reservas,v_count,v_cancel_payment,v_cancel_attempt,v_cancel_reservas;
  end if;
end $$;

select public.abc_resolver_incidencia_cobro('b04.incident.resolve','emp-f4b04','loc-f4b04',(select id from public.abc_listar_incidencias_cobro('emp-f4b04','loc-f4b04',null) where motivo='Respuesta del proveedor perdida'),'CONFIRMADO','SIMULADOR','sim-b04-001',22,22,22,'{"verificado":"proveedor","evidencia_id":"B04-001"}'::jsonb);
reset role;

select 'ABC_F4_B04=PASS' as result;
