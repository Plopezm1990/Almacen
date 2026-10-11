\set ON_ERROR_STOP on

do $$
declare missing text[];
begin
  select array_agg(x) into missing
  from unnest(array[
    'entidades_fiscales','entidad_fiscal_monedas','entidad_fiscal_locales',
    'entidad_fiscal_local_monedas','cuentas_comerciales','pedidos_tpv',
    'pedido_lineas','ventas_fiscales','venta_fiscal_lineas'
  ]) x
  where to_regclass('public.'||x) is null;
  if missing is not null then
    raise exception 'M02A tablas ausentes: %',missing;
  end if;
end $$;

insert into public.empresas(id,nombre) values
  ('E1','Empresa 1'),
  ('E2','Empresa 2');

insert into public.locales(id,empresa_id,nombre) values
  ('L1','E1','Local 1'),
  ('L2','E2','Local 2');

insert into auth.users(id) values
  ('11111111-1111-1111-1111-111111111111'),
  ('22222222-2222-2222-2222-222222222222');

insert into public.entidades_fiscales(
  id,empresa_id,nombre_legal,identificador_fiscal,country_code,simulada
) values
  ('10000000-0000-0000-0000-000000000001','E1','Entidad Fiscal E1','SIM-E1','ES',true),
  ('20000000-0000-0000-0000-000000000002','E2','Entidad Fiscal E2','SIM-E2','ES',true);

insert into public.entidad_fiscal_monedas(
  empresa_id,entidad_fiscal_id,currency_code,es_principal,activa
) values
  ('E1','10000000-0000-0000-0000-000000000001','EUR',true,true),
  ('E1','10000000-0000-0000-0000-000000000001','USD',false,true),
  ('E2','20000000-0000-0000-0000-000000000002','EUR',true,true);

do $$
begin
  begin
    insert into public.entidad_fiscal_monedas(
      empresa_id,entidad_fiscal_id,currency_code,es_principal,activa
    ) values (
      'E1','10000000-0000-0000-0000-000000000001','GBP',true,true
    );
    raise exception 'M02A_FAIL: dos monedas principales aceptadas';
  exception when unique_violation then null;
  end;
end $$;

insert into public.entidad_fiscal_locales(
  empresa_id,local_id,entidad_fiscal_id,activa
) values
  ('E1','L1','10000000-0000-0000-0000-000000000001',true),
  ('E2','L2','20000000-0000-0000-0000-000000000002',true);

do $$
begin
  begin
    insert into public.entidad_fiscal_locales(
      empresa_id,local_id,entidad_fiscal_id,activa
    ) values (
      'E2','L2','10000000-0000-0000-0000-000000000001',true
    );
    raise exception 'M02A_FAIL: asociación cross-tenant aceptada';
  exception when foreign_key_violation then null;
  end;
end $$;

insert into public.entidad_fiscal_local_monedas(
  empresa_id,local_id,entidad_fiscal_id,currency_code,activa
) values
  ('E1','L1','10000000-0000-0000-0000-000000000001','EUR',true),
  ('E1','L1','10000000-0000-0000-0000-000000000001','USD',true),
  ('E2','L2','20000000-0000-0000-0000-000000000002','EUR',true);

do $$
begin
  begin
    insert into public.entidad_fiscal_local_monedas(
      empresa_id,local_id,entidad_fiscal_id,currency_code,activa
    ) values (
      'E1','L1','10000000-0000-0000-0000-000000000001','GBP',true
    );
    raise exception 'M02A_FAIL: moneda local no habilitada en entidad aceptada';
  exception when foreign_key_violation then null;
  end;
end $$;

insert into public.cuentas_comerciales(
  id,empresa_id,local_id,currency_code,modalidad,estado,version,
  responsable_actual,created_by,opened_at,opened_operating_day
) values
  ('30000000-0000-0000-0000-000000000003','E1','L1','EUR','MESA','ABIERTA',1,
   '11111111-1111-1111-1111-111111111111',
   '11111111-1111-1111-1111-111111111111',
   now(),'2026-09-23'),
  ('40000000-0000-0000-0000-000000000004','E2','L2','EUR','BARRA','ABIERTA',1,
   '22222222-2222-2222-2222-222222222222',
   '22222222-2222-2222-2222-222222222222',
   now(),'2026-09-23');

insert into public.pedidos_tpv(
  id,empresa_id,local_id,cuenta_id,currency_code,estado,version,
  created_by,created_operating_day
) values (
  '50000000-0000-0000-0000-000000000005','E1','L1',
  '30000000-0000-0000-0000-000000000003','EUR','ABIERTO',1,
  '11111111-1111-1111-1111-111111111111','2026-09-23'
);

do $$
begin
  begin
    insert into public.pedidos_tpv(
      id,empresa_id,local_id,cuenta_id,currency_code,estado,version,
      created_by,created_operating_day
    ) values (
      '50000000-0000-0000-0000-000000000006','E2','L2',
      '30000000-0000-0000-0000-000000000003','EUR','ABIERTO',1,
      '22222222-2222-2222-2222-222222222222','2026-09-23'
    );
    raise exception 'M02A_FAIL: pedido cross-tenant aceptado';
  exception when foreign_key_violation then null;
  end;
end $$;

insert into public.pedido_lineas(
  id,empresa_id,local_id,pedido_id,producto_id,cantidad,unidad,estado,version,
  entidad_fiscal_id,currency_code,precio_unitario,descuento_total,base,impuestos,total,
  snapshot_comercial,snapshot_calculo,created_by,created_operating_day
) values (
  '60000000-0000-0000-0000-000000000006','E1','L1',
  '50000000-0000-0000-0000-000000000005','PROD-1',2,'UNIDAD','CONFIRMADA',1,
  '10000000-0000-0000-0000-000000000001','EUR',
  5,1,9,0.90,9.90,
  '{"descripcion":"Producto 1"}','{"rule_version":"v1"}',
  '11111111-1111-1111-1111-111111111111','2026-09-23'
);

insert into public.pedido_lineas(
  id,empresa_id,local_id,pedido_id,producto_id,cantidad,unidad,estado,version,
  entidad_fiscal_id,currency_code,
  snapshot_comercial,snapshot_calculo,created_by,created_operating_day
) values (
  '60000000-0000-0000-0000-000000000007','E1','L1',
  '50000000-0000-0000-0000-000000000005','PROD-DRAFT',1,'UNIDAD','BORRADOR',1,
  null,'EUR','{}','{}',
  '11111111-1111-1111-1111-111111111111','2026-09-23'
);

do $$
begin
  begin
    insert into public.pedido_lineas(
      id,empresa_id,local_id,pedido_id,producto_id,cantidad,unidad,estado,version,
      entidad_fiscal_id,currency_code,precio_unitario,descuento_total,base,impuestos,total,
      snapshot_comercial,snapshot_calculo,created_by,created_operating_day
    ) values (
      '60000000-0000-0000-0000-000000000008','E1','L1',
      '50000000-0000-0000-0000-000000000005','PROD-2',1,'UNIDAD','CONFIRMADA',1,
      null,'EUR',5,0,5,0.5,5.5,'{}','{}',
      '11111111-1111-1111-1111-111111111111','2026-09-23'
    );
    raise exception 'M02A_FAIL: línea confirmada sin emisor aceptada';
  exception when check_violation then null;
  end;
end $$;

insert into public.ventas_fiscales(
  id,empresa_id,local_id,cuenta_id,entidad_fiscal_id,currency_code,estado,version,
  subtotal,descuento_total,impuestos_total,total,snapshot_calculo,
  created_by,created_operating_day
) values (
  '70000000-0000-0000-0000-000000000007','E1','L1',
  '30000000-0000-0000-0000-000000000003',
  '10000000-0000-0000-0000-000000000001','EUR','ABIERTA',1,
  10,1,0.90,9.90,'{"rule_version":"v1"}',
  '11111111-1111-1111-1111-111111111111','2026-09-23'
);

do $$
begin
  begin
    insert into public.ventas_fiscales(
      id,empresa_id,local_id,cuenta_id,entidad_fiscal_id,currency_code,estado,version,
      subtotal,descuento_total,impuestos_total,total,snapshot_calculo,
      created_by,created_operating_day
    ) values (
      '70000000-0000-0000-0000-000000000008','E1','L1',
      '30000000-0000-0000-0000-000000000003',
      '10000000-0000-0000-0000-000000000001','USD','ABIERTA',1,
      1,0,0,1,'{}',
      '11111111-1111-1111-1111-111111111111','2026-09-23'
    );
    raise exception 'M02A_FAIL: venta en moneda distinta de la cuenta aceptada';
  exception when foreign_key_violation then null;
  end;
end $$;

insert into public.venta_fiscal_lineas(
  id,empresa_id,local_id,venta_fiscal_id,source_line_id,entidad_fiscal_id,currency_code,
  cantidad,precio_unitario,descuento,base,impuesto,total,snapshot
) values (
  '80000000-0000-0000-0000-000000000008','E1','L1',
  '70000000-0000-0000-0000-000000000007',
  '60000000-0000-0000-0000-000000000006',
  '10000000-0000-0000-0000-000000000001','EUR',
  2,5,1,9,0.90,9.90,'{"source":"L1"}'
);

do $$
begin
  begin
    insert into public.venta_fiscal_lineas(
      id,empresa_id,local_id,venta_fiscal_id,source_line_id,entidad_fiscal_id,currency_code,
      cantidad,precio_unitario,descuento,base,impuesto,total,snapshot
    ) values (
      '80000000-0000-0000-0000-000000000009','E1','L1',
      '70000000-0000-0000-0000-000000000007',
      '60000000-0000-0000-0000-000000000006',
      '10000000-0000-0000-0000-000000000001','USD',
      1,1,0,1,0,1,'{}'
    );
    raise exception 'M02A_FAIL: línea fiscal con moneda incoherente aceptada';
  exception when foreign_key_violation then null;
  end;
end $$;

-- ACL: SELECT únicamente para authenticated, nada para anon ni mutación directa.
do $$
declare v_count integer;
begin
  select count(*) into v_count
  from pg_policies
  where schemaname='public'
    and tablename in (
      'entidades_fiscales','entidad_fiscal_monedas','entidad_fiscal_locales',
      'entidad_fiscal_local_monedas','cuentas_comerciales','pedidos_tpv',
      'pedido_lineas','ventas_fiscales','venta_fiscal_lineas'
    )
    and cmd='SELECT';
  if v_count <> 9 then
    raise exception 'M02A_FAIL: esperaba 9 policies SELECT y obtuvo %',v_count;
  end if;

  if exists (
    select 1 from information_schema.role_table_grants
    where table_schema='public'
      and table_name in (
        'entidades_fiscales','entidad_fiscal_monedas','entidad_fiscal_locales',
        'entidad_fiscal_local_monedas','cuentas_comerciales','pedidos_tpv',
        'pedido_lineas','ventas_fiscales','venta_fiscal_lineas'
      )
      and grantee='authenticated'
      and privilege_type in ('INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER')
  ) then
    raise exception 'M02A_FAIL: authenticated conserva privilegios no permitidos';
  end if;

  if exists (
    select 1 from information_schema.role_table_grants
    where table_schema='public'
      and table_name in (
        'entidades_fiscales','entidad_fiscal_monedas','entidad_fiscal_locales',
        'entidad_fiscal_local_monedas','cuentas_comerciales','pedidos_tpv',
        'pedido_lineas','ventas_fiscales','venta_fiscal_lineas'
      )
      and grantee='anon'
  ) then
    raise exception 'M02A_FAIL: anon conserva privilegios directos';
  end if;

  select count(distinct table_name) into v_count
  from information_schema.role_table_grants
  where table_schema='public'
    and table_name in (
      'entidades_fiscales','entidad_fiscal_monedas','entidad_fiscal_locales',
      'entidad_fiscal_local_monedas','cuentas_comerciales','pedidos_tpv',
      'pedido_lineas','ventas_fiscales','venta_fiscal_lineas'
    )
    and grantee='authenticated' and privilege_type='SELECT';
  if v_count <> 9 then
    raise exception 'M02A_FAIL: SELECT authenticated no cubre las 9 tablas: %',v_count;
  end if;
end $$;

set role authenticated;
select set_config('app.test_empresa','E1',false);
select set_config('app.test_local','L1',false);

do $$
declare n integer;
begin
  select count(*) into n from public.entidades_fiscales;
  if n<>1 then raise exception 'M02A_FAIL: RLS entidades esperaba 1 y obtuvo %',n; end if;

  select count(*) into n from public.cuentas_comerciales;
  if n<>1 then raise exception 'M02A_FAIL: RLS cuentas esperaba 1 y obtuvo %',n; end if;

  select count(*) into n from public.entidad_fiscal_local_monedas;
  if n<>2 then raise exception 'M02A_FAIL: RLS monedas local esperaba 2 y obtuvo %',n; end if;
end $$;

reset role;

select 'ABC_F2_M02A_CONTRACT=PASS' as resultado;
