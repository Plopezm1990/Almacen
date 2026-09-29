\set ON_ERROR_STOP on

-- F4 B02/B03: estados e identidad de intento sobre el backend F2 existente.

do $$
declare
  v_oid oid;
begin
  v_oid:=to_regprocedure('public.abc_preparar_checkout_cuenta(text,text,text,uuid,uuid,bigint,uuid,uuid,date)');
  if v_oid is null then raise exception 'F4_B02_B03_FAIL: RPC puente ausente'; end if;
  if not exists(
    select 1 from pg_proc
    where oid=v_oid and prosecdef and coalesce(proconfig,'{}')::text like '%search_path=%'
  ) then raise exception 'F4_B02_B03_FAIL: RPC puente sin hardening'; end if;
  if not has_function_privilege('authenticated',v_oid,'EXECUTE')
     or has_function_privilege('anon',v_oid,'EXECUTE')
     or has_function_privilege('service_role',v_oid,'EXECUTE') then
    raise exception 'F4_B02_B03_FAIL: ACL RPC incorrecta';
  end if;
  if has_function_privilege(
    'authenticated','private.abc_f4_lineas_cobrables_cuenta(text,text,uuid)','EXECUTE'
  ) then raise exception 'F4_B02_B03_FAIL: helper privado expuesto'; end if;
end $$;

insert into auth.users(id) values
  ('11111111-2222-3333-4444-555555555551');

insert into public.empresas(id,nombre,activo)
values ('emp-f4','Empresa F4 ficticia',true);

insert into public.locales(id,empresa_id,nombre,activo)
values ('loc-f4','emp-f4','Local F4 ficticio',true);

select set_config('app.test_empresa','emp-f4',false);
select set_config('app.test_local','loc-f4',false);
select set_config('request.jwt.claim.sub','11111111-2222-3333-4444-555555555551',false);

insert into public.membresias_usuario(user_id,empresa_id,local_id,todos_locales,rol,activo)
values ('11111111-2222-3333-4444-555555555551','emp-f4','loc-f4',false,'Propietario',true);

insert into public.entidades_fiscales(
  id,empresa_id,nombre_legal,identificador_fiscal,country_code,simulada,activa
) values (
  '10000000-2222-3333-4444-555555555551','emp-f4','Entidad F4','SIM-F4','ES',true,true
);
insert into public.entidad_fiscal_monedas(
  empresa_id,entidad_fiscal_id,currency_code,es_principal,activa
) values ('emp-f4','10000000-2222-3333-4444-555555555551','EUR',true,true);
insert into public.entidad_fiscal_locales(
  empresa_id,local_id,entidad_fiscal_id,activa
) values ('emp-f4','loc-f4','10000000-2222-3333-4444-555555555551',true);
insert into public.entidad_fiscal_local_monedas(
  empresa_id,local_id,entidad_fiscal_id,currency_code,activa
) values ('emp-f4','loc-f4','10000000-2222-3333-4444-555555555551','EUR',true);

insert into public.terminales_tpv(id,empresa_id,local_id,nombre,device_key,activo)
values ('20000000-2222-3333-4444-555555555551','emp-f4','loc-f4','Terminal F4','f4-device',true);
insert into public.cajas_fisicas(id,empresa_id,local_id,nombre,activo)
values ('30000000-2222-3333-4444-555555555551','emp-f4','loc-f4','Caja F4',true);
insert into public.caja_sesiones(
  id,empresa_id,local_id,caja_id,estado,version,abierta_at,abierta_por
) values (
  '40000000-2222-3333-4444-555555555551','emp-f4','loc-f4',
  '30000000-2222-3333-4444-555555555551','ABIERTA',1,now(),
  '11111111-2222-3333-4444-555555555551'
);
insert into public.caja_sesion_terminales(
  empresa_id,local_id,session_id,terminal_id,desde
) values (
  'emp-f4','loc-f4','40000000-2222-3333-4444-555555555551',
  '20000000-2222-3333-4444-555555555551',now()
);
insert into public.caja_sesion_responsables(
  empresa_id,local_id,session_id,user_id,desde,asignado_por,motivo
) values (
  'emp-f4','loc-f4','40000000-2222-3333-4444-555555555551',
  '11111111-2222-3333-4444-555555555551',now(),
  '11111111-2222-3333-4444-555555555551','TEST_F4_B02_B03'
);

-- Dos cuentas listas: una efectivo y otra tarjeta simulada.
insert into public.cuentas_comerciales(
  id,empresa_id,local_id,currency_code,modalidad,estado,version,
  created_by,opened_operating_day,responsable_actual
) values
(
  '50000000-2222-3333-4444-555555555551','emp-f4','loc-f4','EUR','BARRA','ABIERTA',1,
  '11111111-2222-3333-4444-555555555551','2026-09-29',
  '11111111-2222-3333-4444-555555555551'
),
(
  '50000000-2222-3333-4444-555555555552','emp-f4','loc-f4','EUR','BARRA','ABIERTA',1,
  '11111111-2222-3333-4444-555555555551','2026-09-29',
  '11111111-2222-3333-4444-555555555551'
);

insert into public.pedidos_tpv(
  id,empresa_id,local_id,cuenta_id,currency_code,estado,version,
  created_by,created_operating_day
) values
(
  '60000000-2222-3333-4444-555555555551','emp-f4','loc-f4',
  '50000000-2222-3333-4444-555555555551','EUR','ENVIADO',1,
  '11111111-2222-3333-4444-555555555551','2026-09-29'
),
(
  '60000000-2222-3333-4444-555555555552','emp-f4','loc-f4',
  '50000000-2222-3333-4444-555555555552','EUR','ENVIADO',1,
  '11111111-2222-3333-4444-555555555551','2026-09-29'
);

insert into public.pedido_lineas(
  id,empresa_id,local_id,pedido_id,producto_id,cantidad,unidad,estado,version,
  entidad_fiscal_id,currency_code,precio_unitario,descuento_total,base,impuestos,total,
  snapshot_comercial,snapshot_calculo,created_by,created_operating_day
) values
(
  '70000000-2222-3333-4444-555555555551','emp-f4','loc-f4',
  '60000000-2222-3333-4444-555555555551','prod-f4-cash',1,'ud','ENVIADA',1,
  '10000000-2222-3333-4444-555555555551','EUR',10,0,10,1,11,
  '{"test":true}','{"modo":"TEST_F4"}',
  '11111111-2222-3333-4444-555555555551','2026-09-29'
),
(
  '70000000-2222-3333-4444-555555555552','emp-f4','loc-f4',
  '60000000-2222-3333-4444-555555555552','prod-f4-card',1,'ud','ENVIADA',1,
  '10000000-2222-3333-4444-555555555551','EUR',20,0,20,2,22,
  '{"test":true}','{"modo":"TEST_F4"}',
  '11111111-2222-3333-4444-555555555551','2026-09-29'
);

set role authenticated;

-- B03: preparar una vez y recuperar con otra identidad de checkout sin duplicar snapshot.
select public.abc_preparar_checkout_cuenta(
  'f4.cash.prepare','emp-f4','loc-f4',
  '80000000-2222-3333-4444-555555555551',
  '50000000-2222-3333-4444-555555555551',1,
  '20000000-2222-3333-4444-555555555551',
  '40000000-2222-3333-4444-555555555551','2026-09-29'
);

select public.abc_preparar_checkout_cuenta(
  'f4.cash.recover','emp-f4','loc-f4',
  '80000000-2222-3333-4444-555555555559',
  '50000000-2222-3333-4444-555555555551',1,
  '20000000-2222-3333-4444-555555555551',
  '40000000-2222-3333-4444-555555555551','2026-09-29'
);

reset role;

do $$
declare
  v_sales integer;
  v_lines integer;
  v_checkouts integer;
begin
  select count(*) into v_sales from public.ventas_fiscales
   where empresa_id='emp-f4' and local_id='loc-f4'
     and cuenta_id='50000000-2222-3333-4444-555555555551';
  select count(*) into v_lines from public.venta_fiscal_lineas
   where empresa_id='emp-f4' and local_id='loc-f4'
     and source_line_id='70000000-2222-3333-4444-555555555551';
  select count(*) into v_checkouts from public.checkouts
   where empresa_id='emp-f4' and local_id='loc-f4'
     and cuenta_id='50000000-2222-3333-4444-555555555551';
  if v_sales<>1 or v_lines<>1 or v_checkouts<>1 then
    raise exception 'F4_B02_B03_FAIL: recovery duplicó snapshot sales=% lines=% checkouts=%',
      v_sales,v_lines,v_checkouts;
  end if;
end $$;

-- Mismo operation_id con contenido distinto: conflicto, no segundo efecto.
set role authenticated;
do $$
begin
  begin
    perform public.abc_preparar_checkout_cuenta(
      'f4.cash.prepare','emp-f4','loc-f4',
      '80000000-2222-3333-4444-555555555558',
      '50000000-2222-3333-4444-555555555551',1,
      '20000000-2222-3333-4444-555555555551',
      '40000000-2222-3333-4444-555555555551','2026-09-29'
    );
    raise exception 'F4_B02_B03_FAIL: operation_id distinto contenido aceptado';
  exception when others then
    if sqlerrm not like '%operation_id_conflict%' then raise; end if;
  end;
end $$;

-- Efectivo: intento y confirmación autoritativa exacta.
select public.abc_iniciar_cobro(
  'f4.cash.pay','emp-f4','loc-f4',
  '80000000-2222-3333-4444-555555555551',
  '81000000-2222-3333-4444-555555555551',
  '82000000-2222-3333-4444-555555555551',
  'EFECTIVO',11,'EUR',
  '20000000-2222-3333-4444-555555555551',11,0
);
select public.abc_confirmar_efectivo(
  'f4.cash.confirm','emp-f4','loc-f4',
  '82000000-2222-3333-4444-555555555551',
  '30000000-2222-3333-4444-555555555551',
  '40000000-2222-3333-4444-555555555551',
  '20000000-2222-3333-4444-555555555551','2026-09-29'
);

reset role;

do $$
declare
  v_pago text;
  v_intento text;
  v_estado jsonb;
  v_cash numeric;
begin
  select estado into v_pago from public.pagos
   where id='81000000-2222-3333-4444-555555555551';
  select estado into v_intento from public.pago_intentos
   where id='82000000-2222-3333-4444-555555555551';
  select efecto_efectivo into v_cash from public.caja_operaciones
   where abc_command_id='f4.cash.confirm';
  set local role authenticated;
  select public.abc_estado_cobro_cuenta(
    'emp-f4','loc-f4','50000000-2222-3333-4444-555555555551'
  ) into v_estado;
  reset role;
  if v_pago<>'CONFIRMADO' or v_intento<>'CONFIRMADO' or v_cash<>11
     or v_estado->>'estado'<>'PAGADO' or (v_estado->>'saldo')::numeric<>0 then
    raise exception 'F4_B02_B03_FAIL: efectivo pago=% intento=% cash=% estado=%',
      v_pago,v_intento,v_cash,v_estado;
  end if;
end $$;

-- Tarjeta piloto: persiste identidad antes del proveedor y queda PENDIENTE.
set role authenticated;
select public.abc_preparar_checkout_cuenta(
  'f4.card.prepare','emp-f4','loc-f4',
  '80000000-2222-3333-4444-555555555552',
  '50000000-2222-3333-4444-555555555552',1,
  '20000000-2222-3333-4444-555555555551',
  '40000000-2222-3333-4444-555555555551','2026-09-29'
);
select public.abc_iniciar_cobro(
  'f4.card.pay','emp-f4','loc-f4',
  '80000000-2222-3333-4444-555555555552',
  '81000000-2222-3333-4444-555555555552',
  '82000000-2222-3333-4444-555555555552',
  'TARJETA',22,'EUR',
  '20000000-2222-3333-4444-555555555551',null,null
);
-- Replay exacto: no duplica intento ni outbox.
select public.abc_iniciar_cobro(
  'f4.card.pay','emp-f4','loc-f4',
  '80000000-2222-3333-4444-555555555552',
  '81000000-2222-3333-4444-555555555552',
  '82000000-2222-3333-4444-555555555552',
  'TARJETA',22,'EUR',
  '20000000-2222-3333-4444-555555555551',null,null
);
reset role;

do $$
declare
  v_intentos integer;
  v_estado text;
  v_reservas integer;
  v_outbox integer;
  v_payload text;
begin
  select count(*),min(estado) into v_intentos,v_estado
    from public.pago_intentos
   where pago_id='81000000-2222-3333-4444-555555555552';
  select count(*) into v_reservas
    from public.reservas_saldo
   where intento_id='82000000-2222-3333-4444-555555555552' and estado='ACTIVA';
  select count(*),min(payload::text) into v_outbox,v_payload
    from public.efectos_pendientes
   where dedupe_key='pago-intento:82000000-2222-3333-4444-555555555552';
  if v_intentos<>1 or v_estado<>'PENDIENTE' or v_reservas<>1 or v_outbox<>1 then
    raise exception 'F4_B02_B03_FAIL: tarjeta intentos=% estado=% reservas=% outbox=%',
      v_intentos,v_estado,v_reservas,v_outbox;
  end if;
  if lower(coalesce(v_payload,'')) ~ '(pan|cvv|card_number|numero_tarjeta)' then
    raise exception 'F4_B02_B03_FAIL: payload contiene dato de tarjeta prohibido';
  end if;
end $$;

-- Fail-closed: B02/B03 no interpreta cuotas A08 por importe; eso pertenece a B05.
insert into public.cuenta_cuotas_importe(
  id,empresa_id,local_id,cuenta_origen_id,cuenta_destino_id,importe,currency_code,
  etiqueta,estado,version,operation_id,created_by
) values (
  '90000000-2222-3333-4444-555555555551','emp-f4','loc-f4',
  '50000000-2222-3333-4444-555555555551',
  '50000000-2222-3333-4444-555555555552',
  1,'EUR','TEST_B05','ACTIVA',1,'f4.test.quota',
  '11111111-2222-3333-4444-555555555551'
);

set role authenticated;
do $$
begin
  begin
    perform public.abc_preparar_checkout_cuenta(
      'f4.quota.block','emp-f4','loc-f4',
      '80000000-2222-3333-4444-555555555557',
      '50000000-2222-3333-4444-555555555552',1,
      '20000000-2222-3333-4444-555555555551',
      '40000000-2222-3333-4444-555555555551','2026-09-29'
    );
    raise exception 'F4_B02_B03_FAIL: cuota B05 aceptada en B02/B03';
  exception when others then
    if sqlerrm not like '%checkout_cuotas_importe_pendiente_b05%' then raise; end if;
  end;
end $$;
reset role;

select 'ABC_F4_B02_B03=PASS' as result;
