\set ON_ERROR_STOP on

-- A05 — estructura, ACL, capacidades y máquina de estados.
do $$
declare
  v_table text;
  v_sig text;
  v_oid oid;
  v_constraint text;
  v_capdef text;
  v_tables text[]:=array['pedido_transiciones','pedido_linea_transiciones'];
  v_rpcs text[]:=array[
    'public.abc_enviar_pedido(text,text,text,uuid,bigint,uuid,uuid,date)',
    'public.abc_iniciar_preparacion_linea(text,text,text,uuid,bigint,bigint,uuid,uuid,date)',
    'public.abc_marcar_linea_preparada(text,text,text,uuid,bigint,bigint,uuid,uuid,date)',
    'public.abc_servir_linea(text,text,text,uuid,bigint,bigint,uuid,uuid,date)',
    'public.abc_cancelar_linea(text,text,text,uuid,text,bigint,bigint,uuid,uuid,date)',
    'public.abc_cancelar_pedido(text,text,text,uuid,text,bigint,uuid,uuid,date)',
    'public.abc_cerrar_pedido_operativo(text,text,text,uuid,bigint,uuid,uuid,date)',
    'public.abc_estado_cobro_cuenta(text,text,uuid)'
  ];
begin
  foreach v_table in array v_tables loop
    if to_regclass('public.'||v_table) is null then
      raise exception 'A05_FAIL: tabla ausente %',v_table;
    end if;
    if not exists(
      select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
       where n.nspname='public' and c.relname=v_table and c.relrowsecurity
    ) then
      raise exception 'A05_FAIL: RLS no habilitado %',v_table;
    end if;
    if not has_table_privilege('authenticated','public.'||v_table,'SELECT')
       or has_table_privilege('authenticated','public.'||v_table,'INSERT')
       or has_table_privilege('authenticated','public.'||v_table,'UPDATE')
       or has_table_privilege('authenticated','public.'||v_table,'DELETE')
       or has_table_privilege('anon','public.'||v_table,'SELECT')
       or has_table_privilege('service_role','public.'||v_table,'SELECT') then
      raise exception 'A05_FAIL: ACL incorrecta %',v_table;
    end if;
  end loop;

  foreach v_sig in array v_rpcs loop
    v_oid:=to_regprocedure(v_sig);
    if v_oid is null then raise exception 'A05_FAIL: RPC ausente %',v_sig; end if;
    if not exists(
      select 1 from pg_proc
       where oid=v_oid and prosecdef and pg_get_userbyid(proowner)='postgres'
    ) then
      raise exception 'A05_FAIL: RPC no SECURITY DEFINER postgres %',v_sig;
    end if;
    if not has_function_privilege('authenticated',v_oid,'EXECUTE')
       or has_function_privilege('anon',v_oid,'EXECUTE')
       or has_function_privilege('service_role',v_oid,'EXECUTE') then
      raise exception 'A05_FAIL: ACL RPC incorrecta %',v_sig;
    end if;
  end loop;

  if has_function_privilege('authenticated','private.abc_estado_agregado_pedido(text,text,uuid)','EXECUTE')
     or has_function_privilege('authenticated','private.abc_actualizar_estado_pedido_desde_lineas(text,text,uuid,text,uuid,uuid,uuid,date)','EXECUTE')
     or has_function_privilege('authenticated','private.abc_transicionar_linea_operativa(text,text,text,text,uuid,bigint,bigint,uuid,uuid,date)','EXECUTE')
     or has_function_privilege('anon','private.abc_transicionar_linea_operativa(text,text,text,text,uuid,bigint,bigint,uuid,uuid,date)','EXECUTE')
     or has_function_privilege('service_role','private.abc_transicionar_linea_operativa(text,text,text,text,uuid,bigint,bigint,uuid,uuid,date)','EXECUTE') then
    raise exception 'A05_FAIL: helper privado expuesto';
  end if;

  select pg_get_constraintdef(oid,true)
    into v_constraint
    from pg_constraint
   where conrelid='public.pedidos_tpv'::regclass and conname='abc_pedido_estado';

  if v_constraint is null
     or v_constraint not like '%EN_PREPARACION%'
     or v_constraint not like '%PARCIALMENTE_PREPARADO%'
     or v_constraint not like '%PREPARADO%'
     or v_constraint not like '%SERVIDO%'
     or v_constraint not like '%CERRADO%'
     or v_constraint not like '%CANCELADO%' then
    raise exception 'A05_FAIL: constraint estados pedido incompleta';
  end if;

  v_capdef:=pg_get_functiondef(to_regprocedure('private.abc_tiene_capacidad(text,text,text)'));
  if v_capdef not like '%ABC_CUENTA_OPERAR%'
     or v_capdef not like '%ABC_COBRO_INICIAR%'
     or v_capdef not like '%ABC_CAJA_OPERAR%'
     or v_capdef not like '%ABC_PEDIDO_ENVIAR%'
     or v_capdef not like '%ABC_PREPARACION_INICIAR%'
     or v_capdef not like '%ABC_PREPARACION_COMPLETAR%'
     or v_capdef not like '%ABC_PEDIDO_SERVIR%'
     or v_capdef not like '%ABC_LINEA_CANCELAR%'
     or v_capdef not like '%ABC_CANCELACION_SENSIBLE%'
     or v_capdef not like '%ABC_PEDIDO_CANCELAR%'
     or v_capdef not like '%ABC_PEDIDO_CERRAR%' then
    raise exception 'A05_FAIL: capacidades existentes/nuevas incompletas';
  end if;

  if pg_get_functiondef(to_regprocedure('public.abc_estado_cobro_cuenta(text,text,uuid)'))
       not like '%PARCIALMENTE_PAGADO%'
     or pg_get_functiondef(to_regprocedure('public.abc_estado_cobro_cuenta(text,text,uuid)'))
       not like '%pago_aplicaciones%'
     or pg_get_functiondef(to_regprocedure('public.abc_estado_cobro_cuenta(text,text,uuid)'))
       not like '%CONFIRMADO%' then
    raise exception 'A05_FAIL: derivacion de estado de cobro incompleta';
  end if;
end $$;

-- Datos ficticios.
insert into auth.users(id) values
('00000000-0000-0000-0000-000000000005'),
('00000000-0000-0000-0000-000000000006'),
('00000000-0000-0000-0000-000000000007');

insert into public.empresas(id,nombre,activo)
values ('emp-c','Empresa C ficticia',true);

insert into public.locales(id,empresa_id,nombre,activo)
values ('loc-c1','emp-c','Local C1',true);

select set_config('app.test_empresa','emp-c',false);
select set_config('app.test_local','loc-c1',false);
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000005',false);

insert into public.membresias_usuario(user_id,empresa_id,local_id,todos_locales,rol,activo)
values
('00000000-0000-0000-0000-000000000005','emp-c','loc-c1',false,'Propietario',true),
('00000000-0000-0000-0000-000000000006','emp-c','loc-c1',false,'Camarero/a',true),
('00000000-0000-0000-0000-000000000007','emp-c','loc-c1',false,'Churrero/a',true);

insert into public.entidades_fiscales(
  id,empresa_id,nombre_legal,identificador_fiscal,country_code,simulada,activa
) values (
  '10000000-0000-0000-0000-000000000003','emp-c','Entidad C ficticia','SIM-C','ES',true,true
);

insert into public.entidad_fiscal_monedas(
  empresa_id,entidad_fiscal_id,currency_code,es_principal,activa
) values (
  'emp-c','10000000-0000-0000-0000-000000000003','EUR',true,true
);

insert into public.entidad_fiscal_locales(
  empresa_id,local_id,entidad_fiscal_id,activa
) values (
  'emp-c','loc-c1','10000000-0000-0000-0000-000000000003',true
);

insert into public.entidad_fiscal_local_monedas(
  empresa_id,local_id,entidad_fiscal_id,currency_code,activa
) values (
  'emp-c','loc-c1','10000000-0000-0000-0000-000000000003','EUR',true
);

insert into public.terminales_tpv(id,empresa_id,local_id,nombre,activo)
values
('20000000-0000-0000-0000-000000000005','emp-c','loc-c1','Terminal C1',true),
('20000000-0000-0000-0000-000000000006','emp-c','loc-c1','Terminal C2',true);

insert into public.cajas_fisicas(id,empresa_id,local_id,nombre,activo)
values ('30000000-0000-0000-0000-000000000003','emp-c','loc-c1','Caja C',true);

insert into public.caja_sesiones(
  id,empresa_id,local_id,caja_id,estado,version,abierta_at,abierta_por
) values (
  '40000000-0000-0000-0000-000000000003','emp-c','loc-c1',
  '30000000-0000-0000-0000-000000000003','ABIERTA',1,now(),
  '00000000-0000-0000-0000-000000000005'
);

insert into public.caja_sesion_terminales(
  empresa_id,local_id,session_id,terminal_id,desde
) values
('emp-c','loc-c1','40000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000005',now()),
('emp-c','loc-c1','40000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000006',now());

insert into public.caja_sesion_responsables(
  empresa_id,local_id,session_id,user_id,desde,asignado_por,motivo
) values (
  'emp-c','loc-c1','40000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000005',now(),
  '00000000-0000-0000-0000-000000000005','TEST_A05'
);

insert into public.catalogo_tpv_productos(
  empresa_id,local_id,producto_id,currency_code,entidad_fiscal_id,nombre,unidad,
  fraccionable,precision_cantidad,precio_unitario,impuesto_pct,activo,version,snapshot_origen
) values
(
  'emp-c','loc-c1','prod-cafe','EUR',
  '10000000-0000-0000-0000-000000000003',
  'Café ficticio','ud',false,0,2,10,true,1,'{"origen":"fixture-a05"}'
),
(
  'emp-c','loc-c1','prod-churro','EUR',
  '10000000-0000-0000-0000-000000000003',
  'Churro ficticio','ud',false,0,1,10,true,1,'{"origen":"fixture-a05"}'
);

-- Flujo principal de dos líneas.
select public.abc_abrir_cuenta(
  'a05.setup.open','emp-c','loc-c1',
  '50000000-0000-0000-0000-000000000003',
  'BARRA','EUR',
  '00000000-0000-0000-0000-000000000005',
  '20000000-0000-0000-0000-000000000005',
  '40000000-0000-0000-0000-000000000003',
  date '2026-09-23'
);

select public.abc_crear_pedido(
  'a05.setup.order1','emp-c','loc-c1',
  '60000000-0000-0000-0000-000000000003',
  '50000000-0000-0000-0000-000000000003',
  1,
  '20000000-0000-0000-0000-000000000005',
  '40000000-0000-0000-0000-000000000003',
  date '2026-09-23'
);

select public.abc_agregar_linea_pedido(
  'a05.setup.add1','emp-c','loc-c1',
  '70000000-0000-0000-0000-000000000003',
  '60000000-0000-0000-0000-000000000003',
  'prod-cafe',1,1,
  '20000000-0000-0000-0000-000000000005',
  '40000000-0000-0000-0000-000000000003',
  date '2026-09-23'
);

select public.abc_confirmar_linea_pedido(
  'a05.setup.confirm1','emp-c','loc-c1',
  '70000000-0000-0000-0000-000000000003',
  1,2,
  '20000000-0000-0000-0000-000000000005',
  '40000000-0000-0000-0000-000000000003',
  date '2026-09-23'
);

select public.abc_agregar_linea_pedido(
  'a05.setup.add2','emp-c','loc-c1',
  '70000000-0000-0000-0000-000000000004',
  '60000000-0000-0000-0000-000000000003',
  'prod-churro',2,3,
  '20000000-0000-0000-0000-000000000005',
  '40000000-0000-0000-0000-000000000003',
  date '2026-09-23'
);

select public.abc_confirmar_linea_pedido(
  'a05.setup.confirm2','emp-c','loc-c1',
  '70000000-0000-0000-0000-000000000004',
  1,4,
  '20000000-0000-0000-0000-000000000005',
  '40000000-0000-0000-0000-000000000003',
  date '2026-09-23'
);

select public.abc_enviar_pedido(
  'a05.flow.send','emp-c','loc-c1',
  '60000000-0000-0000-0000-000000000003',
  5,
  '20000000-0000-0000-0000-000000000005',
  '40000000-0000-0000-0000-000000000003',
  date '2026-09-23'
);

-- Replay exacto de envío.
select public.abc_enviar_pedido(
  'a05.flow.send','emp-c','loc-c1',
  '60000000-0000-0000-0000-000000000003',
  5,
  '20000000-0000-0000-0000-000000000005',
  '40000000-0000-0000-0000-000000000003',
  date '2026-09-23'
);

do $$
begin
  if (select estado from public.pedidos_tpv where id='60000000-0000-0000-0000-000000000003')<>'ENVIADO' then
    raise exception 'A05_FAIL: pedido no ENVIADO';
  end if;
  if (select version from public.pedidos_tpv where id='60000000-0000-0000-0000-000000000003')<>6 then
    raise exception 'A05_FAIL: replay altero version pedido';
  end if;
  if (select count(*) from public.pedido_linea_transiciones where operation_id='a05.flow.send')<>2 then
    raise exception 'A05_FAIL: replay duplico transiciones de linea';
  end if;
  if (select count(*) from public.pedido_transiciones where operation_id='a05.flow.send')<>1 then
    raise exception 'A05_FAIL: replay duplico transicion pedido';
  end if;
end $$;

-- No se puede saltar EN_PREPARACION.
do $$
begin
  begin
    perform public.abc_marcar_linea_preparada(
      'a05.invalid.skip','emp-c','loc-c1',
      '70000000-0000-0000-0000-000000000004',
      3,6,
      '20000000-0000-0000-0000-000000000005',
      '40000000-0000-0000-0000-000000000003',
      date '2026-09-23'
    );
    raise exception 'A05_FAIL: transicion ilegal aceptada';
  exception when others then
    if sqlerrm not like '%transicion_linea_invalida%' then raise; end if;
  end;
end $$;

-- Churrero inicia/prepara.
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000007',false);

select public.abc_iniciar_preparacion_linea(
  'a05.flow.start1','emp-c','loc-c1',
  '70000000-0000-0000-0000-000000000003',
  3,6,
  '20000000-0000-0000-0000-000000000005',
  '40000000-0000-0000-0000-000000000003',
  date '2026-09-23'
);

do $$
begin
  if (select estado from public.pedidos_tpv where id='60000000-0000-0000-0000-000000000003')<>'EN_PREPARACION' then
    raise exception 'A05_FAIL: agregado no EN_PREPARACION';
  end if;
end $$;

-- Segundo terminal con version de pedido vieja.
do $$
begin
  begin
    perform public.abc_iniciar_preparacion_linea(
      'a05.invalid.stale','emp-c','loc-c1',
      '70000000-0000-0000-0000-000000000004',
      3,6,
      '20000000-0000-0000-0000-000000000006',
      '40000000-0000-0000-0000-000000000003',
      date '2026-09-23'
    );
    raise exception 'A05_FAIL: version stale aceptada';
  exception when others then
    if sqlerrm not like '%pedido_version_conflict%' then raise; end if;
  end;
end $$;

select public.abc_marcar_linea_preparada(
  'a05.flow.ready1','emp-c','loc-c1',
  '70000000-0000-0000-0000-000000000003',
  4,7,
  '20000000-0000-0000-0000-000000000005',
  '40000000-0000-0000-0000-000000000003',
  date '2026-09-23'
);

do $$
begin
  if (select estado from public.pedidos_tpv where id='60000000-0000-0000-0000-000000000003')<>'PARCIALMENTE_PREPARADO' then
    raise exception 'A05_FAIL: agregado no PARCIALMENTE_PREPARADO';
  end if;
end $$;

select public.abc_iniciar_preparacion_linea(
  'a05.flow.start2','emp-c','loc-c1',
  '70000000-0000-0000-0000-000000000004',
  3,8,
  '20000000-0000-0000-0000-000000000006',
  '40000000-0000-0000-0000-000000000003',
  date '2026-09-23'
);

select public.abc_marcar_linea_preparada(
  'a05.flow.ready2','emp-c','loc-c1',
  '70000000-0000-0000-0000-000000000004',
  4,9,
  '20000000-0000-0000-0000-000000000006',
  '40000000-0000-0000-0000-000000000003',
  date '2026-09-23'
);

do $$
begin
  if (select estado from public.pedidos_tpv where id='60000000-0000-0000-0000-000000000003')<>'PREPARADO' then
    raise exception 'A05_FAIL: agregado no PREPARADO';
  end if;
end $$;

-- Camarero sirve.
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000006',false);

select public.abc_servir_linea(
  'a05.flow.serve1','emp-c','loc-c1',
  '70000000-0000-0000-0000-000000000003',
  5,10,
  '20000000-0000-0000-0000-000000000005',
  '40000000-0000-0000-0000-000000000003',
  date '2026-09-23'
);

select public.abc_servir_linea(
  'a05.flow.serve2','emp-c','loc-c1',
  '70000000-0000-0000-0000-000000000004',
  5,11,
  '20000000-0000-0000-0000-000000000006',
  '40000000-0000-0000-0000-000000000003',
  date '2026-09-23'
);

do $$
begin
  if (select estado from public.pedidos_tpv where id='60000000-0000-0000-0000-000000000003')<>'SERVIDO' then
    raise exception 'A05_FAIL: agregado no SERVIDO';
  end if;
  if (select count(*) from public.pedido_lineas where pedido_id='60000000-0000-0000-0000-000000000003' and estado='SERVIDA')<>2 then
    raise exception 'A05_FAIL: lineas no SERVIDAS';
  end if;
end $$;

-- Cierre solo Propietario/Encargado/Cajero.
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000005',false);

select public.abc_cerrar_pedido_operativo(
  'a05.flow.close','emp-c','loc-c1',
  '60000000-0000-0000-0000-000000000003',
  12,
  '20000000-0000-0000-0000-000000000005',
  '40000000-0000-0000-0000-000000000003',
  date '2026-09-23'
);

do $$
declare
  v_estado_cobro jsonb;
begin
  if (select estado from public.pedidos_tpv where id='60000000-0000-0000-0000-000000000003')<>'CERRADO' then
    raise exception 'A05_FAIL: pedido no CERRADO';
  end if;
  if (select version from public.pedidos_tpv where id='60000000-0000-0000-0000-000000000003')<>13 then
    raise exception 'A05_FAIL: version final pedido principal';
  end if;
  if (select closed_at from public.pedidos_tpv where id='60000000-0000-0000-0000-000000000003') is null then
    raise exception 'A05_FAIL: cierre sin timestamp';
  end if;

  if (select count(*) from public.pedido_transiciones where pedido_id='60000000-0000-0000-0000-000000000003')<>6 then
    raise exception 'A05_FAIL: historial pedido principal != 6';
  end if;
  if (select count(*) from public.pedido_linea_transiciones where pedido_id='60000000-0000-0000-0000-000000000003')<>8 then
    raise exception 'A05_FAIL: historial lineas principal != 8';
  end if;
  if exists(
    select 1 from public.pedido_transiciones
     where pedido_id='60000000-0000-0000-0000-000000000003'
       and (actor_user_id is null or terminal_id is null or session_id is null or occurred_at is null)
  ) then
    raise exception 'A05_FAIL: historial pedido incompleto';
  end if;

  v_estado_cobro:=public.abc_estado_cobro_cuenta(
    'emp-c','loc-c1','50000000-0000-0000-0000-000000000003'
  );
  if v_estado_cobro->>'estado'<>'SIN_COBRO'
     or (v_estado_cobro->>'total')::numeric<>0
     or (v_estado_cobro->>'saldo')::numeric<>0 then
    raise exception 'A05_FAIL: estado cobro sin ventas incorrecto %',v_estado_cobro;
  end if;
end $$;

-- Segundo pedido para cancelación sensible.
select public.abc_crear_pedido(
  'a05.cancel.setup.order','emp-c','loc-c1',
  '60000000-0000-0000-0000-000000000004',
  '50000000-0000-0000-0000-000000000003',
  2,
  '20000000-0000-0000-0000-000000000005',
  '40000000-0000-0000-0000-000000000003',
  date '2026-09-23'
);

select public.abc_agregar_linea_pedido(
  'a05.cancel.setup.add','emp-c','loc-c1',
  '70000000-0000-0000-0000-000000000005',
  '60000000-0000-0000-0000-000000000004',
  'prod-cafe',1,1,
  '20000000-0000-0000-0000-000000000005',
  '40000000-0000-0000-0000-000000000003',
  date '2026-09-23'
);

select public.abc_confirmar_linea_pedido(
  'a05.cancel.setup.confirm','emp-c','loc-c1',
  '70000000-0000-0000-0000-000000000005',
  1,2,
  '20000000-0000-0000-0000-000000000005',
  '40000000-0000-0000-0000-000000000003',
  date '2026-09-23'
);

select public.abc_enviar_pedido(
  'a05.cancel.send','emp-c','loc-c1',
  '60000000-0000-0000-0000-000000000004',
  3,
  '20000000-0000-0000-0000-000000000005',
  '40000000-0000-0000-0000-000000000003',
  date '2026-09-23'
);

-- Camarero tiene cancelación normal, pero no sensible después de envío.
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000006',false);

do $$
begin
  begin
    perform public.abc_cancelar_linea(
      'a05.cancel.waiter.denied','emp-c','loc-c1',
      '70000000-0000-0000-0000-000000000005',
      'Cambio ficticio',3,4,
      '20000000-0000-0000-0000-000000000006',
      '40000000-0000-0000-0000-000000000003',
      date '2026-09-23'
    );
    raise exception 'A05_FAIL: cancelacion sensible camarero aceptada';
  exception when others then
    if sqlerrm not like '%cancelacion_sensible_no_autorizada%' then raise; end if;
  end;
end $$;

-- Propietario: motivo obligatorio y cancelación permitida.
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000005',false);

do $$
begin
  begin
    perform public.abc_cancelar_linea(
      'a05.cancel.no.reason','emp-c','loc-c1',
      '70000000-0000-0000-0000-000000000005',
      '   ',3,4,
      '20000000-0000-0000-0000-000000000005',
      '40000000-0000-0000-0000-000000000003',
      date '2026-09-23'
    );
    raise exception 'A05_FAIL: cancelacion sin motivo aceptada';
  exception when others then
    if sqlerrm not like '%motivo_cancelacion_requerido%' then raise; end if;
  end;
end $$;

select public.abc_cancelar_linea(
  'a05.cancel.line','emp-c','loc-c1',
  '70000000-0000-0000-0000-000000000005',
  'Cancelación sensible ficticia',3,4,
  '20000000-0000-0000-0000-000000000005',
  '40000000-0000-0000-0000-000000000003',
  date '2026-09-23'
);

do $$
begin
  if (select estado from public.pedido_lineas where id='70000000-0000-0000-0000-000000000005')<>'CANCELADA' then
    raise exception 'A05_FAIL: linea no CANCELADA';
  end if;
  if (select estado from public.pedidos_tpv where id='60000000-0000-0000-0000-000000000004')<>'ABIERTO' then
    raise exception 'A05_FAIL: pedido vacío no volvió a ABIERTO';
  end if;
end $$;

select public.abc_cancelar_pedido(
  'a05.cancel.order','emp-c','loc-c1',
  '60000000-0000-0000-0000-000000000004',
  'Pedido ficticio cancelado',
  5,
  '20000000-0000-0000-0000-000000000005',
  '40000000-0000-0000-0000-000000000003',
  date '2026-09-23'
);

do $$
begin
  if (select estado from public.pedidos_tpv where id='60000000-0000-0000-0000-000000000004')<>'CANCELADO' then
    raise exception 'A05_FAIL: pedido no CANCELADO';
  end if;
  if (select closed_at from public.pedidos_tpv where id='60000000-0000-0000-0000-000000000004') is null then
    raise exception 'A05_FAIL: pedido cancelado sin closed_at';
  end if;
  if not exists(
    select 1 from public.pedido_linea_transiciones
     where linea_id='70000000-0000-0000-0000-000000000005'
       and estado_anterior='ENVIADA'
       and estado_nuevo='CANCELADA'
       and motivo='Cancelación sensible ficticia'
  ) then
    raise exception 'A05_FAIL: motivo/historial cancelacion sensible';
  end if;
end $$;

do $$
begin
  if (select count(*) from public.abc_eventos where operation_id like 'a05.flow.%')<>8 then
    raise exception 'A05_FAIL: eventos flow exitosos != 8';
  end if;
  if exists(select 1 from public.ventas_fiscales where empresa_id='emp-c')
     or exists(select 1 from public.checkouts where empresa_id='emp-c')
     or exists(select 1 from public.pagos where empresa_id='emp-c') then
    raise exception 'A05_FAIL: A05 produjo efectos económicos';
  end if;
end $$;

select 'ABC_F3_A05_CONTRACT=PASS' as resultado;
