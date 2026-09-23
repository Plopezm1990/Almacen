\set ON_ERROR_STOP on

-- A03 — contrato estructural, ACL y autoridad económica.
do $$
declare
  v_sig text;
  v_oid oid;
  v_rpcs text[]:=array[
    'public.abc_abrir_cuenta(text,text,text,uuid,text,text,uuid,uuid,uuid,date)',
    'public.abc_crear_pedido(text,text,text,uuid,uuid,bigint,uuid,uuid,date)',
    'public.abc_agregar_linea_pedido(text,text,text,uuid,uuid,text,numeric,bigint,uuid,uuid,date)',
    'public.abc_actualizar_linea_pedido(text,text,text,uuid,numeric,bigint,bigint,uuid,uuid,date)',
    'public.abc_confirmar_linea_pedido(text,text,text,uuid,bigint,bigint,uuid,uuid,date)'
  ];
begin
  if to_regclass('public.catalogo_tpv_productos') is null then
    raise exception 'A03_FAIL: catalogo_tpv_productos ausente';
  end if;
  if not exists(
    select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
     where n.nspname='public' and c.relname='catalogo_tpv_productos' and c.relrowsecurity
  ) then
    raise exception 'A03_FAIL: RLS catalogo no habilitado';
  end if;

  if not has_table_privilege('authenticated','public.catalogo_tpv_productos','SELECT')
     or has_table_privilege('authenticated','public.catalogo_tpv_productos','INSERT')
     or has_table_privilege('authenticated','public.catalogo_tpv_productos','UPDATE')
     or has_table_privilege('authenticated','public.catalogo_tpv_productos','DELETE')
     or has_table_privilege('anon','public.catalogo_tpv_productos','SELECT')
     or has_table_privilege('service_role','public.catalogo_tpv_productos','SELECT') then
    raise exception 'A03_FAIL: ACL catalogo incorrecta';
  end if;

  foreach v_sig in array v_rpcs loop
    v_oid:=to_regprocedure(v_sig);
    if v_oid is null then raise exception 'A03_FAIL: RPC ausente %',v_sig; end if;
    if not exists(
      select 1 from pg_proc
       where oid=v_oid and prosecdef and pg_get_userbyid(proowner)='postgres'
    ) then
      raise exception 'A03_FAIL: RPC no SECURITY DEFINER postgres %',v_sig;
    end if;
    if not has_function_privilege('authenticated',v_oid,'EXECUTE')
       or has_function_privilege('anon',v_oid,'EXECUTE')
       or has_function_privilege('service_role',v_oid,'EXECUTE') then
      raise exception 'A03_FAIL: ACL RPC incorrecta %',v_sig;
    end if;
  end loop;

  if has_function_privilege('anon','private.abc_terminal_sesion_operativa(text,text,uuid,uuid)','EXECUTE')
     or has_function_privilege('authenticated','private.abc_terminal_sesion_operativa(text,text,uuid,uuid)','EXECUTE')
     or has_function_privilege('service_role','private.abc_terminal_sesion_operativa(text,text,uuid,uuid)','EXECUTE')
     or has_function_privilege('anon','private.abc_calcular_linea_tpv(text,text,text,text,numeric)','EXECUTE')
     or has_function_privilege('authenticated','private.abc_calcular_linea_tpv(text,text,text,text,numeric)','EXECUTE')
     or has_function_privilege('service_role','private.abc_calcular_linea_tpv(text,text,text,text,numeric)','EXECUTE') then
    raise exception 'A03_FAIL: helper privado expuesto';
  end if;

  if pg_get_function_identity_arguments(
       'public.abc_agregar_linea_pedido(text,text,text,uuid,uuid,text,numeric,bigint,uuid,uuid,date)'::regprocedure
     ) ~* '(precio|impuesto|iva|descuento|total|base)' then
    raise exception 'A03_FAIL: RPC agregar linea acepta importes del cliente';
  end if;
  if pg_get_function_identity_arguments(
       'public.abc_actualizar_linea_pedido(text,text,text,uuid,numeric,bigint,bigint,uuid,uuid,date)'::regprocedure
     ) ~* '(precio|impuesto|iva|descuento|total|base)' then
    raise exception 'A03_FAIL: RPC actualizar linea acepta importes del cliente';
  end if;
end $$;

-- Datos ficticios del contrato. No representan actividad real.
insert into auth.users(id) values
('00000000-0000-0000-0000-000000000001'),
('00000000-0000-0000-0000-000000000002');

insert into public.empresas(id,nombre,activo)
values ('emp-a','Empresa A',true);

insert into public.locales(id,empresa_id,nombre,activo)
values
('loc-a','emp-a','Local A',true),
('loc-b','emp-a','Local B',true);

select set_config('app.test_empresa','emp-a',false);
select set_config('app.test_local','loc-a',false);
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);

insert into public.membresias_usuario(user_id,empresa_id,local_id,todos_locales,rol,activo)
values
('00000000-0000-0000-0000-000000000001','emp-a','loc-a',false,'Propietario',true),
('00000000-0000-0000-0000-000000000002','emp-a','loc-a',false,'Camarero/a',true);

insert into public.entidades_fiscales(
  id,empresa_id,nombre_legal,identificador_fiscal,country_code,simulada,activa
) values (
  '10000000-0000-0000-0000-000000000001','emp-a','Entidad simulada','SIM-A','ES',true,true
);

insert into public.entidad_fiscal_monedas(
  empresa_id,entidad_fiscal_id,currency_code,es_principal,activa
) values (
  'emp-a','10000000-0000-0000-0000-000000000001','EUR',true,true
);

insert into public.entidad_fiscal_locales(
  empresa_id,local_id,entidad_fiscal_id,activa
) values (
  'emp-a','loc-a','10000000-0000-0000-0000-000000000001',true
);

insert into public.entidad_fiscal_local_monedas(
  empresa_id,local_id,entidad_fiscal_id,currency_code,activa
) values (
  'emp-a','loc-a','10000000-0000-0000-0000-000000000001','EUR',true
);

insert into public.terminales_tpv(id,empresa_id,local_id,nombre,activo)
values
('20000000-0000-0000-0000-000000000001','emp-a','loc-a','Terminal 1',true),
('20000000-0000-0000-0000-000000000002','emp-a','loc-a','Terminal 2',true);

insert into public.cajas_fisicas(id,empresa_id,local_id,nombre,activo)
values ('30000000-0000-0000-0000-000000000001','emp-a','loc-a','Caja 1',true);

insert into public.caja_sesiones(
  id,empresa_id,local_id,caja_id,estado,version,abierta_at,abierta_por
) values (
  '40000000-0000-0000-0000-000000000001','emp-a','loc-a',
  '30000000-0000-0000-0000-000000000001','ABIERTA',1,now(),
  '00000000-0000-0000-0000-000000000001'
);

insert into public.caja_sesion_terminales(
  empresa_id,local_id,session_id,terminal_id,desde
) values
('emp-a','loc-a','40000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001',now()),
('emp-a','loc-a','40000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002',now());

insert into public.caja_sesion_responsables(
  empresa_id,local_id,session_id,user_id,desde,asignado_por,motivo
) values (
  'emp-a','loc-a','40000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',now(),
  '00000000-0000-0000-0000-000000000001','TEST_A03'
);

insert into public.catalogo_tpv_productos(
  empresa_id,local_id,producto_id,currency_code,entidad_fiscal_id,nombre,unidad,
  fraccionable,precision_cantidad,precio_unitario,impuesto_pct,activo,version,snapshot_origen
) values (
  'emp-a','loc-a','prod-churros','EUR',
  '10000000-0000-0000-0000-000000000001',
  'Churros','ud',false,0,10.00000000,10.0000,true,7,
  '{"origen":"fixture-a03"}'::jsonb
);

select public.abc_abrir_cuenta(
  'a03.open.account.0001','emp-a','loc-a',
  '50000000-0000-0000-0000-000000000001',
  'BARRA','EUR',
  '00000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  '40000000-0000-0000-0000-000000000001',
  date '2026-09-23'
);

select public.abc_abrir_cuenta(
  'a03.open.account.0001','emp-a','loc-a',
  '50000000-0000-0000-0000-000000000001',
  'BARRA','EUR',
  '00000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  '40000000-0000-0000-0000-000000000001',
  date '2026-09-23'
);

do $$
begin
  if (select count(*) from public.cuentas_comerciales where id='50000000-0000-0000-0000-000000000001')<>1 then
    raise exception 'A03_FAIL: replay duplico cuenta';
  end if;
end $$;

select public.abc_crear_pedido(
  'a03.create.order.0001','emp-a','loc-a',
  '60000000-0000-0000-0000-000000000001',
  '50000000-0000-0000-0000-000000000001',
  1,
  '20000000-0000-0000-0000-000000000001',
  '40000000-0000-0000-0000-000000000001',
  date '2026-09-23'
);

select public.abc_agregar_linea_pedido(
  'a03.add.line.0001','emp-a','loc-a',
  '70000000-0000-0000-0000-000000000001',
  '60000000-0000-0000-0000-000000000001',
  'prod-churros',2,1,
  '20000000-0000-0000-0000-000000000001',
  '40000000-0000-0000-0000-000000000001',
  date '2026-09-23'
);

select public.abc_agregar_linea_pedido(
  'a03.add.line.0001','emp-a','loc-a',
  '70000000-0000-0000-0000-000000000001',
  '60000000-0000-0000-0000-000000000001',
  'prod-churros',2,1,
  '20000000-0000-0000-0000-000000000001',
  '40000000-0000-0000-0000-000000000001',
  date '2026-09-23'
);

do $$
begin
  if (select count(*) from public.pedido_lineas where id='70000000-0000-0000-0000-000000000001')<>1 then
    raise exception 'A03_FAIL: replay duplico linea';
  end if;
  if (select version from public.pedidos_tpv where id='60000000-0000-0000-0000-000000000001')<>2 then
    raise exception 'A03_FAIL: replay altero version pedido';
  end if;
end $$;

do $$
begin
  begin
    perform public.abc_agregar_linea_pedido(
      'a03.add.line.0001','emp-a','loc-a',
      '70000000-0000-0000-0000-000000000001',
      '60000000-0000-0000-0000-000000000001',
      'prod-churros',3,2,
      '20000000-0000-0000-0000-000000000001',
      '40000000-0000-0000-0000-000000000001',
      date '2026-09-23'
    );
    raise exception 'A03_FAIL: operation_id_conflict no rechazado';
  exception when others then
    if sqlerrm not like '%operation_id_conflict%' then raise; end if;
  end;
end $$;

do $$
begin
  begin
    perform public.abc_agregar_linea_pedido(
      'a03.add.line.stale.0001','emp-a','loc-a',
      '70000000-0000-0000-0000-000000000002',
      '60000000-0000-0000-0000-000000000001',
      'prod-churros',1,1,
      '20000000-0000-0000-0000-000000000002',
      '40000000-0000-0000-0000-000000000001',
      date '2026-09-23'
    );
    raise exception 'A03_FAIL: version vieja de segundo terminal aceptada';
  exception when others then
    if sqlerrm not like '%pedido_version_conflict%' then raise; end if;
  end;
end $$;

do $$
begin
  begin
    perform public.abc_agregar_linea_pedido(
      'a03.add.line.qty.0001','emp-a','loc-a',
      '70000000-0000-0000-0000-000000000003',
      '60000000-0000-0000-0000-000000000001',
      'prod-churros',1.5,2,
      '20000000-0000-0000-0000-000000000001',
      '40000000-0000-0000-0000-000000000001',
      date '2026-09-23'
    );
    raise exception 'A03_FAIL: cantidad fraccionaria aceptada';
  exception when others then
    if sqlerrm not like '%cantidad_no_fraccionable%' then raise; end if;
  end;
end $$;

do $$
begin
  begin
    perform public.abc_agregar_linea_pedido(
      'a03.add.line.context.0001','emp-a','loc-b',
      '70000000-0000-0000-0000-000000000004',
      '60000000-0000-0000-0000-000000000001',
      'prod-churros',1,2,
      '20000000-0000-0000-0000-000000000001',
      '40000000-0000-0000-0000-000000000001',
      date '2026-09-23'
    );
    raise exception 'A03_FAIL: contexto manipulado aceptado';
  exception when others then
    if sqlerrm not like '%abc_linea_no_autorizada%'
       and sqlerrm not like '%contexto_no_autorizado%'
       and sqlerrm not like '%terminal_sesion_no_operativa%' then
      raise;
    end if;
  end;
end $$;

select public.abc_actualizar_linea_pedido(
  'a03.update.line.0001','emp-a','loc-a',
  '70000000-0000-0000-0000-000000000001',
  3,1,2,
  '20000000-0000-0000-0000-000000000002',
  '40000000-0000-0000-0000-000000000001',
  date '2026-09-23'
);

select public.abc_confirmar_linea_pedido(
  'a03.confirm.line.0001','emp-a','loc-a',
  '70000000-0000-0000-0000-000000000001',
  2,3,
  '20000000-0000-0000-0000-000000000001',
  '40000000-0000-0000-0000-000000000001',
  date '2026-09-23'
);

do $$
declare
  v public.pedido_lineas%rowtype;
begin
  select * into v from public.pedido_lineas
   where id='70000000-0000-0000-0000-000000000001';

  if v.estado<>'CONFIRMADA' then raise exception 'A03_FAIL: linea no confirmada'; end if;
  if v.cantidad<>3 then raise exception 'A03_FAIL: cantidad final incorrecta %',v.cantidad; end if;
  if v.precio_unitario<>10 then raise exception 'A03_FAIL: precio no viene del catalogo %',v.precio_unitario; end if;
  if v.descuento_total<>0 then raise exception 'A03_FAIL: descuento A03 debe ser fail-closed %',v.descuento_total; end if;
  if v.base<>30 then raise exception 'A03_FAIL: base incorrecta %',v.base; end if;
  if v.impuestos<>3 then raise exception 'A03_FAIL: impuestos incorrectos %',v.impuestos; end if;
  if v.total<>33 then raise exception 'A03_FAIL: total incorrecto %',v.total; end if;
  if v.version<>3 then raise exception 'A03_FAIL: version linea incorrecta %',v.version; end if;
  if v.snapshot_comercial->>'catalog_version'<>'7' then raise exception 'A03_FAIL: snapshot catalogo'; end if;
  if v.snapshot_calculo->>'modo'<>'SERVER_AUTHORITY_A03' then raise exception 'A03_FAIL: snapshot calculo'; end if;

  if (select version from public.pedidos_tpv where id=v.pedido_id)<>4 then
    raise exception 'A03_FAIL: version final pedido';
  end if;
  if (select count(*) from public.abc_eventos where aggregate_type in ('CUENTA','PEDIDO','PEDIDO_LINEA'))<>5 then
    raise exception 'A03_FAIL: eventos esperados != 5';
  end if;
end $$;

do $$
begin
  begin
    perform public.abc_actualizar_linea_pedido(
      'a03.update.confirmed.0001','emp-a','loc-a',
      '70000000-0000-0000-0000-000000000001',
      4,3,4,
      '20000000-0000-0000-0000-000000000002',
      '40000000-0000-0000-0000-000000000001',
      date '2026-09-23'
    );
    raise exception 'A03_FAIL: linea confirmada modificada';
  exception when others then
    if sqlerrm not like '%linea_no_editable%' then raise; end if;
  end;
end $$;

do $$
begin
  if exists(select 1 from public.ventas_fiscales)
     or exists(select 1 from public.checkouts)
     or exists(select 1 from public.pagos) then
    raise exception 'A03_FAIL: A03 produjo efectos económicos posteriores';
  end if;
end $$;

select 'ABC_F3_A03_CONTRACT=PASS' as resultado;
