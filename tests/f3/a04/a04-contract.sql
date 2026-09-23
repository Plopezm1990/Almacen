\set ON_ERROR_STOP on

-- A04 — contrato estructural, ACL, configuración, autoridad económica y concurrencia.
do $$
declare
  v_table text;
  v_sig text;
  v_oid oid;
  v_tables text[]:=array[
    'catalogo_tpv_grupos_opciones',
    'catalogo_tpv_producto_grupos',
    'catalogo_tpv_opciones',
    'pedido_linea_opciones'
  ];
  v_rpcs text[]:=array[
    'public.abc_agregar_linea_pedido_configurada(text,text,text,uuid,uuid,text,numeric,bigint,jsonb,bigint,uuid,uuid,date)',
    'public.abc_actualizar_linea_pedido_configurada(text,text,text,uuid,numeric,bigint,jsonb,bigint,bigint,uuid,uuid,date)',
    'public.abc_confirmar_linea_pedido_configurada(text,text,text,uuid,bigint,jsonb,bigint,bigint,uuid,uuid,date)'
  ];
begin
  foreach v_table in array v_tables loop
    if to_regclass('public.'||v_table) is null then
      raise exception 'A04_FAIL: tabla ausente %',v_table;
    end if;
    if not exists(
      select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
       where n.nspname='public' and c.relname=v_table and c.relrowsecurity
    ) then
      raise exception 'A04_FAIL: RLS no habilitado %',v_table;
    end if;
    if not has_table_privilege('authenticated','public.'||v_table,'SELECT')
       or has_table_privilege('authenticated','public.'||v_table,'INSERT')
       or has_table_privilege('authenticated','public.'||v_table,'UPDATE')
       or has_table_privilege('authenticated','public.'||v_table,'DELETE')
       or has_table_privilege('anon','public.'||v_table,'SELECT')
       or has_table_privilege('service_role','public.'||v_table,'SELECT') then
      raise exception 'A04_FAIL: ACL incorrecta %',v_table;
    end if;
  end loop;

  foreach v_sig in array v_rpcs loop
    v_oid:=to_regprocedure(v_sig);
    if v_oid is null then raise exception 'A04_FAIL: RPC ausente %',v_sig; end if;
    if not exists(
      select 1 from pg_proc
       where oid=v_oid and prosecdef and pg_get_userbyid(proowner)='postgres'
    ) then
      raise exception 'A04_FAIL: RPC no SECURITY DEFINER postgres %',v_sig;
    end if;
    if not has_function_privilege('authenticated',v_oid,'EXECUTE')
       or has_function_privilege('anon',v_oid,'EXECUTE')
       or has_function_privilege('service_role',v_oid,'EXECUTE') then
      raise exception 'A04_FAIL: ACL RPC incorrecta %',v_sig;
    end if;
    if pg_get_function_identity_arguments(v_oid) ~* '(precio|impuesto|iva|descuento|total|base)' then
      raise exception 'A04_FAIL: RPC acepta importes del cliente %',v_sig;
    end if;
  end loop;

  if has_function_privilege('authenticated','private.abc_normalizar_selecciones_tpv(jsonb)','EXECUTE')
     or has_function_privilege('authenticated','private.abc_calcular_linea_tpv_configurada(text,text,text,text,numeric,bigint,jsonb)','EXECUTE')
     or has_function_privilege('authenticated','private.abc_persistir_opciones_linea(text,text,uuid,jsonb,uuid,date)','EXECUTE')
     or has_function_privilege('authenticated','private.abc_mutar_linea_configurada(text,text,text,text,uuid,uuid,text,numeric,bigint,jsonb,bigint,bigint,uuid,uuid,date)','EXECUTE')
     or has_function_privilege('anon','private.abc_calcular_linea_tpv_configurada(text,text,text,text,numeric,bigint,jsonb)','EXECUTE')
     or has_function_privilege('service_role','private.abc_calcular_linea_tpv_configurada(text,text,text,text,numeric,bigint,jsonb)','EXECUTE') then
    raise exception 'A04_FAIL: helper privado expuesto';
  end if;

  if not exists(
    select 1 from pg_trigger
     where tgrelid='public.pedido_lineas'::regclass
       and tgname='abc_guard_linea_configurada'
       and not tgisinternal
  ) then
    raise exception 'A04_FAIL: guard de bypass ausente';
  end if;
end $$;

-- Datos completamente ficticios.
insert into auth.users(id) values
('00000000-0000-0000-0000-000000000003'),
('00000000-0000-0000-0000-000000000004');

insert into public.empresas(id,nombre,activo)
values ('emp-b','Empresa B ficticia',true);

insert into public.locales(id,empresa_id,nombre,activo)
values
('loc-b1','emp-b','Local B1',true),
('loc-b2','emp-b','Local B2',true);

select set_config('app.test_empresa','emp-b',false);
select set_config('app.test_local','loc-b1',false);
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',false);

insert into public.membresias_usuario(user_id,empresa_id,local_id,todos_locales,rol,activo)
values
('00000000-0000-0000-0000-000000000003','emp-b','loc-b1',false,'Propietario',true),
('00000000-0000-0000-0000-000000000004','emp-b','loc-b1',false,'Camarero/a',true);

insert into public.entidades_fiscales(
  id,empresa_id,nombre_legal,identificador_fiscal,country_code,simulada,activa
) values (
  '10000000-0000-0000-0000-000000000002','emp-b','Entidad B ficticia','SIM-B','ES',true,true
);

insert into public.entidad_fiscal_monedas(
  empresa_id,entidad_fiscal_id,currency_code,es_principal,activa
) values (
  'emp-b','10000000-0000-0000-0000-000000000002','EUR',true,true
);

insert into public.entidad_fiscal_locales(
  empresa_id,local_id,entidad_fiscal_id,activa
) values (
  'emp-b','loc-b1','10000000-0000-0000-0000-000000000002',true
);

insert into public.entidad_fiscal_local_monedas(
  empresa_id,local_id,entidad_fiscal_id,currency_code,activa
) values (
  'emp-b','loc-b1','10000000-0000-0000-0000-000000000002','EUR',true
);

insert into public.terminales_tpv(id,empresa_id,local_id,nombre,activo)
values
('20000000-0000-0000-0000-000000000003','emp-b','loc-b1','Terminal B1',true),
('20000000-0000-0000-0000-000000000004','emp-b','loc-b1','Terminal B2',true);

insert into public.cajas_fisicas(id,empresa_id,local_id,nombre,activo)
values ('30000000-0000-0000-0000-000000000002','emp-b','loc-b1','Caja B',true);

insert into public.caja_sesiones(
  id,empresa_id,local_id,caja_id,estado,version,abierta_at,abierta_por
) values (
  '40000000-0000-0000-0000-000000000002','emp-b','loc-b1',
  '30000000-0000-0000-0000-000000000002','ABIERTA',1,now(),
  '00000000-0000-0000-0000-000000000003'
);

insert into public.caja_sesion_terminales(
  empresa_id,local_id,session_id,terminal_id,desde
) values
('emp-b','loc-b1','40000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000003',now()),
('emp-b','loc-b1','40000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000004',now());

insert into public.caja_sesion_responsables(
  empresa_id,local_id,session_id,user_id,desde,asignado_por,motivo
) values (
  'emp-b','loc-b1','40000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000003',now(),
  '00000000-0000-0000-0000-000000000003','TEST_A04'
);

insert into public.catalogo_tpv_productos(
  empresa_id,local_id,producto_id,currency_code,entidad_fiscal_id,nombre,unidad,
  fraccionable,precision_cantidad,precio_unitario,impuesto_pct,activo,version,snapshot_origen
) values (
  'emp-b','loc-b1','prod-chocolate','EUR',
  '10000000-0000-0000-0000-000000000002',
  'Chocolate','ud',false,0,10.00000000,10.0000,true,7,
  '{"origen":"fixture-a04"}'::jsonb
);

insert into public.catalogo_tpv_grupos_opciones(
  id,empresa_id,local_id,nombre,tipo_grupo,orden,activo,version
) values
('80000000-0000-0000-0000-000000000001','emp-b','loc-b1','Tamaño','VARIANTE',1,true,2),
('80000000-0000-0000-0000-000000000002','emp-b','loc-b1','Extras','MODIFICADOR',2,true,4);

insert into public.catalogo_tpv_producto_grupos(
  empresa_id,local_id,producto_id,currency_code,grupo_id,
  min_selecciones,max_selecciones,orden,activo,version
) values
('emp-b','loc-b1','prod-chocolate','EUR','80000000-0000-0000-0000-000000000001',1,1,1,true,3),
('emp-b','loc-b1','prod-chocolate','EUR','80000000-0000-0000-0000-000000000002',0,2,2,true,5);

insert into public.catalogo_tpv_opciones(
  id,empresa_id,local_id,grupo_id,currency_code,nombre,tipo_opcion,
  delta_precio,hereda_impuesto,impuesto_pct,max_cantidad,orden,activo,version,snapshot_origen
) values
('81000000-0000-0000-0000-000000000001','emp-b','loc-b1','80000000-0000-0000-0000-000000000001','EUR',
 'Grande','VARIANTE',2,true,null,1,1,true,3,'{"codigo":"GRANDE"}'),
('81000000-0000-0000-0000-000000000002','emp-b','loc-b1','80000000-0000-0000-0000-000000000002','EUR',
 'Nata','EXTRA',1,false,21,1,1,true,6,'{"codigo":"NATA"}'),
('81000000-0000-0000-0000-000000000003','emp-b','loc-b1','80000000-0000-0000-0000-000000000002','EUR',
 'Sin azúcar','RETIRADA',0,true,null,1,2,true,1,'{"codigo":"SIN_AZUCAR"}'),
('81000000-0000-0000-0000-000000000004','emp-b','loc-b1','80000000-0000-0000-0000-000000000002','EUR',
 'Canela','COMPLEMENTO',0.5,true,null,1,3,true,2,'{"codigo":"CANELA"}');

select public.abc_abrir_cuenta(
  'a04.open.account.0001','emp-b','loc-b1',
  '50000000-0000-0000-0000-000000000002',
  'BARRA','EUR',
  '00000000-0000-0000-0000-000000000003',
  '20000000-0000-0000-0000-000000000003',
  '40000000-0000-0000-0000-000000000002',
  date '2026-09-23'
);

select public.abc_crear_pedido(
  'a04.create.order.0001','emp-b','loc-b1',
  '60000000-0000-0000-0000-000000000002',
  '50000000-0000-0000-0000-000000000002',
  1,
  '20000000-0000-0000-0000-000000000003',
  '40000000-0000-0000-0000-000000000002',
  date '2026-09-23'
);

-- La vía A03 plana no puede saltarse una variante obligatoria.
do $$
begin
  begin
    perform public.abc_agregar_linea_pedido(
      'a04.flat.bypass.0001','emp-b','loc-b1',
      '70000000-0000-0000-0000-000000000099',
      '60000000-0000-0000-0000-000000000002',
      'prod-chocolate',1,1,
      '20000000-0000-0000-0000-000000000003',
      '40000000-0000-0000-0000-000000000002',
      date '2026-09-23'
    );
    raise exception 'A04_FAIL: bypass plano aceptado';
  exception when others then
    if sqlerrm not like '%configuracion_requerida%' then raise; end if;
  end;
end $$;

select public.abc_agregar_linea_pedido_configurada(
  'a04.add.line.0001','emp-b','loc-b1',
  '70000000-0000-0000-0000-000000000002',
  '60000000-0000-0000-0000-000000000002',
  'prod-chocolate',2,7,
  jsonb_build_array(
    jsonb_build_object(
      'grupo_id','80000000-0000-0000-0000-000000000001',
      'opcion_id','81000000-0000-0000-0000-000000000001',
      'cantidad',1,
      'expected_group_version',2,
      'expected_product_group_version',3,
      'expected_option_version',3
    ),
    jsonb_build_object(
      'grupo_id','80000000-0000-0000-0000-000000000002',
      'opcion_id','81000000-0000-0000-0000-000000000002',
      'cantidad',1,
      'expected_group_version',4,
      'expected_product_group_version',5,
      'expected_option_version',6
    )
  ),
  1,
  '20000000-0000-0000-0000-000000000003',
  '40000000-0000-0000-0000-000000000002',
  date '2026-09-23'
);

-- Replay exacto: no duplica ni incrementa versiones.
select public.abc_agregar_linea_pedido_configurada(
  'a04.add.line.0001','emp-b','loc-b1',
  '70000000-0000-0000-0000-000000000002',
  '60000000-0000-0000-0000-000000000002',
  'prod-chocolate',2,7,
  jsonb_build_array(
    jsonb_build_object(
      'grupo_id','80000000-0000-0000-0000-000000000001',
      'opcion_id','81000000-0000-0000-0000-000000000001',
      'cantidad',1,'expected_group_version',2,'expected_product_group_version',3,'expected_option_version',3
    ),
    jsonb_build_object(
      'grupo_id','80000000-0000-0000-0000-000000000002',
      'opcion_id','81000000-0000-0000-0000-000000000002',
      'cantidad',1,'expected_group_version',4,'expected_product_group_version',5,'expected_option_version',6
    )
  ),
  1,
  '20000000-0000-0000-0000-000000000003',
  '40000000-0000-0000-0000-000000000002',
  date '2026-09-23'
);

do $$
begin
  if (select count(*) from public.pedido_lineas where id='70000000-0000-0000-0000-000000000002')<>1 then
    raise exception 'A04_FAIL: replay duplico linea';
  end if;
  if (select count(*) from public.pedido_linea_opciones where linea_id='70000000-0000-0000-0000-000000000002')<>2 then
    raise exception 'A04_FAIL: replay duplico opciones';
  end if;
  if (select version from public.pedidos_tpv where id='60000000-0000-0000-0000-000000000002')<>2 then
    raise exception 'A04_FAIL: replay altero version pedido';
  end if;
end $$;

-- Mismo operationId con otra intención debe fallar.
do $$
begin
  begin
    perform public.abc_agregar_linea_pedido_configurada(
      'a04.add.line.0001','emp-b','loc-b1',
      '70000000-0000-0000-0000-000000000002',
      '60000000-0000-0000-0000-000000000002',
      'prod-chocolate',3,7,'[]'::jsonb,2,
      '20000000-0000-0000-0000-000000000003',
      '40000000-0000-0000-0000-000000000002',
      date '2026-09-23'
    );
    raise exception 'A04_FAIL: operation_id_conflict no rechazado';
  exception when others then
    if sqlerrm not like '%operation_id_conflict%' then raise; end if;
  end;
end $$;

-- Segundo terminal con versión obsoleta.
do $$
begin
  begin
    perform public.abc_agregar_linea_pedido_configurada(
      'a04.stale.terminal.0001','emp-b','loc-b1',
      '70000000-0000-0000-0000-000000000003',
      '60000000-0000-0000-0000-000000000002',
      'prod-chocolate',1,7,
      jsonb_build_array(jsonb_build_object(
        'grupo_id','80000000-0000-0000-0000-000000000001',
        'opcion_id','81000000-0000-0000-0000-000000000001',
        'cantidad',1,'expected_group_version',2,'expected_product_group_version',3,'expected_option_version',3
      )),
      1,
      '20000000-0000-0000-0000-000000000004',
      '40000000-0000-0000-0000-000000000002',
      date '2026-09-23'
    );
    raise exception 'A04_FAIL: version stale aceptada';
  exception when others then
    if sqlerrm not like '%pedido_version_conflict%' then raise; end if;
  end;
end $$;

-- Una línea configurada tampoco puede ser sobrescrita por UPDATE A03.
do $$
begin
  begin
    perform public.abc_actualizar_linea_pedido(
      'a04.flat.update.0001','emp-b','loc-b1',
      '70000000-0000-0000-0000-000000000002',
      4,1,2,
      '20000000-0000-0000-0000-000000000004',
      '40000000-0000-0000-0000-000000000002',
      date '2026-09-23'
    );
    raise exception 'A04_FAIL: update plano sobre linea configurada aceptado';
  exception when others then
    if sqlerrm not like '%configuracion_requerida%'
       and sqlerrm not like '%linea_configurada_requiere_rpc_configurada%' then
      raise;
    end if;
  end;
end $$;

-- Variante obligatoria omitida.
do $$
begin
  begin
    perform public.abc_actualizar_linea_pedido_configurada(
      'a04.required.0001','emp-b','loc-b1',
      '70000000-0000-0000-0000-000000000002',
      3,7,
      jsonb_build_array(jsonb_build_object(
        'grupo_id','80000000-0000-0000-0000-000000000002',
        'opcion_id','81000000-0000-0000-0000-000000000002',
        'cantidad',1,'expected_group_version',4,'expected_product_group_version',5,'expected_option_version',6
      )),
      1,2,
      '20000000-0000-0000-0000-000000000004',
      '40000000-0000-0000-0000-000000000002',
      date '2026-09-23'
    );
    raise exception 'A04_FAIL: variante obligatoria omitida';
  exception when others then
    if sqlerrm not like '%grupo_min_selecciones_incumplido%' then raise; end if;
  end;
end $$;

-- Máximo del grupo Extras = 2; tres selecciones deben fallar.
do $$
begin
  begin
    perform public.abc_actualizar_linea_pedido_configurada(
      'a04.max.0001','emp-b','loc-b1',
      '70000000-0000-0000-0000-000000000002',
      3,7,
      jsonb_build_array(
        jsonb_build_object(
          'grupo_id','80000000-0000-0000-0000-000000000001',
          'opcion_id','81000000-0000-0000-0000-000000000001',
          'cantidad',1,'expected_group_version',2,'expected_product_group_version',3,'expected_option_version',3
        ),
        jsonb_build_object(
          'grupo_id','80000000-0000-0000-0000-000000000002',
          'opcion_id','81000000-0000-0000-0000-000000000002',
          'cantidad',1,'expected_group_version',4,'expected_product_group_version',5,'expected_option_version',6
        ),
        jsonb_build_object(
          'grupo_id','80000000-0000-0000-0000-000000000002',
          'opcion_id','81000000-0000-0000-0000-000000000003',
          'cantidad',1,'expected_group_version',4,'expected_product_group_version',5,'expected_option_version',1
        ),
        jsonb_build_object(
          'grupo_id','80000000-0000-0000-0000-000000000002',
          'opcion_id','81000000-0000-0000-0000-000000000004',
          'cantidad',1,'expected_group_version',4,'expected_product_group_version',5,'expected_option_version',2
        )
      ),
      1,2,
      '20000000-0000-0000-0000-000000000004',
      '40000000-0000-0000-0000-000000000002',
      date '2026-09-23'
    );
    raise exception 'A04_FAIL: max selecciones no aplicado';
  exception when others then
    if sqlerrm not like '%grupo_max_selecciones_excedido%' then raise; end if;
  end;
end $$;

-- Actualización válida por el segundo terminal.
select public.abc_actualizar_linea_pedido_configurada(
  'a04.update.line.0001','emp-b','loc-b1',
  '70000000-0000-0000-0000-000000000002',
  3,7,
  jsonb_build_array(
    jsonb_build_object(
      'grupo_id','80000000-0000-0000-0000-000000000001',
      'opcion_id','81000000-0000-0000-0000-000000000001',
      'cantidad',1,'expected_group_version',2,'expected_product_group_version',3,'expected_option_version',3
    ),
    jsonb_build_object(
      'grupo_id','80000000-0000-0000-0000-000000000002',
      'opcion_id','81000000-0000-0000-0000-000000000002',
      'cantidad',1,'expected_group_version',4,'expected_product_group_version',5,'expected_option_version',6
    )
  ),
  1,2,
  '20000000-0000-0000-0000-000000000004',
  '40000000-0000-0000-0000-000000000002',
  date '2026-09-23'
);

-- Confirmación A03 plana tampoco puede quitar la configuración.
do $$
begin
  begin
    perform public.abc_confirmar_linea_pedido(
      'a04.flat.confirm.0001','emp-b','loc-b1',
      '70000000-0000-0000-0000-000000000002',
      2,3,
      '20000000-0000-0000-0000-000000000003',
      '40000000-0000-0000-0000-000000000002',
      date '2026-09-23'
    );
    raise exception 'A04_FAIL: confirmacion plana aceptada';
  exception when others then
    if sqlerrm not like '%configuracion_requerida%'
       and sqlerrm not like '%linea_configurada_requiere_rpc_configurada%' then
      raise;
    end if;
  end;
end $$;

-- Cambio de catálogo concurrente: Grande pasa de +2/version 3 a +3/version 4.
update public.catalogo_tpv_opciones
   set delta_precio=3,version=4,updated_at=now()
 where id='81000000-0000-0000-0000-000000000001';

-- Confirmar con la versión vista antes del cambio debe fallar.
do $$
begin
  begin
    perform public.abc_confirmar_linea_pedido_configurada(
      'a04.confirm.stale.catalog.0001','emp-b','loc-b1',
      '70000000-0000-0000-0000-000000000002',
      7,
      jsonb_build_array(
        jsonb_build_object(
          'grupo_id','80000000-0000-0000-0000-000000000001',
          'opcion_id','81000000-0000-0000-0000-000000000001',
          'cantidad',1,'expected_group_version',2,'expected_product_group_version',3,'expected_option_version',3
        ),
        jsonb_build_object(
          'grupo_id','80000000-0000-0000-0000-000000000002',
          'opcion_id','81000000-0000-0000-0000-000000000002',
          'cantidad',1,'expected_group_version',4,'expected_product_group_version',5,'expected_option_version',6
        )
      ),
      2,3,
      '20000000-0000-0000-0000-000000000003',
      '40000000-0000-0000-0000-000000000002',
      date '2026-09-23'
    );
    raise exception 'A04_FAIL: catalogo stale aceptado';
  exception when others then
    if sqlerrm not like '%catalogo_opcion_version_conflict%' then raise; end if;
  end;
end $$;

-- Confirmación con catálogo vigente.
select public.abc_confirmar_linea_pedido_configurada(
  'a04.confirm.line.0001','emp-b','loc-b1',
  '70000000-0000-0000-0000-000000000002',
  7,
  jsonb_build_array(
    jsonb_build_object(
      'grupo_id','80000000-0000-0000-0000-000000000001',
      'opcion_id','81000000-0000-0000-0000-000000000001',
      'cantidad',1,'expected_group_version',2,'expected_product_group_version',3,'expected_option_version',4
    ),
    jsonb_build_object(
      'grupo_id','80000000-0000-0000-0000-000000000002',
      'opcion_id','81000000-0000-0000-0000-000000000002',
      'cantidad',1,'expected_group_version',4,'expected_product_group_version',5,'expected_option_version',6
    )
  ),
  2,3,
  '20000000-0000-0000-0000-000000000003',
  '40000000-0000-0000-0000-000000000002',
  date '2026-09-23'
);

do $$
declare
  v public.pedido_lineas%rowtype;
  v_variant public.pedido_linea_opciones%rowtype;
  v_extra public.pedido_linea_opciones%rowtype;
begin
  select * into v from public.pedido_lineas
   where id='70000000-0000-0000-0000-000000000002';

  if v.estado<>'CONFIRMADA' then raise exception 'A04_FAIL: linea no confirmada'; end if;
  if v.cantidad<>3 then raise exception 'A04_FAIL: cantidad final %',v.cantidad; end if;
  if v.precio_unitario<>14 then raise exception 'A04_FAIL: precio configurado %',v.precio_unitario; end if;
  if v.descuento_total<>0 then raise exception 'A04_FAIL: descuento no fail-closed %',v.descuento_total; end if;
  if v.base<>42 then raise exception 'A04_FAIL: base final %',v.base; end if;
  if v.impuestos<>4.53 then raise exception 'A04_FAIL: impuestos finales %',v.impuestos; end if;
  if v.total<>46.53 then raise exception 'A04_FAIL: total final %',v.total; end if;
  if v.version<>3 then raise exception 'A04_FAIL: version linea %',v.version; end if;
  if v.snapshot_calculo->>'modo'<>'SERVER_AUTHORITY_A04' then
    raise exception 'A04_FAIL: snapshot calculo no A04';
  end if;
  if jsonb_array_length(v.snapshot_comercial->'opciones')<>2 then
    raise exception 'A04_FAIL: snapshot opciones incompleto';
  end if;

  if (select version from public.pedidos_tpv where id=v.pedido_id)<>4 then
    raise exception 'A04_FAIL: version final pedido';
  end if;
  if (select count(*) from public.pedido_linea_opciones where linea_id=v.id)<>2 then
    raise exception 'A04_FAIL: historico estructurado opciones';
  end if;

  select * into v_variant from public.pedido_linea_opciones
   where linea_id=v.id and opcion_id='81000000-0000-0000-0000-000000000001';
  if v_variant.delta_precio_unitario<>3
     or v_variant.impuesto_pct<>10
     or v_variant.base<>9
     or v_variant.impuestos<>0.9
     or v_variant.total<>9.9
     or v_variant.catalog_option_version<>4 then
    raise exception 'A04_FAIL: snapshot variante incorrecto';
  end if;

  select * into v_extra from public.pedido_linea_opciones
   where linea_id=v.id and opcion_id='81000000-0000-0000-0000-000000000002';
  if v_extra.delta_precio_unitario<>1
     or v_extra.impuesto_pct<>21
     or v_extra.base<>3
     or v_extra.impuestos<>0.63
     or v_extra.total<>3.63
     or v_extra.catalog_option_version<>6 then
    raise exception 'A04_FAIL: IVA propio extra incorrecto';
  end if;

  if (select count(*) from public.abc_eventos where operation_id like 'a04.%')<>5 then
    raise exception 'A04_FAIL: eventos exitosos esperados != 5';
  end if;
  if exists(select 1 from public.ventas_fiscales where empresa_id='emp-b')
     or exists(select 1 from public.checkouts where empresa_id='emp-b')
     or exists(select 1 from public.pagos where empresa_id='emp-b') then
    raise exception 'A04_FAIL: A04 produjo efectos económicos posteriores';
  end if;
end $$;

select 'ABC_F3_A04_CONTRACT=PASS' as resultado;
