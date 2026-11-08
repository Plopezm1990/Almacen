\set ON_ERROR_STOP on

-- F4 · una cuenta se cobra también mientras cocina trabaja.
--
-- Fija las dos mitades de la regla, porque una sola no basta:
--   1. los seis estados de pedido que SÍ deben poder cobrarse, incluidos los
--      tres derivados que cocina produce ('EN_PREPARACION',
--      'PARCIALMENTE_PREPARADO', 'PREPARADO');
--   2. los tres que NO ('BORRADOR', 'ABIERTO', 'CANCELADO'), para que nadie
--      «arregle» esto abriendo la puerta de más.
--
-- Fixture propio (emp-f4k) para poder correr junto al contrato B02/B03.

do $$
begin
  if to_regprocedure('public.abc_preparar_checkout_cuenta(text,text,text,uuid,uuid,bigint,uuid,uuid,date)') is null then
    raise exception 'F4_COBRO_COCINA_FAIL: RPC puente ausente';
  end if;
end $$;

insert into auth.users(id) values ('11111111-2222-3333-4444-5555555555b1'::uuid);
insert into public.empresas(id,nombre,activo)
values ('emp-f4k','Empresa F4K ficticia',true);
insert into public.locales(id,empresa_id,nombre,activo)
values ('loc-f4k','emp-f4k','Local F4K ficticio',true);

select set_config('app.test_empresa','emp-f4k',false);
select set_config('app.test_local','loc-f4k',false);
select set_config('request.jwt.claim.sub','11111111-2222-3333-4444-5555555555b1',false);

insert into public.membresias_usuario(user_id,empresa_id,local_id,todos_locales,rol,activo)
values ('11111111-2222-3333-4444-5555555555b1','emp-f4k','loc-f4k',false,'Propietario',true);

insert into public.entidades_fiscales(
  id,empresa_id,nombre_legal,identificador_fiscal,country_code,simulada,activa
) values (
  '10000000-2222-3333-4444-5555555555b1','emp-f4k','Entidad F4K','SIM-F4K','ES',true,true
);
insert into public.entidad_fiscal_monedas(empresa_id,entidad_fiscal_id,currency_code,es_principal,activa)
values ('emp-f4k','10000000-2222-3333-4444-5555555555b1','EUR',true,true);
insert into public.entidad_fiscal_locales(empresa_id,local_id,entidad_fiscal_id,activa)
values ('emp-f4k','loc-f4k','10000000-2222-3333-4444-5555555555b1',true);
insert into public.entidad_fiscal_local_monedas(empresa_id,local_id,entidad_fiscal_id,currency_code,activa)
values ('emp-f4k','loc-f4k','10000000-2222-3333-4444-5555555555b1','EUR',true);

insert into public.terminales_tpv(id,empresa_id,local_id,nombre,device_key,activo)
values ('20000000-2222-3333-4444-5555555555b1','emp-f4k','loc-f4k','Terminal F4K','f4k-device',true);
insert into public.cajas_fisicas(id,empresa_id,local_id,nombre,activo)
values ('30000000-2222-3333-4444-5555555555b1','emp-f4k','loc-f4k','Caja F4K',true);
insert into public.caja_sesiones(
  id,empresa_id,local_id,caja_id,estado,version,abierta_at,abierta_por
) values (
  '40000000-2222-3333-4444-5555555555b1','emp-f4k','loc-f4k',
  '30000000-2222-3333-4444-5555555555b1','ABIERTA',1,now(),
  '11111111-2222-3333-4444-5555555555b1'
);
insert into public.caja_sesion_terminales(empresa_id,local_id,session_id,terminal_id,desde)
values ('emp-f4k','loc-f4k','40000000-2222-3333-4444-5555555555b1',
        '20000000-2222-3333-4444-5555555555b1',now());
insert into public.caja_sesion_responsables(
  empresa_id,local_id,session_id,user_id,desde,asignado_por,motivo
) values (
  'emp-f4k','loc-f4k','40000000-2222-3333-4444-5555555555b1',
  '11111111-2222-3333-4444-5555555555b1',now(),
  '11111111-2222-3333-4444-5555555555b1','TEST_F4_COBRO_COCINA'
);

-- Una cuenta y un pedido por cada estado que se va a probar. El estado de la
-- línea se elige para ser coherente con el del pedido, tal y como lo dejaría
-- private.abc_estado_agregado_pedido.
do $$
declare
  v_casos constant jsonb := jsonb_build_array(
    jsonb_build_object('n',1,'pedido','ENVIADO',               'linea','ENVIADA',       'cobrable',true),
    jsonb_build_object('n',2,'pedido','EN_PREPARACION',        'linea','EN_PREPARACION','cobrable',true),
    jsonb_build_object('n',3,'pedido','PARCIALMENTE_PREPARADO','linea','PREPARADA',     'cobrable',true),
    jsonb_build_object('n',4,'pedido','PREPARADO',             'linea','PREPARADA',     'cobrable',true),
    jsonb_build_object('n',5,'pedido','SERVIDO',               'linea','SERVIDA',       'cobrable',true),
    jsonb_build_object('n',6,'pedido','CERRADO',               'linea','SERVIDA',       'cobrable',true),
    jsonb_build_object('n',7,'pedido','BORRADOR',              'linea','CONFIRMADA',    'cobrable',false),
    jsonb_build_object('n',8,'pedido','ABIERTO',               'linea','CONFIRMADA',    'cobrable',false),
    jsonb_build_object('n',9,'pedido','CANCELADO',             'linea','CONFIRMADA',    'cobrable',false)
  );
  v_caso jsonb;
  v_sufijo text;
begin
  for v_caso in select value from jsonb_array_elements(v_casos) loop
    v_sufijo := lpad((v_caso->>'n'),2,'0');
    insert into public.cuentas_comerciales(
      id,empresa_id,local_id,currency_code,modalidad,estado,version,
      created_by,opened_operating_day,responsable_actual
    ) values (
      ('50000000-2222-3333-4444-555555555b'||v_sufijo)::uuid,'emp-f4k','loc-f4k',
      'EUR','BARRA','ABIERTA',1,'11111111-2222-3333-4444-5555555555b1','2026-10-31',
      '11111111-2222-3333-4444-5555555555b1'
    );
    insert into public.pedidos_tpv(
      id,empresa_id,local_id,cuenta_id,currency_code,estado,version,
      created_by,created_operating_day,closed_at
    ) values (
      ('60000000-2222-3333-4444-555555555b'||v_sufijo)::uuid,'emp-f4k','loc-f4k',
      ('50000000-2222-3333-4444-555555555b'||v_sufijo)::uuid,'EUR',
      v_caso->>'pedido',1,'11111111-2222-3333-4444-5555555555b1','2026-10-31',
      -- abc_pedido_cierre exige closed_at exactamente en estos dos estados.
      case when v_caso->>'pedido' in ('CERRADO','CANCELADO') then now() end
    );
    insert into public.pedido_lineas(
      id,empresa_id,local_id,pedido_id,producto_id,cantidad,unidad,estado,version,
      entidad_fiscal_id,currency_code,precio_unitario,descuento_total,base,impuestos,total,
      snapshot_comercial,snapshot_calculo,created_by,created_operating_day
    ) values (
      ('70000000-2222-3333-4444-555555555b'||v_sufijo)::uuid,'emp-f4k','loc-f4k',
      ('60000000-2222-3333-4444-555555555b'||v_sufijo)::uuid,'prod-f4k',1,'ud',
      v_caso->>'linea',1,
      '10000000-2222-3333-4444-5555555555b1','EUR',10,0,10,1,11,
      '{"test":true}','{"modo":"TEST_F4_COBRO_COCINA"}',
      '11111111-2222-3333-4444-5555555555b1','2026-10-31'
    );
  end loop;
end $$;

set role authenticated;

do $$
declare
  v_esperado constant jsonb := jsonb_build_object(
    '01',true,'02',true,'03',true,'04',true,'05',true,'06',true,
    '07',false,'08',false,'09',false
  );
  v_sufijo text;
  v_cobrable boolean;
  v_resultado jsonb;
  v_ok boolean;
  v_error text;
  v_fallos text[] := array[]::text[];
  v_estado text;
begin
  foreach v_sufijo in array array['01','02','03','04','05','06','07','08','09'] loop
    v_cobrable := (v_esperado->>v_sufijo)::boolean;
    select estado into v_estado from public.pedidos_tpv
     where id=('60000000-2222-3333-4444-555555555b'||v_sufijo)::uuid;
    v_ok := false;
    v_error := null;
    begin
      v_resultado := public.abc_preparar_checkout_cuenta(
        'f4k.cobro.'||v_sufijo,'emp-f4k','loc-f4k',
        ('80000000-2222-3333-4444-555555555b'||v_sufijo)::uuid,
        ('50000000-2222-3333-4444-555555555b'||v_sufijo)::uuid,1,
        '20000000-2222-3333-4444-5555555555b1',
        '40000000-2222-3333-4444-5555555555b1','2026-10-31'
      );
      v_ok := coalesce((v_resultado->>'ok')::boolean,false);
    exception when others then
      v_error := sqlerrm;
    end;

    if v_cobrable and not v_ok then
      v_fallos := v_fallos || format('%s (%s) debía cobrarse y falló: %s',
        v_sufijo, v_estado, coalesce(v_error,'ok=false'));
    elsif not v_cobrable and v_ok then
      v_fallos := v_fallos || format('%s (%s) NO debía cobrarse y se preparó el checkout',
        v_sufijo, v_estado);
    end if;
  end loop;

  if array_length(v_fallos,1) is not null then
    raise exception 'F4_COBRO_COCINA_FAIL: %', array_to_string(v_fallos,' | ');
  end if;
end $$;

reset role;

select 'ABC_F4_COBRO_COCINA=PASS' as result;
