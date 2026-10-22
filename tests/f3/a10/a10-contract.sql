\set ON_ERROR_STOP on

-- A10 — estaciones, comandas, cambios, cancelación, reimpresión y outbox cocina.

do $$
declare
  v_table text;
  v_sig text;
  v_oid oid;
  v_tables text[]:=array[
    'tpv_estaciones_preparacion','tpv_producto_estaciones',
    'comandas_preparacion','comanda_lineas'
  ];
  v_auth_rpcs text[]:=array[
    'public.abc_crear_estacion_preparacion(text,text,text,uuid,text,text,text,uuid,uuid,date)',
    'public.abc_actualizar_estacion_preparacion(text,text,text,uuid,text,text,boolean,bigint,uuid,uuid,date)',
    'public.abc_asignar_producto_estacion(text,text,text,text,uuid,smallint,uuid,uuid,date)',
    'public.abc_enviar_cambio_comanda(text,text,text,uuid,text,bigint,uuid,uuid,date)',
    'public.abc_reimprimir_comanda(text,text,text,uuid,uuid,uuid,date)',
    'public.abc_resolver_merma_comanda_linea(text,text,text,uuid,text,uuid,uuid,date)',
    'public.abc_listar_comandas_estacion(text,text,uuid,integer)'
  ];
begin
  foreach v_table in array v_tables loop
    if to_regclass('public.'||v_table) is null then
      raise exception 'A10_FAIL: tabla ausente %',v_table;
    end if;
    if not (select relrowsecurity from pg_class where oid=to_regclass('public.'||v_table)) then
      raise exception 'A10_FAIL: RLS ausente %',v_table;
    end if;
    if not has_table_privilege('authenticated','public.'||v_table,'SELECT')
       or has_table_privilege('authenticated','public.'||v_table,'INSERT')
       or has_table_privilege('authenticated','public.'||v_table,'UPDATE')
       or has_table_privilege('authenticated','public.'||v_table,'DELETE')
       or has_table_privilege('anon','public.'||v_table,'SELECT')
       or has_table_privilege('service_role','public.'||v_table,'SELECT') then
      raise exception 'A10_FAIL: ACL tabla incorrecta %',v_table;
    end if;
  end loop;

  foreach v_sig in array v_auth_rpcs loop
    v_oid:=to_regprocedure(v_sig);
    if v_oid is null then raise exception 'A10_FAIL: RPC ausente %',v_sig; end if;
    if not has_function_privilege('authenticated',v_oid,'EXECUTE')
       or has_function_privilege('anon',v_oid,'EXECUTE')
       or has_function_privilege('service_role',v_oid,'EXECUTE') then
      raise exception 'A10_FAIL: ACL RPC autenticada incorrecta %',v_sig;
    end if;
  end loop;

  if not has_function_privilege(
       'service_role',
       'public.abc_reclamar_efectos_cocina(text,integer,integer)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'service_role',
       'public.abc_confirmar_entrega_comanda(uuid,text)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'public.abc_reclamar_efectos_cocina(text,integer,integer)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'public.abc_confirmar_entrega_comanda(uuid,text)',
       'EXECUTE'
     ) then
    raise exception 'A10_FAIL: ACL worker cocina incorrecta';
  end if;

  if has_function_privilege('authenticated','private.abc_a10_encolar_comanda(uuid)','EXECUTE')
     or has_function_privilege('authenticated','private.abc_a10_procesar_transiciones_linea()','EXECUTE')
     or has_function_privilege('service_role','private.abc_a10_snapshot_linea(text,text,uuid)','EXECUTE') then
    raise exception 'A10_FAIL: helper privado expuesto';
  end if;

  if not exists(
    select 1 from pg_trigger
     where tgrelid='public.pedido_linea_transiciones'::regclass
       and tgname='a10_pedido_linea_transiciones_comandas'
       and not tgisinternal
  ) then
    raise exception 'A10_FAIL: trigger transiciones/comandas ausente';
  end if;
end $$;

-- Tenant e identidades ficticias A10.
insert into auth.users(id) values
('00000000-0000-0000-0000-000000000031'),
('00000000-0000-0000-0000-000000000032'),
('00000000-0000-0000-0000-000000000033');

insert into public.empresas(id,nombre,activo)
values ('emp-g','Empresa G ficticia',true);

insert into public.locales(id,empresa_id,nombre,activo)
values
('loc-g1','emp-g','Local G1',true),
('loc-g2','emp-g','Local G2',true);

select set_config('app.test_empresa','emp-g',false);
select set_config('app.test_local','loc-g1',false);
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000031',false);

insert into public.membresias_usuario(user_id,empresa_id,local_id,todos_locales,rol,activo)
values
('00000000-0000-0000-0000-000000000031','emp-g','loc-g1',false,'Propietario',true),
('00000000-0000-0000-0000-000000000032','emp-g','loc-g1',false,'Churrero/a',true),
('00000000-0000-0000-0000-000000000033','emp-g','loc-g2',false,'Encargado',true);

insert into public.entidades_fiscales(
  id,empresa_id,nombre_legal,identificador_fiscal,country_code,simulada,activa
) values (
  '10000000-0000-0000-0000-000000000010','emp-g','Entidad G ficticia','SIM-G','ES',true,true
);

insert into public.entidad_fiscal_monedas(
  empresa_id,entidad_fiscal_id,currency_code,es_principal,activa
) values (
  'emp-g','10000000-0000-0000-0000-000000000010','EUR',true,true
);

insert into public.entidad_fiscal_locales(
  empresa_id,local_id,entidad_fiscal_id,activa
) values (
  'emp-g','loc-g1','10000000-0000-0000-0000-000000000010',true
);

insert into public.entidad_fiscal_local_monedas(
  empresa_id,local_id,entidad_fiscal_id,currency_code,activa
) values (
  'emp-g','loc-g1','10000000-0000-0000-0000-000000000010','EUR',true
);

insert into public.terminales_tpv(id,empresa_id,local_id,nombre,activo)
values
('20000000-0000-0000-0000-000000000020','emp-g','loc-g1','Terminal G1',true),
('20000000-0000-0000-0000-000000000021','emp-g','loc-g1','Terminal G2',true);

insert into public.cajas_fisicas(id,empresa_id,local_id,nombre,activo)
values ('30000000-0000-0000-0000-000000000010','emp-g','loc-g1','Caja G',true);

insert into public.caja_sesiones(
  id,empresa_id,local_id,caja_id,estado,version,abierta_at,abierta_por
) values (
  '40000000-0000-0000-0000-000000000010','emp-g','loc-g1',
  '30000000-0000-0000-0000-000000000010','ABIERTA',1,now(),
  '00000000-0000-0000-0000-000000000031'
);

insert into public.caja_sesion_terminales(
  empresa_id,local_id,session_id,terminal_id,desde
) values
('emp-g','loc-g1','40000000-0000-0000-0000-000000000010','20000000-0000-0000-0000-000000000020',now()),
('emp-g','loc-g1','40000000-0000-0000-0000-000000000010','20000000-0000-0000-0000-000000000021',now());

insert into public.caja_sesion_responsables(
  empresa_id,local_id,session_id,user_id,desde,asignado_por,motivo
) values (
  'emp-g','loc-g1','40000000-0000-0000-0000-000000000010',
  '00000000-0000-0000-0000-000000000031',now(),
  '00000000-0000-0000-0000-000000000031','TEST_A10'
);

insert into public.catalogo_tpv_productos(
  empresa_id,local_id,producto_id,currency_code,entidad_fiscal_id,nombre,unidad,
  fraccionable,precision_cantidad,precio_unitario,impuesto_pct,activo,version,snapshot_origen
) values
(
  'emp-g','loc-g1','prod-cafe-g','EUR','10000000-0000-0000-0000-000000000010',
  'Café G','ud',false,0,2,10,true,1,'{}'::jsonb
),
(
  'emp-g','loc-g1','prod-churro-g','EUR','10000000-0000-0000-0000-000000000010',
  'Churro G','ud',false,0,1,10,true,1,'{}'::jsonb
),
(
  'emp-g','loc-g1','prod-sin-ruta-g','EUR','10000000-0000-0000-0000-000000000010',
  'Sin ruta G','ud',false,0,3,10,true,1,'{}'::jsonb
);

-- Configurar Cocina y Churrería.
select public.abc_crear_estacion_preparacion(
  'a10.station.kitchen','emp-g','loc-g1',
  '92000000-0000-0000-0000-000000000001',
  'COCINA','Cocina','COCINA',
  '20000000-0000-0000-0000-000000000020',
  '40000000-0000-0000-0000-000000000010',date '2026-09-26'
);

select public.abc_crear_estacion_preparacion(
  'a10.station.churro','emp-g','loc-g1',
  '92000000-0000-0000-0000-000000000002',
  'CHURRERIA','Churrería','CHURRERIA',
  '20000000-0000-0000-0000-000000000020',
  '40000000-0000-0000-0000-000000000010',date '2026-09-26'
);

select public.abc_asignar_producto_estacion(
  'a10.route.cafe','emp-g','loc-g1','prod-cafe-g',
  '92000000-0000-0000-0000-000000000001',1::smallint,
  '20000000-0000-0000-0000-000000000020',
  '40000000-0000-0000-0000-000000000010',date '2026-09-26'
);

select public.abc_asignar_producto_estacion(
  'a10.route.churro','emp-g','loc-g1','prod-churro-g',
  '92000000-0000-0000-0000-000000000002',1::smallint,
  '20000000-0000-0000-0000-000000000020',
  '40000000-0000-0000-0000-000000000010',date '2026-09-26'
);

-- Cuenta/pedido con dos estaciones.
select public.abc_abrir_cuenta(
  'a10.account.open','emp-g','loc-g1',
  '50000000-0000-0000-0000-000000000020','BARRA','EUR',
  '00000000-0000-0000-0000-000000000031',
  '20000000-0000-0000-0000-000000000020',
  '40000000-0000-0000-0000-000000000010',date '2026-09-26'
);

select public.abc_crear_pedido(
  'a10.order.open','emp-g','loc-g1',
  '60000000-0000-0000-0000-000000000020',
  '50000000-0000-0000-0000-000000000020',1,
  '20000000-0000-0000-0000-000000000020',
  '40000000-0000-0000-0000-000000000010',date '2026-09-26'
);

select public.abc_agregar_linea_pedido(
  'a10.line.cafe','emp-g','loc-g1',
  '70000000-0000-0000-0000-000000000020',
  '60000000-0000-0000-0000-000000000020','prod-cafe-g',1,1,
  '20000000-0000-0000-0000-000000000020',
  '40000000-0000-0000-0000-000000000010',date '2026-09-26'
);
select public.abc_confirmar_linea_pedido(
  'a10.line.cafe.confirm','emp-g','loc-g1',
  '70000000-0000-0000-0000-000000000020',1,2,
  '20000000-0000-0000-0000-000000000020',
  '40000000-0000-0000-0000-000000000010',date '2026-09-26'
);

select public.abc_agregar_linea_pedido(
  'a10.line.churro','emp-g','loc-g1',
  '70000000-0000-0000-0000-000000000021',
  '60000000-0000-0000-0000-000000000020','prod-churro-g',2,3,
  '20000000-0000-0000-0000-000000000020',
  '40000000-0000-0000-0000-000000000010',date '2026-09-26'
);
select public.abc_confirmar_linea_pedido(
  'a10.line.churro.confirm','emp-g','loc-g1',
  '70000000-0000-0000-0000-000000000021',1,4,
  '20000000-0000-0000-0000-000000000020',
  '40000000-0000-0000-0000-000000000010',date '2026-09-26'
);

select public.abc_enviar_pedido(
  'a10.order.send','emp-g','loc-g1',
  '60000000-0000-0000-0000-000000000020',5,
  '20000000-0000-0000-0000-000000000020',
  '40000000-0000-0000-0000-000000000010',date '2026-09-26'
);

-- Replay exacto no duplica comandas ni efectos.
select public.abc_enviar_pedido(
  'a10.order.send','emp-g','loc-g1',
  '60000000-0000-0000-0000-000000000020',5,
  '20000000-0000-0000-0000-000000000020',
  '40000000-0000-0000-0000-000000000010',date '2026-09-26'
);

do $$
begin
  if (select count(*) from public.comandas_preparacion
      where empresa_id='emp-g' and operation_id='a10.order.send' and tipo='NUEVA')<>2 then
    raise exception 'A10_FAIL: envio no genero una comanda por estacion';
  end if;
  if (select count(*) from public.comanda_lineas cl
      join public.comandas_preparacion c on c.id=cl.comanda_id
      where c.operation_id='a10.order.send' and cl.accion='ALTA')<>2 then
    raise exception 'A10_FAIL: lineas de comanda incorrectas';
  end if;
  if (select count(*) from public.efectos_pendientes
      where abc_command_id='a10.order.send' and tipo='KITCHEN_COMANDA')<>2 then
    raise exception 'A10_FAIL: outbox cocina incorrecto/replay duplicado';
  end if;
end $$;

-- Cambio operativo/notas no modifica importe ni cantidad comercial.
select public.abc_enviar_cambio_comanda(
  'a10.change.note','emp-g','loc-g1',
  '70000000-0000-0000-0000-000000000021',
  'Sin azúcar; cambio operativo ficticio',3,
  '20000000-0000-0000-0000-000000000020',
  '40000000-0000-0000-0000-000000000010',date '2026-09-26'
);

do $$
begin
  if (select cantidad from public.pedido_lineas
      where id='70000000-0000-0000-0000-000000000021')<>2 then
    raise exception 'A10_FAIL: cambio operativo altero cantidad comercial';
  end if;
  if not exists(
    select 1 from public.efectos_pendientes
     where abc_command_id='a10.change.note' and tipo='KITCHEN_COMANDA_CAMBIO'
  ) then raise exception 'A10_FAIL: cambio no fue encolado'; end if;
end $$;

-- Worker cocina: claim dedicado y confirmación de entrega.
set role service_role;
create temporary table a10_claimed as
select id,tipo,payload from public.abc_reclamar_efectos_cocina('worker-a10',10,60);

do $$
begin
  if (select count(*) from a10_claimed)<3 then
    raise exception 'A10_FAIL: worker no reclamo efectos cocina';
  end if;
end $$;

select public.abc_confirmar_entrega_comanda(id,'worker-a10')
from a10_claimed;
reset role;

do $$
begin
  if exists(
    select 1 from public.comandas_preparacion
     where empresa_id='emp-g' and estado='PENDIENTE'
       and id in (
         select (payload->>'comanda_id')::uuid from a10_claimed
         where tipo<>'KITCHEN_COMANDA_REIMPRESION'
       )
  ) then raise exception 'A10_FAIL: entrega no marco comanda recibida'; end if;
end $$;

-- Preparar una línea y cancelarla: decisión de merma obligatoriamente queda pendiente.
select public.abc_iniciar_preparacion_linea(
  'a10.prepare.start','emp-g','loc-g1',
  '70000000-0000-0000-0000-000000000020',3,6,
  '20000000-0000-0000-0000-000000000020',
  '40000000-0000-0000-0000-000000000010',date '2026-09-26'
);
select public.abc_marcar_linea_preparada(
  'a10.prepare.ready','emp-g','loc-g1',
  '70000000-0000-0000-0000-000000000020',4,7,
  '20000000-0000-0000-0000-000000000020',
  '40000000-0000-0000-0000-000000000010',date '2026-09-26'
);
select public.abc_cancelar_linea(
  'a10.cancel.prepared','emp-g','loc-g1',
  '70000000-0000-0000-0000-000000000020',
  'Cancelación preparada ficticia',5,8,
  '20000000-0000-0000-0000-000000000020',
  '40000000-0000-0000-0000-000000000010',date '2026-09-26'
);

do $$
declare v_stock_exists boolean:=false;
begin
  if not exists(
    select 1 from public.comanda_lineas cl
    join public.comandas_preparacion c on c.id=cl.comanda_id
    where c.operation_id='a10.cancel.prepared'
      and c.tipo='CANCELACION'
      and cl.linea_id='70000000-0000-0000-0000-000000000020'
      and cl.decision_merma='PENDIENTE'
  ) then raise exception 'A10_FAIL: cancelacion preparada sin decision merma pendiente'; end if;
  if to_regclass('public.movimientos_stock') is not null then
    execute 'select exists(select 1 from public.movimientos_stock where operation_id=$1)'
      into v_stock_exists using 'a10.cancel.prepared';
    if v_stock_exists then
      raise exception 'A10_FAIL: A10 repuso/movio stock automaticamente';
    end if;
  end if;
end $$;

select public.abc_resolver_merma_comanda_linea(
  'a10.merma.resolve','emp-g','loc-g1',
  (
    select cl.id from public.comanda_lineas cl
    join public.comandas_preparacion c on c.id=cl.comanda_id
    where c.operation_id='a10.cancel.prepared'
      and cl.linea_id='70000000-0000-0000-0000-000000000020'
    limit 1
  ),
  'MERMA_CONFIRMADA',
  '20000000-0000-0000-0000-000000000020',
  '40000000-0000-0000-0000-000000000010',date '2026-09-26'
);

do $$
declare v_stock_exists boolean:=false;
begin
  if to_regclass('public.movimientos_stock') is not null then
    execute 'select exists(select 1 from public.movimientos_stock where operation_id=$1)'
      into v_stock_exists using 'a10.merma.resolve';
    if v_stock_exists then
      raise exception 'A10_FAIL: decision merma mutó stock';
    end if;
  end if;
end $$;

-- Reimpresión: mismo documento/comanda, solo nuevo efecto.
select public.abc_reimprimir_comanda(
  'a10.reprint.1','emp-g','loc-g1',
  (
    select id from public.comandas_preparacion
     where operation_id='a10.order.send'
       and estacion_id='92000000-0000-0000-0000-000000000002'
     limit 1
  ),
  '20000000-0000-0000-0000-000000000020',
  '40000000-0000-0000-0000-000000000010',date '2026-09-26'
);

do $$
begin
  if (select count(*) from public.comandas_preparacion
      where operation_id='a10.order.send')<>2 then
    raise exception 'A10_FAIL: reimpresion creo nueva comanda';
  end if;
  if not exists(
    select 1 from public.efectos_pendientes
     where abc_command_id='a10.reprint.1' and tipo='KITCHEN_COMANDA_REIMPRESION'
  ) then raise exception 'A10_FAIL: reimpresion no encolada'; end if;
end $$;

-- Producto sin ruta: no se pierde; queda comanda bloqueada y no se imprime.
select public.abc_abrir_cuenta(
  'a10.unrouted.account','emp-g','loc-g1',
  '50000000-0000-0000-0000-000000000021','TAKEAWAY','EUR',
  '00000000-0000-0000-0000-000000000031',
  '20000000-0000-0000-0000-000000000020',
  '40000000-0000-0000-0000-000000000010',date '2026-09-26'
);
select public.abc_crear_pedido(
  'a10.unrouted.order','emp-g','loc-g1',
  '60000000-0000-0000-0000-000000000021',
  '50000000-0000-0000-0000-000000000021',1,
  '20000000-0000-0000-0000-000000000020',
  '40000000-0000-0000-0000-000000000010',date '2026-09-26'
);
select public.abc_agregar_linea_pedido(
  'a10.unrouted.line','emp-g','loc-g1',
  '70000000-0000-0000-0000-000000000022',
  '60000000-0000-0000-0000-000000000021','prod-sin-ruta-g',1,1,
  '20000000-0000-0000-0000-000000000020',
  '40000000-0000-0000-0000-000000000010',date '2026-09-26'
);
select public.abc_confirmar_linea_pedido(
  'a10.unrouted.confirm','emp-g','loc-g1',
  '70000000-0000-0000-0000-000000000022',1,2,
  '20000000-0000-0000-0000-000000000020',
  '40000000-0000-0000-0000-000000000010',date '2026-09-26'
);
select public.abc_enviar_pedido(
  'a10.unrouted.send','emp-g','loc-g1',
  '60000000-0000-0000-0000-000000000021',3,
  '20000000-0000-0000-0000-000000000020',
  '40000000-0000-0000-0000-000000000010',date '2026-09-26'
);

do $$
begin
  if not exists(
    select 1 from public.comandas_preparacion
     where operation_id='a10.unrouted.send' and estado='BLOQUEADA' and estacion_id is null
  ) then raise exception 'A10_FAIL: producto sin ruta no quedo bloqueado'; end if;
  if exists(
    select 1 from public.efectos_pendientes
     where abc_command_id='a10.unrouted.send' and tipo like 'KITCHEN%'
  ) then raise exception 'A10_FAIL: producto sin ruta fue enviado'; end if;
end $$;

-- Aislamiento cross-local y fail-closed sin membresía del local.
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000033',false);

do $$
begin
  if private.abc_a10_tiene_capacidad('emp-g','loc-g1','ABC_COMANDA_VER') is distinct from false then
    raise exception 'A10_FAIL: capacidad cross-local no cerro en false';
  end if;
  if private.abc_a10_tiene_capacidad('emp-g','loc-g1','ABC_COMANDA_CONFIGURAR') is distinct from false then
    raise exception 'A10_FAIL: configuracion cross-local no cerro en false';
  end if;
end $$;

do $$
begin
  begin
    perform public.abc_listar_comandas_estacion(
      'emp-g','loc-g1','92000000-0000-0000-0000-000000000001',100
    );
    raise exception 'A10_FAIL: cross-local autorizado';
  exception when others then
    if sqlerrm not like '%comanda_ver_no_autorizado%' then raise; end if;
  end;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000031',false);

-- A10 no muta pagos/checkouts/fiscalidad ni stock.
do $$
declare v_stock_exists boolean:=false;
begin
  if exists(select 1 from public.pagos where empresa_id='emp-g')
     or exists(select 1 from public.pago_intentos where empresa_id='emp-g')
     or exists(select 1 from public.checkouts where empresa_id='emp-g')
     or exists(select 1 from public.ventas_fiscales where empresa_id='emp-g') then
    raise exception 'A10_FAIL: efectos economicos/fiscales indebidos';
  end if;
  if to_regclass('public.movimientos_stock') is not null then
    execute 'select exists(select 1 from public.movimientos_stock where empresa_id=$1)'
      into v_stock_exists using 'emp-g';
    if v_stock_exists then
      raise exception 'A10_FAIL: A10 movio stock';
    end if;
  end if;
end $$;

select 'ABC_F3_A10_CONTRACT=PASS' as resultado;
