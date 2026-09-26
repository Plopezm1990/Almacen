\set ON_ERROR_STOP on

-- A10B — contrato de auditoría append-only de cocina/comandas.
-- Se ejecuta después del contrato A10 sobre el mismo PostgreSQL desechable.

do $$
declare
  v_type text;
  v_expected text[]:=array[
    'ESTACION_PREPARACION_CREADA',
    'PRODUCTO_ESTACION_ASIGNADA',
    'COMANDA_PREPARACION_GENERADA',
    'COMANDA_CAMBIO_ENVIADO',
    'COMANDA_ENTREGA_CONFIRMADA',
    'COMANDA_CANCELACION_GENERADA',
    'COMANDA_MERMA_RESUELTA',
    'COMANDA_REIMPRESION_SOLICITADA'
  ];
begin
  foreach v_type in array v_expected loop
    if not exists(
      select 1 from public.abc_eventos
       where empresa_id='emp-g' and local_id='loc-g1' and event_type=v_type
    ) then
      raise exception 'A10B_FAIL: evento ausente %',v_type;
    end if;
  end loop;
end $$;

-- Un envío con dos estaciones genera exactamente dos eventos de comanda.
do $$
begin
  if (select count(*) from public.abc_eventos
       where empresa_id='emp-g' and local_id='loc-g1'
         and operation_id='a10.order.send'
         and event_type='COMANDA_PREPARACION_GENERADA')<>2 then
    raise exception 'A10B_FAIL: auditoria envio/replay duplicada o incompleta';
  end if;

  if (select count(*) from public.abc_eventos
       where operation_id='a10.change.note'
         and event_type='COMANDA_CAMBIO_ENVIADO')<>1 then
    raise exception 'A10B_FAIL: cambio sin auditoria unica';
  end if;

  if (select count(*) from public.abc_eventos
       where operation_id='a10.cancel.prepared'
         and event_type='COMANDA_CANCELACION_GENERADA')<>1 then
    raise exception 'A10B_FAIL: cancelacion sin auditoria unica';
  end if;

  if (select count(*) from public.abc_eventos
       where operation_id='a10.merma.resolve'
         and event_type='COMANDA_MERMA_RESUELTA')<>1 then
    raise exception 'A10B_FAIL: merma sin auditoria unica';
  end if;

  if (select count(*) from public.abc_eventos
       where operation_id='a10.reprint.1'
         and event_type='COMANDA_REIMPRESION_SOLICITADA')<>1 then
    raise exception 'A10B_FAIL: reimpresion sin auditoria unica';
  end if;
end $$;

-- Las tres entregas iniciales (dos nuevas + un cambio) quedan auditadas.
do $$
begin
  if (select count(*) from public.abc_eventos
       where empresa_id='emp-g' and local_id='loc-g1'
         and event_type='COMANDA_ENTREGA_CONFIRMADA')<>3 then
    raise exception 'A10B_FAIL: confirmaciones de entrega incompletas';
  end if;

  if exists(
    select 1 from public.abc_eventos
     where empresa_id='emp-g' and local_id='loc-g1'
       and event_type like 'COMANDA_%'
       and (actor_user_id is null or operating_day is null)
  ) then
    raise exception 'A10B_FAIL: evento de comanda sin actor/dia operativo';
  end if;
end $$;

-- Probar actualización de estación + before/after.
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000031',false);
select set_config('app.test_empresa','emp-g',false);
select set_config('app.test_local','loc-g1',false);

select public.abc_actualizar_estacion_preparacion(
  'a10b.station.update','emp-g','loc-g1',
  '92000000-0000-0000-0000-000000000001',
  'Cocina Principal','COCINA',true,1,
  '20000000-0000-0000-0000-000000000020',
  '40000000-0000-0000-0000-000000000010',date '2026-09-26'
);

-- Replay exacto no duplica auditoría aunque la versión real ya haya avanzado.
select public.abc_actualizar_estacion_preparacion(
  'a10b.station.update','emp-g','loc-g1',
  '92000000-0000-0000-0000-000000000001',
  'Cocina Principal','COCINA',true,1,
  '20000000-0000-0000-0000-000000000020',
  '40000000-0000-0000-0000-000000000010',date '2026-09-26'
);

do $$
declare
  v_payload jsonb;
begin
  if (select count(*) from public.abc_eventos
       where operation_id='a10b.station.update'
         and event_type='ESTACION_PREPARACION_ACTUALIZADA')<>1 then
    raise exception 'A10B_FAIL: update/replay duplico auditoria';
  end if;

  select payload into v_payload
    from public.abc_eventos
   where operation_id='a10b.station.update'
     and event_type='ESTACION_PREPARACION_ACTUALIZADA';

  if v_payload->'before'->>'nombre' is distinct from 'Cocina'
     or v_payload->'after'->>'nombre' is distinct from 'Cocina Principal'
     or (v_payload->'before'->>'version')::bigint<>1
     or (v_payload->'after'->>'version')::bigint<>2 then
    raise exception 'A10B_FAIL: before/after de estacion incorrecto';
  end if;
end $$;

-- Replay de creación A10 preexistente tampoco duplica evento.
select public.abc_crear_estacion_preparacion(
  'a10.station.kitchen','emp-g','loc-g1',
  '92000000-0000-0000-0000-000000000001',
  'COCINA','Cocina','COCINA',
  '20000000-0000-0000-0000-000000000020',
  '40000000-0000-0000-0000-000000000010',date '2026-09-26'
);

do $$
begin
  if (select count(*) from public.abc_eventos
       where operation_id='a10.station.kitchen'
         and event_type='ESTACION_PREPARACION_CREADA')<>1 then
    raise exception 'A10B_FAIL: replay de alta duplico auditoria';
  end if;
end $$;

-- Confirmar otra vez una entrega ya completada: idempotencia sin nuevo evento.
create temporary table a10b_delivery_before as
select count(*)::bigint as n
  from public.abc_eventos
 where operation_id='a10.order.send'
   and event_type='COMANDA_ENTREGA_CONFIRMADA';

set role service_role;
select public.abc_confirmar_entrega_comanda(
  (
    select e.id
      from public.efectos_pendientes e
     where e.abc_command_id='a10.order.send'
       and e.tipo='KITCHEN_COMANDA'
       and e.estado='COMPLETADO'
     order by e.id
     limit 1
  ),
  'worker-a10'
);
reset role;

do $$
begin
  if (select n from a10b_delivery_before) is distinct from (
    select count(*)::bigint
      from public.abc_eventos
     where operation_id='a10.order.send'
       and event_type='COMANDA_ENTREGA_CONFIRMADA'
  ) then
    raise exception 'A10B_FAIL: replay entrega duplico auditoria';
  end if;
end $$;

-- A10B no altera los límites económicos/fiscales/stock.
do $$
declare
  v_stock_exists boolean:=false;
begin
  if exists(select 1 from public.pagos where empresa_id='emp-g')
     or exists(select 1 from public.pago_intentos where empresa_id='emp-g')
     or exists(select 1 from public.checkouts where empresa_id='emp-g')
     or exists(select 1 from public.ventas_fiscales where empresa_id='emp-g') then
    raise exception 'A10B_FAIL: efectos economicos/fiscales indebidos';
  end if;
  if to_regclass('public.movimientos_stock') is not null then
    execute 'select exists(select 1 from public.movimientos_stock where empresa_id=$1)'
      into v_stock_exists using 'emp-g';
    if v_stock_exists then
      raise exception 'A10B_FAIL: auditoria movio stock';
    end if;
  end if;
end $$;

select 'ABC_F3_A10B_CONTRACT=PASS' as resultado;
