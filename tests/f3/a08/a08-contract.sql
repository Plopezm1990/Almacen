\set ON_ERROR_STOP on

-- A08 — reparto comercial separado de cocina, cuotas por importe y fusión segura.

do $$
declare
  v_table text;
  v_sig text;
  v_oid oid;
  v_capdef text;
  v_tables text[]:=array[
    'cuenta_linea_repartos','cuenta_relaciones','cuenta_cuotas_importe'
  ];
  v_rpcs text[]:=array[
    'public.abc_mover_cantidad_linea_cuenta(text,text,text,uuid,uuid,uuid,numeric,text,bigint,bigint,bigint,uuid,uuid,date)',
    'public.abc_asignar_cuota_importe(text,text,text,uuid,uuid,numeric,text,bigint,bigint,uuid,uuid,date)',
    'public.abc_revertir_cuota_importe(text,text,text,uuid,bigint,bigint,bigint,uuid,uuid,date)',
    'public.abc_unir_cuentas(text,text,text,uuid,uuid,text,bigint,bigint,uuid,uuid,date)',
    'public.abc_consultar_reparto_cuenta(text,text,uuid,uuid,uuid,date)'
  ];
begin
  foreach v_table in array v_tables loop
    if to_regclass('public.'||v_table) is null then
      raise exception 'A08_FAIL: tabla ausente %',v_table;
    end if;
    if not (select relrowsecurity from pg_class where oid=to_regclass('public.'||v_table)) then
      raise exception 'A08_FAIL: RLS ausente %',v_table;
    end if;
    if not has_table_privilege('authenticated','public.'||v_table,'SELECT')
       or has_table_privilege('authenticated','public.'||v_table,'INSERT')
       or has_table_privilege('authenticated','public.'||v_table,'UPDATE')
       or has_table_privilege('authenticated','public.'||v_table,'DELETE')
       or has_table_privilege('anon','public.'||v_table,'SELECT')
       or has_table_privilege('service_role','public.'||v_table,'SELECT') then
      raise exception 'A08_FAIL: ACL tabla incorrecta %',v_table;
    end if;
  end loop;

  foreach v_sig in array v_rpcs loop
    v_oid:=to_regprocedure(v_sig);
    if v_oid is null then raise exception 'A08_FAIL: RPC ausente %',v_sig; end if;
    if not exists(
      select 1 from pg_proc
      where oid=v_oid and prosecdef
        and pg_get_userbyid(proowner)='postgres'
        and coalesce(proconfig,'{}')::text like '%search_path=%'
    ) then
      raise exception 'A08_FAIL: seguridad RPC incorrecta %',v_sig;
    end if;
    if not has_function_privilege('authenticated',v_oid,'EXECUTE')
       or has_function_privilege('anon',v_oid,'EXECUTE')
       or has_function_privilege('service_role',v_oid,'EXECUTE') then
      raise exception 'A08_FAIL: ACL RPC incorrecta %',v_sig;
    end if;
  end loop;

  if has_function_privilege('authenticated','private.abc_materializar_reparto_linea(text,text,uuid)','EXECUTE')
     or has_function_privilege('authenticated','private.abc_cantidad_fiscalizada_linea_cuenta(text,text,uuid,uuid)','EXECUTE')
     or has_function_privilege('authenticated','private.abc_total_comercial_cuenta(text,text,uuid)','EXECUTE')
     or has_function_privilege('authenticated','private.abc_reparto_cuenta_snapshot(text,text,uuid)','EXECUTE')
     or has_function_privilege('anon','private.abc_reparto_cuenta_snapshot(text,text,uuid)','EXECUTE')
     or has_function_privilege('service_role','private.abc_reparto_cuenta_snapshot(text,text,uuid)','EXECUTE') then
    raise exception 'A08_FAIL: helper privado expuesto';
  end if;

  if not exists(
    select 1
    from pg_trigger
    where tgrelid='public.pedido_lineas'::regclass
      and tgname='a08_guard_cancelacion_reparto'
      and not tgisinternal
  ) then
    raise exception 'A08_FAIL: trigger cancelacion/reparto ausente';
  end if;

  v_capdef:=pg_get_functiondef(to_regprocedure('private.abc_tiene_capacidad(text,text,text)'));
  if v_capdef not like '%ABC_CUENTA_OPERAR%'
     or v_capdef not like '%ABC_MESA_ASIGNAR%'
     or v_capdef not like '%ABC_CUENTA_REPARTIR%'
     or v_capdef not like '%ABC_CUENTA_UNIR%'
     or v_capdef not like '%ABC_REPARTO_REVERTIR%' then
    raise exception 'A08_FAIL: capacidades existentes/A08 incompletas';
  end if;

  if position('abc_reparto_cuenta_snapshot' in pg_get_functiondef(to_regprocedure(
      'public.abc_recuperar_cuenta(text,text,uuid,uuid,uuid,date)'
  )))=0
     or position('abc_total_comercial_cuenta' in pg_get_functiondef(to_regprocedure(
      'public.abc_listar_cuentas_recuperables(text,text,uuid,uuid,date,integer)'
  )))=0 then
    raise exception 'A08_FAIL: A06 no extendida con reparto';
  end if;
end $$;

-- Identidades y tenant ficticio.
insert into auth.users(id) values
('00000000-0000-0000-0000-000000000021'),
('00000000-0000-0000-0000-000000000022'),
('00000000-0000-0000-0000-000000000023');

insert into public.empresas(id,nombre,activo)
values ('emp-f','Empresa F ficticia',true);

insert into public.locales(id,empresa_id,nombre,activo)
values
('loc-f1','emp-f','Local F1',true),
('loc-f2','emp-f','Local F2',true);

select set_config('app.test_empresa','emp-f',false);
select set_config('app.test_local','loc-f1',false);
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000021',false);

insert into public.membresias_usuario(user_id,empresa_id,local_id,todos_locales,rol,activo)
values
('00000000-0000-0000-0000-000000000021','emp-f','loc-f1',false,'Propietario',true),
('00000000-0000-0000-0000-000000000022','emp-f','loc-f1',false,'Camarero/a',true),
('00000000-0000-0000-0000-000000000023','emp-f','loc-f2',false,'Encargado',true);

insert into public.entidades_fiscales(
  id,empresa_id,nombre_legal,identificador_fiscal,country_code,simulada,activa
) values (
  '10000000-0000-0000-0000-000000000008',
  'emp-f','Entidad F ficticia','SIM-F','ES',true,true
);

insert into public.entidad_fiscal_monedas(
  empresa_id,entidad_fiscal_id,currency_code,es_principal,activa
) values (
  'emp-f','10000000-0000-0000-0000-000000000008','EUR',true,true
);

insert into public.entidad_fiscal_locales(
  empresa_id,local_id,entidad_fiscal_id,activa
) values (
  'emp-f','loc-f1','10000000-0000-0000-0000-000000000008',true
);

insert into public.entidad_fiscal_local_monedas(
  empresa_id,local_id,entidad_fiscal_id,currency_code,activa
) values (
  'emp-f','loc-f1','10000000-0000-0000-0000-000000000008','EUR',true
);

insert into public.terminales_tpv(id,empresa_id,local_id,nombre,activo)
values
('20000000-0000-0000-0000-000000000013','emp-f','loc-f1','Terminal F1',true),
('20000000-0000-0000-0000-000000000014','emp-f','loc-f1','Terminal F2',true);

insert into public.cajas_fisicas(id,empresa_id,local_id,nombre,activo)
values ('30000000-0000-0000-0000-000000000008','emp-f','loc-f1','Caja F',true);

insert into public.caja_sesiones(
  id,empresa_id,local_id,caja_id,estado,version,abierta_at,abierta_por
) values (
  '40000000-0000-0000-0000-000000000008','emp-f','loc-f1',
  '30000000-0000-0000-0000-000000000008','ABIERTA',1,now(),
  '00000000-0000-0000-0000-000000000021'
);

insert into public.caja_sesion_terminales(
  empresa_id,local_id,session_id,terminal_id,desde
) values
('emp-f','loc-f1','40000000-0000-0000-0000-000000000008','20000000-0000-0000-0000-000000000013',now()),
('emp-f','loc-f1','40000000-0000-0000-0000-000000000008','20000000-0000-0000-0000-000000000014',now());

insert into public.caja_sesion_responsables(
  empresa_id,local_id,session_id,user_id,desde,asignado_por,motivo
) values (
  'emp-f','loc-f1','40000000-0000-0000-0000-000000000008',
  '00000000-0000-0000-0000-000000000021',now(),
  '00000000-0000-0000-0000-000000000021','TEST_A08'
);

insert into public.catalogo_tpv_productos(
  empresa_id,local_id,producto_id,currency_code,entidad_fiscal_id,nombre,unidad,
  fraccionable,precision_cantidad,precio_unitario,impuesto_pct,activo,version,snapshot_origen
) values
(
  'emp-f','loc-f1','prod-unit-f','EUR','10000000-0000-0000-0000-000000000008',
  'Producto unidad F','ud',false,0,10,10,true,1,'{}'::jsonb
),
(
  'emp-f','loc-f1','prod-frac-f','EUR','10000000-0000-0000-0000-000000000008',
  'Producto fraccionable F','kg',true,2,20,10,true,1,'{}'::jsonb
);

-- A07: una mesa compartida para las cuentas de split y otra para merge.
select public.abc_crear_zona(
  'a08.zone','emp-f','loc-f1',
  '90000000-0000-0000-0000-000000000011',
  'SALA','Sala A08','SALA',1,
  '20000000-0000-0000-0000-000000000013',
  '40000000-0000-0000-0000-000000000008',
  date '2026-09-24'
);

select public.abc_crear_mesa(
  'a08.table.split','emp-f','loc-f1',
  '91000000-0000-0000-0000-000000000011',
  '90000000-0000-0000-0000-000000000011',
  'S1','Split 1',6,1,
  '20000000-0000-0000-0000-000000000013',
  '40000000-0000-0000-0000-000000000008',
  date '2026-09-24'
);

select public.abc_crear_mesa(
  'a08.table.merge','emp-f','loc-f1',
  '91000000-0000-0000-0000-000000000012',
  '90000000-0000-0000-0000-000000000011',
  'M1','Merge 1',6,2,
  '20000000-0000-0000-0000-000000000013',
  '40000000-0000-0000-0000-000000000008',
  date '2026-09-24'
);

-- Cuentas 1/2: split por línea/cantidad/comensal.
select public.abc_abrir_cuenta(
  'a08.account.1','emp-f','loc-f1',
  '50000000-0000-0000-0000-000000000011','MESA','EUR',
  '00000000-0000-0000-0000-000000000021',
  '20000000-0000-0000-0000-000000000013',
  '40000000-0000-0000-0000-000000000008',date '2026-09-24'
);
select public.abc_abrir_cuenta(
  'a08.account.2','emp-f','loc-f1',
  '50000000-0000-0000-0000-000000000012','MESA','EUR',
  '00000000-0000-0000-0000-000000000022',
  '20000000-0000-0000-0000-000000000013',
  '40000000-0000-0000-0000-000000000008',date '2026-09-24'
);

select public.abc_asignar_cuenta_mesa(
  'a08.a1.table','emp-f','loc-f1',
  '50000000-0000-0000-0000-000000000011',
  '91000000-0000-0000-0000-000000000011',
  2,1,1,
  '20000000-0000-0000-0000-000000000013',
  '40000000-0000-0000-0000-000000000008',date '2026-09-24'
);
select public.abc_asignar_cuenta_mesa(
  'a08.a2.table','emp-f','loc-f1',
  '50000000-0000-0000-0000-000000000012',
  '91000000-0000-0000-0000-000000000011',
  2,1,2,
  '20000000-0000-0000-0000-000000000013',
  '40000000-0000-0000-0000-000000000008',date '2026-09-24'
);

select public.abc_crear_pedido(
  'a08.a1.order','emp-f','loc-f1',
  '60000000-0000-0000-0000-000000000011',
  '50000000-0000-0000-0000-000000000011',
  2,
  '20000000-0000-0000-0000-000000000013',
  '40000000-0000-0000-0000-000000000008',date '2026-09-24'
);

select public.abc_agregar_linea_pedido(
  'a08.a1.line.unit','emp-f','loc-f1',
  '70000000-0000-0000-0000-000000000011',
  '60000000-0000-0000-0000-000000000011',
  'prod-unit-f',4,1,
  '20000000-0000-0000-0000-000000000013',
  '40000000-0000-0000-0000-000000000008',date '2026-09-24'
);
select public.abc_confirmar_linea_pedido(
  'a08.a1.line.unit.confirm','emp-f','loc-f1',
  '70000000-0000-0000-0000-000000000011',
  1,2,
  '20000000-0000-0000-0000-000000000013',
  '40000000-0000-0000-0000-000000000008',date '2026-09-24'
);

-- Split de una unidad con etiqueta de comensal.
select public.abc_mover_cantidad_linea_cuenta(
  'a08.split.unit','emp-f','loc-f1',
  '70000000-0000-0000-0000-000000000011',
  '50000000-0000-0000-0000-000000000011',
  '50000000-0000-0000-0000-000000000012',
  1,'COMENSAL-2',
  3,2,2,
  '20000000-0000-0000-0000-000000000013',
  '40000000-0000-0000-0000-000000000008',date '2026-09-24'
);

-- Replay exacto.
select public.abc_mover_cantidad_linea_cuenta(
  'a08.split.unit','emp-f','loc-f1',
  '70000000-0000-0000-0000-000000000011',
  '50000000-0000-0000-0000-000000000011',
  '50000000-0000-0000-0000-000000000012',
  1,'COMENSAL-2',
  3,2,2,
  '20000000-0000-0000-0000-000000000013',
  '40000000-0000-0000-0000-000000000008',date '2026-09-24'
);

do $$
declare s1 jsonb; s2 jsonb;
begin
  if (select cantidad from public.pedido_lineas where id='70000000-0000-0000-0000-000000000011')<>4
     or (select pedido_id from public.pedido_lineas where id='70000000-0000-0000-0000-000000000011')
        <>'60000000-0000-0000-0000-000000000011'::uuid then
    raise exception 'A08_FAIL: pedido_linea fue reescrita por split';
  end if;

  if (select count(*) from public.cuenta_linea_repartos
      where source_line_id='70000000-0000-0000-0000-000000000011' and estado='ACTIVO')<>2 then
    raise exception 'A08_FAIL: split no generó dos repartos';
  end if;
  if (select cantidad from public.cuenta_linea_repartos
      where source_line_id='70000000-0000-0000-0000-000000000011'
        and cuenta_id='50000000-0000-0000-0000-000000000011' and estado='ACTIVO')<>3 then
    raise exception 'A08_FAIL: cantidad origen incorrecta';
  end if;
  if (select cantidad from public.cuenta_linea_repartos
      where source_line_id='70000000-0000-0000-0000-000000000011'
        and cuenta_id='50000000-0000-0000-0000-000000000012' and estado='ACTIVO')<>1 then
    raise exception 'A08_FAIL: cantidad destino incorrecta';
  end if;
  if (select total from public.cuenta_linea_repartos
      where source_line_id='70000000-0000-0000-0000-000000000011'
        and cuenta_id='50000000-0000-0000-0000-000000000012' and estado='ACTIVO')<>11 then
    raise exception 'A08_FAIL: importe destino unitario incorrecto';
  end if;
  if (select count(*) from public.abc_eventos
      where operation_id='a08.split.unit' and event_type='CUENTA_REPARTO_LINEA_MOVIDO')<>1 then
    raise exception 'A08_FAIL: replay duplicó evento';
  end if;

  s1:=public.abc_recuperar_cuenta(
    'emp-f','loc-f1','50000000-0000-0000-0000-000000000011',
    '20000000-0000-0000-0000-000000000014',
    '40000000-0000-0000-0000-000000000008',date '2026-09-24'
  );
  s2:=public.abc_recuperar_cuenta(
    'emp-f','loc-f1','50000000-0000-0000-0000-000000000012',
    '20000000-0000-0000-0000-000000000014',
    '40000000-0000-0000-0000-000000000008',date '2026-09-24'
  );
  if jsonb_array_length(s1->'reparto'->'lineas')<>1
     or jsonb_array_length(s2->'reparto'->'lineas')<>1 then
    raise exception 'A08_FAIL: A06 no recupera repartos';
  end if;
  if s2->'reparto'->'lineas'->0->>'comensal_ref'<>'COMENSAL-2' then
    raise exception 'A08_FAIL: comensal no recuperado';
  end if;
end $$;

-- Stale de cuenta y cantidad decimal en producto no fraccionable.
do $$
begin
  begin
    perform public.abc_mover_cantidad_linea_cuenta(
      'a08.invalid.stale','emp-f','loc-f1',
      '70000000-0000-0000-0000-000000000011',
      '50000000-0000-0000-0000-000000000011',
      '50000000-0000-0000-0000-000000000012',
      1,null,3,3,2,
      '20000000-0000-0000-0000-000000000014',
      '40000000-0000-0000-0000-000000000008',date '2026-09-24'
    );
    raise exception 'A08_FAIL: stale cuenta aceptada';
  exception when others then
    if sqlerrm not like '%cuenta_origen_version_conflict%' then raise; end if;
  end;

  begin
    perform public.abc_mover_cantidad_linea_cuenta(
      'a08.invalid.nonfrac','emp-f','loc-f1',
      '70000000-0000-0000-0000-000000000011',
      '50000000-0000-0000-0000-000000000011',
      '50000000-0000-0000-0000-000000000012',
      0.5,null,4,3,2,
      '20000000-0000-0000-0000-000000000014',
      '40000000-0000-0000-0000-000000000008',date '2026-09-24'
    );
    raise exception 'A08_FAIL: decimal no fraccionable aceptado';
  exception when others then
    if sqlerrm not like '%reparto_cantidad_no_fraccionable%' then raise; end if;
  end;
end $$;

-- Línea fraccionable, split ejecutado por Camarero.
select public.abc_agregar_linea_pedido(
  'a08.a1.line.frac','emp-f','loc-f1',
  '70000000-0000-0000-0000-000000000012',
  '60000000-0000-0000-0000-000000000011',
  'prod-frac-f',1.50,3,
  '20000000-0000-0000-0000-000000000013',
  '40000000-0000-0000-0000-000000000008',date '2026-09-24'
);
select public.abc_confirmar_linea_pedido(
  'a08.a1.line.frac.confirm','emp-f','loc-f1',
  '70000000-0000-0000-0000-000000000012',
  1,4,
  '20000000-0000-0000-0000-000000000013',
  '40000000-0000-0000-0000-000000000008',date '2026-09-24'
);

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000022',false);
select public.abc_mover_cantidad_linea_cuenta(
  'a08.split.frac','emp-f','loc-f1',
  '70000000-0000-0000-0000-000000000012',
  '50000000-0000-0000-0000-000000000011',
  '50000000-0000-0000-0000-000000000012',
  0.50,'COMENSAL-2',
  4,3,2,
  '20000000-0000-0000-0000-000000000014',
  '40000000-0000-0000-0000-000000000008',date '2026-09-24'
);

do $$
begin
  if (select cantidad from public.cuenta_linea_repartos
      where source_line_id='70000000-0000-0000-0000-000000000012'
        and cuenta_id='50000000-0000-0000-0000-000000000012' and estado='ACTIVO')<>0.50 then
    raise exception 'A08_FAIL: split fraccionable incorrecto';
  end if;

  begin
    perform public.abc_mover_cantidad_linea_cuenta(
      'a08.invalid.precision','emp-f','loc-f1',
      '70000000-0000-0000-0000-000000000012',
      '50000000-0000-0000-0000-000000000011',
      '50000000-0000-0000-0000-000000000012',
      0.001,null,5,4,2,
      '20000000-0000-0000-0000-000000000014',
      '40000000-0000-0000-0000-000000000008',date '2026-09-24'
    );
    raise exception 'A08_FAIL: precisión inválida aceptada';
  exception when others then
    if sqlerrm not like '%reparto_cantidad_precision_invalida%' then raise; end if;
  end;
end $$;

-- Cancelación de una línea repartida debe bloquearse.
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000021',false);
do $$
begin
  begin
    update public.pedido_lineas
       set estado='CANCELADA'
     where id='70000000-0000-0000-0000-000000000011';
    raise exception 'A08_FAIL: cancelación con reparto aceptada';
  exception when others then
    if sqlerrm not like '%reparto_activo_impide_cancelacion%' then raise; end if;
  end;
end $$;

-- Revertir el reparto unitario moviendo la unidad al origen.
select public.abc_mover_cantidad_linea_cuenta(
  'a08.return.unit','emp-f','loc-f1',
  '70000000-0000-0000-0000-000000000011',
  '50000000-0000-0000-0000-000000000012',
  '50000000-0000-0000-0000-000000000011',
  1,null,
  4,5,2,
  '20000000-0000-0000-0000-000000000013',
  '40000000-0000-0000-0000-000000000008',date '2026-09-24'
);

-- Fiscalizar 1 unidad: solo las otras 3 quedan movibles.
insert into public.ventas_fiscales(
  id,empresa_id,local_id,cuenta_id,entidad_fiscal_id,currency_code,
  estado,version,subtotal,descuento_total,impuestos_total,total,
  snapshot_calculo,created_by,created_operating_day
) values (
  '81000000-0000-0000-0000-000000000001',
  'emp-f','loc-f1','50000000-0000-0000-0000-000000000011',
  '10000000-0000-0000-0000-000000000008','EUR',
  'ABIERTA',1,10,0,1,11,'{}'::jsonb,
  '00000000-0000-0000-0000-000000000021',date '2026-09-24'
);

insert into public.venta_fiscal_lineas(
  id,empresa_id,local_id,venta_fiscal_id,source_line_id,entidad_fiscal_id,currency_code,
  cantidad,precio_unitario,descuento,base,impuesto,total,snapshot
) values (
  '82000000-0000-0000-0000-000000000001',
  'emp-f','loc-f1','81000000-0000-0000-0000-000000000001',
  '70000000-0000-0000-0000-000000000011',
  '10000000-0000-0000-0000-000000000008','EUR',
  1,10,0,10,1,11,'{}'::jsonb
);

do $$
begin
  begin
    perform public.abc_mover_cantidad_linea_cuenta(
      'a08.invalid.fiscal.all','emp-f','loc-f1',
      '70000000-0000-0000-0000-000000000011',
      '50000000-0000-0000-0000-000000000011',
      '50000000-0000-0000-0000-000000000012',
      4,null,6,5,2,
      '20000000-0000-0000-0000-000000000013',
      '40000000-0000-0000-0000-000000000008',date '2026-09-24'
    );
    raise exception 'A08_FAIL: parte fiscalizada movida';
  exception when others then
    if sqlerrm not like '%reparto_parte_fiscalizada_inmovil%' then raise; end if;
  end;
end $$;

select public.abc_mover_cantidad_linea_cuenta(
  'a08.fiscal.remaining','emp-f','loc-f1',
  '70000000-0000-0000-0000-000000000011',
  '50000000-0000-0000-0000-000000000011',
  '50000000-0000-0000-0000-000000000012',
  3,null,6,5,2,
  '20000000-0000-0000-0000-000000000013',
  '40000000-0000-0000-0000-000000000008',date '2026-09-24'
);

do $$
begin
  if (select cantidad from public.cuenta_linea_repartos
      where source_line_id='70000000-0000-0000-0000-000000000011'
        and cuenta_id='50000000-0000-0000-0000-000000000011' and estado='ACTIVO')<>1 then
    raise exception 'A08_FAIL: cantidad fiscalizada no quedó inmóvil';
  end if;
end $$;

-- Cuentas 3/4: split por importe y reversión.
select public.abc_abrir_cuenta(
  'a08.account.3','emp-f','loc-f1',
  '50000000-0000-0000-0000-000000000013','BARRA','EUR',
  '00000000-0000-0000-0000-000000000021',
  '20000000-0000-0000-0000-000000000013',
  '40000000-0000-0000-0000-000000000008',date '2026-09-24'
);
select public.abc_abrir_cuenta(
  'a08.account.4','emp-f','loc-f1',
  '50000000-0000-0000-0000-000000000014','BARRA','EUR',
  '00000000-0000-0000-0000-000000000022',
  '20000000-0000-0000-0000-000000000013',
  '40000000-0000-0000-0000-000000000008',date '2026-09-24'
);
select public.abc_crear_pedido(
  'a08.a3.order','emp-f','loc-f1',
  '60000000-0000-0000-0000-000000000013',
  '50000000-0000-0000-0000-000000000013',
  1,
  '20000000-0000-0000-0000-000000000013',
  '40000000-0000-0000-0000-000000000008',date '2026-09-24'
);
select public.abc_agregar_linea_pedido(
  'a08.a3.line','emp-f','loc-f1',
  '70000000-0000-0000-0000-000000000013',
  '60000000-0000-0000-0000-000000000013',
  'prod-unit-f',2,1,
  '20000000-0000-0000-0000-000000000013',
  '40000000-0000-0000-0000-000000000008',date '2026-09-24'
);
select public.abc_confirmar_linea_pedido(
  'a08.a3.line.confirm','emp-f','loc-f1',
  '70000000-0000-0000-0000-000000000013',
  1,2,
  '20000000-0000-0000-0000-000000000013',
  '40000000-0000-0000-0000-000000000008',date '2026-09-24'
);

select public.abc_asignar_cuota_importe(
  'a08.quota','emp-f','loc-f1',
  '50000000-0000-0000-0000-000000000013',
  '50000000-0000-0000-0000-000000000014',
  10,'MITAD-PARCIAL',2,1,
  '20000000-0000-0000-0000-000000000013',
  '40000000-0000-0000-0000-000000000008',date '2026-09-24'
);
select public.abc_asignar_cuota_importe(
  'a08.quota','emp-f','loc-f1',
  '50000000-0000-0000-0000-000000000013',
  '50000000-0000-0000-0000-000000000014',
  10,'MITAD-PARCIAL',2,1,
  '20000000-0000-0000-0000-000000000013',
  '40000000-0000-0000-0000-000000000008',date '2026-09-24'
);

do $$
begin
  if private.abc_total_comercial_cuenta('emp-f','loc-f1','50000000-0000-0000-0000-000000000013')<>12 then
    raise exception 'A08_FAIL: total origen cuota';
  end if;
  if private.abc_total_comercial_cuenta('emp-f','loc-f1','50000000-0000-0000-0000-000000000014')<>10 then
    raise exception 'A08_FAIL: total destino cuota';
  end if;
  if (select count(*) from public.cuenta_cuotas_importe where estado='ACTIVA'
      and cuenta_origen_id='50000000-0000-0000-0000-000000000013')<>1 then
    raise exception 'A08_FAIL: replay cuota duplicó';
  end if;

  begin
    perform public.abc_mover_cantidad_linea_cuenta(
      'a08.invalid.mix','emp-f','loc-f1',
      '70000000-0000-0000-0000-000000000013',
      '50000000-0000-0000-0000-000000000013',
      '50000000-0000-0000-0000-000000000014',
      1,null,3,2,2,
      '20000000-0000-0000-0000-000000000013',
      '40000000-0000-0000-0000-000000000008',date '2026-09-24'
    );
    raise exception 'A08_FAIL: mezcla cuota/reparto línea aceptada';
  exception when others then
    if sqlerrm not like '%cuota_activa_incompatible_con_reparto_linea%' then raise; end if;
  end;
end $$;

-- Camarero no puede revertir cuota.
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000022',false);
do $$
declare q uuid;
begin
  select id into q from public.cuenta_cuotas_importe
  where cuenta_origen_id='50000000-0000-0000-0000-000000000013' and estado='ACTIVA';
  begin
    perform public.abc_revertir_cuota_importe(
      'a08.quota.revert.denied','emp-f','loc-f1',q,1,3,2,
      '20000000-0000-0000-0000-000000000014',
      '40000000-0000-0000-0000-000000000008',date '2026-09-24'
    );
    raise exception 'A08_FAIL: Camarero revirtió cuota';
  exception when others then
    if sqlerrm not like '%cuota_revertir_no_autorizada%' then raise; end if;
  end;
end $$;

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000021',false);
do $$
declare q uuid;
begin
  select id into q from public.cuenta_cuotas_importe
  where cuenta_origen_id='50000000-0000-0000-0000-000000000013' and estado='ACTIVA';

  perform public.abc_revertir_cuota_importe(
    'a08.quota.revert','emp-f','loc-f1',q,1,3,2,
    '20000000-0000-0000-0000-000000000013',
    '40000000-0000-0000-0000-000000000008',date '2026-09-24'
  );
end $$;

do $$
begin
  if private.abc_total_comercial_cuenta('emp-f','loc-f1','50000000-0000-0000-0000-000000000013')<>22
     or private.abc_total_comercial_cuenta('emp-f','loc-f1','50000000-0000-0000-0000-000000000014')<>0 then
    raise exception 'A08_FAIL: reversión cuota no restauró totales';
  end if;
end $$;

-- Cuentas 5/6: fusión segura en misma mesa.
select public.abc_abrir_cuenta(
  'a08.account.5','emp-f','loc-f1',
  '50000000-0000-0000-0000-000000000015','MESA','EUR',
  '00000000-0000-0000-0000-000000000021',
  '20000000-0000-0000-0000-000000000013',
  '40000000-0000-0000-0000-000000000008',date '2026-09-24'
);
select public.abc_abrir_cuenta(
  'a08.account.6','emp-f','loc-f1',
  '50000000-0000-0000-0000-000000000016','MESA','EUR',
  '00000000-0000-0000-0000-000000000022',
  '20000000-0000-0000-0000-000000000013',
  '40000000-0000-0000-0000-000000000008',date '2026-09-24'
);

select public.abc_asignar_cuenta_mesa(
  'a08.a5.table','emp-f','loc-f1',
  '50000000-0000-0000-0000-000000000015',
  '91000000-0000-0000-0000-000000000012',
  2,1,1,
  '20000000-0000-0000-0000-000000000013',
  '40000000-0000-0000-0000-000000000008',date '2026-09-24'
);
select public.abc_asignar_cuenta_mesa(
  'a08.a6.table','emp-f','loc-f1',
  '50000000-0000-0000-0000-000000000016',
  '91000000-0000-0000-0000-000000000012',
  3,1,2,
  '20000000-0000-0000-0000-000000000013',
  '40000000-0000-0000-0000-000000000008',date '2026-09-24'
);

select public.abc_crear_pedido(
  'a08.a5.order','emp-f','loc-f1',
  '60000000-0000-0000-0000-000000000015',
  '50000000-0000-0000-0000-000000000015',
  2,
  '20000000-0000-0000-0000-000000000013',
  '40000000-0000-0000-0000-000000000008',date '2026-09-24'
);
select public.abc_agregar_linea_pedido(
  'a08.a5.line','emp-f','loc-f1',
  '70000000-0000-0000-0000-000000000015',
  '60000000-0000-0000-0000-000000000015',
  'prod-unit-f',1,1,
  '20000000-0000-0000-0000-000000000013',
  '40000000-0000-0000-0000-000000000008',date '2026-09-24'
);
select public.abc_confirmar_linea_pedido(
  'a08.a5.line.confirm','emp-f','loc-f1',
  '70000000-0000-0000-0000-000000000015',
  1,2,
  '20000000-0000-0000-0000-000000000013',
  '40000000-0000-0000-0000-000000000008',date '2026-09-24'
);

-- Simular final de cocina conservando pedido/línea originales.
update public.pedido_lineas
set estado='SERVIDA'
where id='70000000-0000-0000-0000-000000000015';
update public.pedidos_tpv
set estado='SERVIDO'
where id='60000000-0000-0000-0000-000000000015';

select public.abc_unir_cuentas(
  'a08.merge','emp-f','loc-f1',
  '50000000-0000-0000-0000-000000000015',
  '50000000-0000-0000-0000-000000000016',
  'Unir cuentas de la misma mesa',
  3,2,
  '20000000-0000-0000-0000-000000000013',
  '40000000-0000-0000-0000-000000000008',date '2026-09-24'
);
select public.abc_unir_cuentas(
  'a08.merge','emp-f','loc-f1',
  '50000000-0000-0000-0000-000000000015',
  '50000000-0000-0000-0000-000000000016',
  'Unir cuentas de la misma mesa',
  3,2,
  '20000000-0000-0000-0000-000000000013',
  '40000000-0000-0000-0000-000000000008',date '2026-09-24'
);

do $$
declare s jsonb; mapa jsonb; z jsonb; m jsonb; c jsonb; found_dest boolean:=false;
begin
  if (select estado from public.cuentas_comerciales
      where id='50000000-0000-0000-0000-000000000015')<>'CERRADA' then
    raise exception 'A08_FAIL: cuenta origen merge no cerrada';
  end if;
  if (select count(*) from public.cuenta_relaciones
      where cuenta_origen_id='50000000-0000-0000-0000-000000000015'
        and cuenta_destino_id='50000000-0000-0000-0000-000000000016'
        and tipo='FUSION')<>1 then
    raise exception 'A08_FAIL: relación fusión incorrecta';
  end if;
  if (select cuenta_id from public.pedidos_tpv
      where id='60000000-0000-0000-0000-000000000015')
      <>'50000000-0000-0000-0000-000000000015'::uuid then
    raise exception 'A08_FAIL: merge reescribió pedido de cocina';
  end if;
  if (select estado from public.pedido_lineas
      where id='70000000-0000-0000-0000-000000000015')<>'SERVIDA' then
    raise exception 'A08_FAIL: merge alteró estado A05';
  end if;
  if private.abc_total_comercial_cuenta(
      'emp-f','loc-f1','50000000-0000-0000-0000-000000000016'
     )<>11 then
    raise exception 'A08_FAIL: total comercial merge';
  end if;
  if (select count(*) from public.cuenta_mesa_asignaciones
      where cuenta_id='50000000-0000-0000-0000-000000000015' and hasta is null)<>0 then
    raise exception 'A08_FAIL: mesa origen merge sigue activa';
  end if;
  if (select comensales from public.cuenta_mesa_asignaciones
      where cuenta_id='50000000-0000-0000-0000-000000000016' and hasta is null)<>5 then
    raise exception 'A08_FAIL: comensales no consolidados';
  end if;
  if (select count(*) from public.abc_eventos
      where operation_id='a08.merge' and event_type='CUENTAS_UNIDAS')<>1 then
    raise exception 'A08_FAIL: replay merge duplicó evento';
  end if;

  s:=public.abc_recuperar_cuenta(
    'emp-f','loc-f1','50000000-0000-0000-0000-000000000016',
    '20000000-0000-0000-0000-000000000014',
    '40000000-0000-0000-0000-000000000008',date '2026-09-24'
  );
  if jsonb_array_length(s->'reparto'->'lineas')<>1
     or s->'reparto'->'lineas'->0->>'source_line_id'
        <>'70000000-0000-0000-0000-000000000015' then
    raise exception 'A08_FAIL: A06 destino merge no recupera línea origen';
  end if;

  mapa:=public.abc_listar_mapa_sala(
    'emp-f','loc-f1',
    '20000000-0000-0000-0000-000000000013',
    '40000000-0000-0000-0000-000000000008',date '2026-09-24'
  );
  for z in select value from jsonb_array_elements(mapa->'zonas') loop
    for m in select value from jsonb_array_elements(z->'mesas') loop
      if m->>'mesa_id'='91000000-0000-0000-0000-000000000012' then
        for c in select value from jsonb_array_elements(m->'cuentas') loop
          if c->>'cuenta_id'='50000000-0000-0000-0000-000000000016' then
            found_dest:=true;
          end if;
          if c->>'cuenta_id'='50000000-0000-0000-0000-000000000015' then
            raise exception 'A08_FAIL: cuenta cerrada merge sigue en mapa';
          end if;
        end loop;
      end if;
    end loop;
  end loop;
  if not found_dest then raise exception 'A08_FAIL: destino merge no está en mesa'; end if;
end $$;

-- La cuenta con fiscalización no puede fusionarse.
do $$
begin
  begin
    perform public.abc_unir_cuentas(
      'a08.invalid.merge.fiscal','emp-f','loc-f1',
      '50000000-0000-0000-0000-000000000011',
      '50000000-0000-0000-0000-000000000012',
      'No debe aplicar',
      7,6,
      '20000000-0000-0000-0000-000000000013',
      '40000000-0000-0000-0000-000000000008',date '2026-09-24'
    );
    raise exception 'A08_FAIL: merge fiscalizado aceptado';
  exception when others then
    if sqlerrm not like '%cuentas_unir_con_fiscalizacion%' then raise; end if;
  end;
end $$;

-- Consulta A08 y aislamiento cross-local.
do $$
declare r jsonb;
begin
  r:=public.abc_consultar_reparto_cuenta(
    'emp-f','loc-f1','50000000-0000-0000-0000-000000000012',
    '20000000-0000-0000-0000-000000000014',
    '40000000-0000-0000-0000-000000000008',date '2026-09-24'
  );
  if r->>'ok'<>'true' or jsonb_array_length(r->'reparto'->'lineas')<2 then
    raise exception 'A08_FAIL: consulta reparto incompleta %',r;
  end if;
end $$;

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000023',false);
do $$
begin
  begin
    perform public.abc_consultar_reparto_cuenta(
      'emp-f','loc-f1','50000000-0000-0000-0000-000000000012',
      '20000000-0000-0000-0000-000000000014',
      '40000000-0000-0000-0000-000000000008',date '2026-09-24'
    );
    raise exception 'A08_FAIL: consulta cross-local aceptada';
  exception when others then
    if sqlerrm not like '%reparto_consultar_no_autorizado%' then raise; end if;
  end;
end $$;

-- Ninguna operación A08 crea/mueve pagos/checkouts.
do $$
begin
  if exists(select 1 from public.pagos where empresa_id='emp-f')
     or exists(select 1 from public.pago_aplicaciones where empresa_id='emp-f')
     or exists(select 1 from public.checkouts where empresa_id='emp-f')
     or exists(select 1 from public.checkout_ventas where empresa_id='emp-f') then
    raise exception 'A08_FAIL: A08 alteró capa de cobro';
  end if;
end $$;

select 'ABC_F3_A08_CONTRACT=PASS' as resultado;
