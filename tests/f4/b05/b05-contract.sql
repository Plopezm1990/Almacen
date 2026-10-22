\set ON_ERROR_STOP on

-- F4 B05: una parte en efectivo y otra en tarjeta conserva saldo, cambio,
-- reservas y caja sin permitir que el importe disponible sea negativo.

do $$
declare
  v_oid oid;
begin
  v_oid:=to_regprocedure('public.abc_estado_pago_mixto_cuenta(text,text,uuid)');
  if v_oid is null or not has_function_privilege('authenticated',v_oid,'EXECUTE')
     or has_function_privilege('anon',v_oid,'EXECUTE') then
    raise exception 'F4_B05_FAIL: ACL de detalle mixto incorrecta';
  end if;
end $$;

insert into public.cuentas_comerciales(id,empresa_id,local_id,currency_code,modalidad,estado,version,created_by,opened_operating_day,responsable_actual)
values ('50000000-2222-3333-4444-555555555563','emp-f4b04','loc-f4b04','EUR','BARRA','ABIERTA',1,'11111111-2222-3333-4444-555555555561','2026-09-29','11111111-2222-3333-4444-555555555561');
insert into public.pedidos_tpv(id,empresa_id,local_id,cuenta_id,currency_code,estado,version,created_by,created_operating_day)
values ('60000000-2222-3333-4444-555555555563','emp-f4b04','loc-f4b04','50000000-2222-3333-4444-555555555563','EUR','ENVIADO',1,'11111111-2222-3333-4444-555555555561','2026-09-29');
insert into public.pedido_lineas(id,empresa_id,local_id,pedido_id,producto_id,cantidad,unidad,estado,version,entidad_fiscal_id,currency_code,precio_unitario,descuento_total,base,impuestos,total,snapshot_comercial,snapshot_calculo,created_by,created_operating_day)
values ('70000000-2222-3333-4444-555555555563','emp-f4b04','loc-f4b04','60000000-2222-3333-4444-555555555563','prod-b05',1,'ud','ENVIADA',1,'10000000-2222-3333-4444-555555555561','EUR',20,0,20,2,22,'{"test":true}','{"modo":"TEST_F4_B05"}','11111111-2222-3333-4444-555555555561','2026-09-29');

select set_config('request.jwt.claim.sub','11111111-2222-3333-4444-555555555561',false);
set role authenticated;
select public.abc_preparar_checkout_cuenta('b05.prepare.01','emp-f4b04','loc-f4b04','80000000-2222-3333-4444-555555555563','50000000-2222-3333-4444-555555555563',1,'20000000-2222-3333-4444-555555555561','40000000-2222-3333-4444-555555555561','2026-09-29');
select public.abc_iniciar_cobro('b05.cash.0001','emp-f4b04','loc-f4b04','80000000-2222-3333-4444-555555555563','81000000-2222-3333-4444-555555555563','82000000-2222-3333-4444-555555555563','EFECTIVO',8,'EUR','20000000-2222-3333-4444-555555555561',10,2);
select public.abc_confirmar_efectivo('b05.cash.confirm.0001','emp-f4b04','loc-f4b04','82000000-2222-3333-4444-555555555563','30000000-2222-3333-4444-555555555561','40000000-2222-3333-4444-555555555561','20000000-2222-3333-4444-555555555561','2026-09-29');
select public.abc_iniciar_cobro('b05.card.0001','emp-f4b04','loc-f4b04','80000000-2222-3333-4444-555555555563','81000000-2222-3333-4444-555555555564','82000000-2222-3333-4444-555555555564','TARJETA',14,'EUR','20000000-2222-3333-4444-555555555561',null,null);
reset role;

do $$
declare
  v_detalle jsonb;
  v_caja jsonb;
  v_saldo numeric;
  v_reservado numeric;
  v_disponible numeric;
  v_confirmado numeric;
  v_estado text;
begin
  select public.abc_estado_pago_mixto_cuenta('emp-f4b04','loc-f4b04','50000000-2222-3333-4444-555555555563') into v_detalle;
  v_saldo:=(v_detalle->>'saldo')::numeric;
  v_confirmado:=(v_detalle->>'confirmado')::numeric;
  v_reservado:=(v_detalle->>'reservado')::numeric;
  v_disponible:=(v_detalle->>'disponible_para_nuevo_cobro')::numeric;
  v_estado:=v_detalle->>'estado';
  v_caja:=v_detalle->'cajas'->0;
  if v_estado<>'PARCIALMENTE_PAGADO' or v_confirmado<>8 or v_saldo<>14
     or v_reservado<>14 or v_disponible<>0 then
    raise exception 'F4_B05_FAIL: saldo mixto incorrecto detalle=%',v_detalle;
  end if;
  if (v_detalle->>'efectivo_recibido')::numeric<>10
     or (v_detalle->>'cambio_entregado')::numeric<>2 then
    raise exception 'F4_B05_FAIL: cambio no conservado detalle=%',v_detalle;
  end if;
  if jsonb_array_length(v_detalle->'pagos')<>2 or jsonb_array_length(v_detalle->'intentos')<>2 then
    raise exception 'F4_B05_FAIL: no se conserva el desglose mixto detalle=%',v_detalle;
  end if;
  if v_caja->>'caja_id'<>'30000000-2222-3333-4444-555555555561'
     or (v_caja->>'efecto_efectivo')::numeric<>8
     or (v_caja->'payload'->>'importe_recibido')::numeric<>10
     or (v_caja->'payload'->>'cambio_entregado')::numeric<>2 then
    raise exception 'F4_B05_FAIL: caja no trazable detalle=%',v_detalle;
  end if;
  begin
    perform public.abc_iniciar_cobro('b05.card.over','emp-f4b04','loc-f4b04','80000000-2222-3333-4444-555555555563','81000000-2222-3333-4444-555555555565','82000000-2222-3333-4444-555555555565','TARJETA',1,'EUR','20000000-2222-3333-4444-555555555561',null,null);
    raise exception 'F4_B05_FAIL: permitió cobrar sobre saldo reservado';
  exception when others then
    if sqlerrm not like '%saldo_insuficiente%' then raise; end if;
  end;
end $$;

select 'ABC_F4_B05=PASS' as result;
