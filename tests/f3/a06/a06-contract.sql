\set ON_ERROR_STOP on

-- A06 — recuperación persistente, cross-terminal, replay y responsable.

do $$
declare
  v_sig text;
  v_oid oid;
  v_rpcs text[]:=array[
    'public.abc_recuperar_cuenta(text,text,uuid,uuid,uuid,date)',
    'public.abc_listar_cuentas_recuperables(text,text,uuid,uuid,date,integer)',
    'public.abc_consultar_operacion(text,text,text)',
    'public.abc_cambiar_responsable_cuenta(text,text,text,uuid,uuid,text,bigint,uuid,uuid,date)'
  ];
  v_capdef text;
begin
  foreach v_sig in array v_rpcs loop
    v_oid:=to_regprocedure(v_sig);
    if v_oid is null then raise exception 'A06_FAIL: RPC ausente %',v_sig; end if;
    if not exists(
      select 1 from pg_proc
      where oid=v_oid
        and prosecdef
        and pg_get_userbyid(proowner)='postgres'
        and coalesce(proconfig,'{}')::text like '%search_path=%'
    ) then
      raise exception 'A06_FAIL: contrato SECURITY DEFINER/owner/search_path %',v_sig;
    end if;
    if not has_function_privilege('authenticated',v_oid,'EXECUTE')
       or has_function_privilege('anon',v_oid,'EXECUTE')
       or has_function_privilege('service_role',v_oid,'EXECUTE') then
      raise exception 'A06_FAIL: ACL RPC incorrecta %',v_sig;
    end if;
  end loop;

  if has_function_privilege('authenticated','private.abc_ultima_actividad_cuenta(text,text,uuid)','EXECUTE')
     or has_function_privilege('authenticated','private.abc_revision_cuenta(text,text,uuid)','EXECUTE')
     or has_function_privilege('anon','private.abc_revision_cuenta(text,text,uuid)','EXECUTE')
     or has_function_privilege('service_role','private.abc_revision_cuenta(text,text,uuid)','EXECUTE') then
    raise exception 'A06_FAIL: helper privado expuesto';
  end if;

  if has_table_privilege('authenticated','public.abc_operaciones','SELECT')
     or has_table_privilege('authenticated','public.abc_eventos','SELECT')
     or has_table_privilege('anon','public.abc_operaciones','SELECT')
     or has_table_privilege('anon','public.abc_eventos','SELECT')
     or has_table_privilege('service_role','public.abc_operaciones','SELECT')
     or has_table_privilege('service_role','public.abc_eventos','SELECT') then
    raise exception 'A06_FAIL: tablas internas expuestas directamente';
  end if;

  if (select provolatile from pg_proc where oid=to_regprocedure(
        'public.abc_recuperar_cuenta(text,text,uuid,uuid,uuid,date)'
      ))<>'s'
     or (select provolatile from pg_proc where oid=to_regprocedure(
        'public.abc_listar_cuentas_recuperables(text,text,uuid,uuid,date,integer)'
      ))<>'s'
     or (select provolatile from pg_proc where oid=to_regprocedure(
        'public.abc_consultar_operacion(text,text,text)'
      ))<>'s'
     or (select provolatile from pg_proc where oid=to_regprocedure(
        'public.abc_cambiar_responsable_cuenta(text,text,text,uuid,uuid,text,bigint,uuid,uuid,date)'
      ))<>'v' then
    raise exception 'A06_FAIL: volatilidad RPC incorrecta';
  end if;

  v_capdef:=pg_get_functiondef(to_regprocedure('private.abc_tiene_capacidad(text,text,text)'));
  if v_capdef not like '%ABC_CUENTA_OPERAR%'
     or v_capdef not like '%ABC_CUENTA_REASIGNAR%'
     or v_capdef not like '%ABC_COBRO_INICIAR%'
     or v_capdef not like '%ABC_CAJA_OPERAR%'
     or v_capdef not like '%ABC_PEDIDO_ENVIAR%'
     or v_capdef not like '%ABC_PREPARACION_INICIAR%'
     or v_capdef not like '%ABC_PREPARACION_COMPLETAR%'
     or v_capdef not like '%ABC_PEDIDO_SERVIR%'
     or v_capdef not like '%ABC_CANCELACION_SENSIBLE%' then
    raise exception 'A06_FAIL: capacidades existentes/nueva incompletas';
  end if;

  if to_regprocedure('public.abc_reabrir_cuenta(text,text,text,uuid,bigint,uuid,uuid,date)') is not null
     or to_regprocedure('public.abc_cerrar_cuenta(text,text,text,uuid,bigint,uuid,uuid,date)') is not null then
    raise exception 'A06_FAIL: A06 no debe habilitar reapertura/cierre de cuenta';
  end if;
end $$;

-- Datos ficticios A06.
insert into auth.users(id) values
('00000000-0000-0000-0000-000000000008'),
('00000000-0000-0000-0000-000000000009'),
('00000000-0000-0000-0000-000000000010');

insert into public.empresas(id,nombre,activo)
values ('emp-d','Empresa D ficticia',true);

insert into public.locales(id,empresa_id,nombre,activo)
values
('loc-d1','emp-d','Local D1',true),
('loc-d2','emp-d','Local D2',true);

select set_config('app.test_empresa','emp-d',false);
select set_config('app.test_local','loc-d1',false);
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000008',false);

insert into public.membresias_usuario(user_id,empresa_id,local_id,todos_locales,rol,activo)
values
('00000000-0000-0000-0000-000000000008','emp-d','loc-d1',false,'Propietario',true),
('00000000-0000-0000-0000-000000000009','emp-d','loc-d1',false,'Encargado',true),
('00000000-0000-0000-0000-000000000010','emp-d','loc-d2',false,'Encargado',true);

insert into public.entidades_fiscales(
  id,empresa_id,nombre_legal,identificador_fiscal,country_code,simulada,activa
) values (
  '10000000-0000-0000-0000-000000000004',
  'emp-d','Entidad D ficticia','SIM-D','ES',true,true
);

insert into public.entidad_fiscal_monedas(
  empresa_id,entidad_fiscal_id,currency_code,es_principal,activa
) values (
  'emp-d','10000000-0000-0000-0000-000000000004','EUR',true,true
);

insert into public.entidad_fiscal_locales(
  empresa_id,local_id,entidad_fiscal_id,activa
) values (
  'emp-d','loc-d1','10000000-0000-0000-0000-000000000004',true
);

insert into public.entidad_fiscal_local_monedas(
  empresa_id,local_id,entidad_fiscal_id,currency_code,activa
) values (
  'emp-d','loc-d1','10000000-0000-0000-0000-000000000004','EUR',true
);

insert into public.terminales_tpv(id,empresa_id,local_id,nombre,activo)
values
('20000000-0000-0000-0000-000000000007','emp-d','loc-d1','Terminal D1',true),
('20000000-0000-0000-0000-000000000008','emp-d','loc-d1','Terminal D2',true);

insert into public.cajas_fisicas(id,empresa_id,local_id,nombre,activo)
values ('30000000-0000-0000-0000-000000000004','emp-d','loc-d1','Caja D',true);

insert into public.caja_sesiones(
  id,empresa_id,local_id,caja_id,estado,version,abierta_at,abierta_por
) values (
  '40000000-0000-0000-0000-000000000004','emp-d','loc-d1',
  '30000000-0000-0000-0000-000000000004','ABIERTA',1,now(),
  '00000000-0000-0000-0000-000000000008'
);

insert into public.caja_sesion_terminales(
  empresa_id,local_id,session_id,terminal_id,desde
) values
('emp-d','loc-d1','40000000-0000-0000-0000-000000000004','20000000-0000-0000-0000-000000000007',now()),
('emp-d','loc-d1','40000000-0000-0000-0000-000000000004','20000000-0000-0000-0000-000000000008',now());

insert into public.caja_sesion_responsables(
  empresa_id,local_id,session_id,user_id,desde,asignado_por,motivo
) values (
  'emp-d','loc-d1','40000000-0000-0000-0000-000000000004',
  '00000000-0000-0000-0000-000000000008',now(),
  '00000000-0000-0000-0000-000000000008','TEST_A06'
);

insert into public.catalogo_tpv_productos(
  empresa_id,local_id,producto_id,currency_code,entidad_fiscal_id,nombre,unidad,
  fraccionable,precision_cantidad,precio_unitario,impuesto_pct,activo,version,snapshot_origen
) values (
  'emp-d','loc-d1','prod-a06-chocolate','EUR',
  '10000000-0000-0000-0000-000000000004',
  'Chocolate A06','ud',false,0,10,10,true,7,'{"origen":"A06"}'::jsonb
);

insert into public.catalogo_tpv_grupos_opciones(
  id,empresa_id,local_id,nombre,tipo_grupo,orden,activo,version
) values (
  '80000000-0000-0000-0000-000000000005',
  'emp-d','loc-d1','Tamaño A06','VARIANTE',1,true,2
);

insert into public.catalogo_tpv_producto_grupos(
  empresa_id,local_id,producto_id,currency_code,grupo_id,
  min_selecciones,max_selecciones,orden,activo,version
) values (
  'emp-d','loc-d1','prod-a06-chocolate','EUR',
  '80000000-0000-0000-0000-000000000005',
  1,1,1,true,3
);

insert into public.catalogo_tpv_opciones(
  id,empresa_id,local_id,grupo_id,currency_code,nombre,tipo_opcion,
  delta_precio,hereda_impuesto,impuesto_pct,max_cantidad,orden,activo,version,snapshot_origen
) values (
  '81000000-0000-0000-0000-000000000005',
  'emp-d','loc-d1','80000000-0000-0000-0000-000000000005','EUR',
  'Grande A06','VARIANTE',2,true,null,1,1,true,3,'{"codigo":"A06_GRANDE"}'::jsonb
);

-- Terminal 1 crea la cuenta.
select public.abc_abrir_cuenta(
  'a06.open.account.0001','emp-d','loc-d1',
  '50000000-0000-0000-0000-000000000004',
  'BARRA','EUR',
  '00000000-0000-0000-0000-000000000008',
  '20000000-0000-0000-0000-000000000007',
  '40000000-0000-0000-0000-000000000004',
  date '2026-09-23'
);

select public.abc_crear_pedido(
  'a06.create.order.0001','emp-d','loc-d1',
  '60000000-0000-0000-0000-000000000005',
  '50000000-0000-0000-0000-000000000004',
  1,
  '20000000-0000-0000-0000-000000000007',
  '40000000-0000-0000-0000-000000000004',
  date '2026-09-23'
);

select public.abc_agregar_linea_pedido_configurada(
  'a06.add.line.0001','emp-d','loc-d1',
  '70000000-0000-0000-0000-000000000006',
  '60000000-0000-0000-0000-000000000005',
  'prod-a06-chocolate',2,7,
  jsonb_build_array(
    jsonb_build_object(
      'grupo_id','80000000-0000-0000-0000-000000000005',
      'opcion_id','81000000-0000-0000-0000-000000000005',
      'cantidad',1,
      'expected_group_version',2,
      'expected_product_group_version',3,
      'expected_option_version',3
    )
  ),
  1,
  '20000000-0000-0000-0000-000000000007',
  '40000000-0000-0000-0000-000000000004',
  date '2026-09-23'
);

select public.abc_confirmar_linea_pedido_configurada(
  'a06.confirm.line.0001','emp-d','loc-d1',
  '70000000-0000-0000-0000-000000000006',
  7,
  jsonb_build_array(
    jsonb_build_object(
      'grupo_id','80000000-0000-0000-0000-000000000005',
      'opcion_id','81000000-0000-0000-0000-000000000005',
      'cantidad',1,
      'expected_group_version',2,
      'expected_product_group_version',3,
      'expected_option_version',3
    )
  ),
  2,2,
  '20000000-0000-0000-0000-000000000007',
  '40000000-0000-0000-0000-000000000004',
  date '2026-09-23'
);

select public.abc_enviar_pedido(
  'a06.send.order.0001','emp-d','loc-d1',
  '60000000-0000-0000-0000-000000000005',
  3,
  '20000000-0000-0000-0000-000000000007',
  '40000000-0000-0000-0000-000000000004',
  date '2026-09-23'
);

select public.abc_iniciar_preparacion_linea(
  'a06.start.line.0001','emp-d','loc-d1',
  '70000000-0000-0000-0000-000000000006',
  3,4,
  '20000000-0000-0000-0000-000000000007',
  '40000000-0000-0000-0000-000000000004',
  date '2026-09-23'
);

-- Terminal 2 recupera el agregado persistido.
create temp table a06_snapshot_1 as
select public.abc_recuperar_cuenta(
  'emp-d','loc-d1',
  '50000000-0000-0000-0000-000000000004',
  '20000000-0000-0000-0000-000000000008',
  '40000000-0000-0000-0000-000000000004',
  date '2026-09-23'
) snap;

do $$
declare
  s jsonb;
  p jsonb;
  l jsonb;
begin
  select snap into s from a06_snapshot_1;
  p:=s->'pedidos'->0;
  l:=p->'lineas'->0;

  if not (s->>'reanudable')::boolean
     or (s->>'requires_operating_day_resolution')::boolean then
    raise exception 'A06_FAIL: cuenta del mismo día no reanudable';
  end if;
  if s->'cuenta'->>'id'<>'50000000-0000-0000-0000-000000000004'
     or (s->'cuenta'->>'version')::bigint<>2 then
    raise exception 'A06_FAIL: cuenta/version snapshot';
  end if;
  if jsonb_array_length(s->'pedidos')<>1
     or p->>'estado'<>'EN_PREPARACION'
     or (p->>'version')::bigint<>5 then
    raise exception 'A06_FAIL: pedido no recuperado en estado/version esperados %',p;
  end if;
  if jsonb_array_length(p->'lineas')<>1
     or l->>'estado'<>'EN_PREPARACION'
     or (l->>'version')::bigint<>4 then
    raise exception 'A06_FAIL: línea no recuperada %',l;
  end if;
  if jsonb_array_length(l->'opciones')<>1
     or l->'opciones'->0->>'nombre_opcion'<>'Grande A06' then
    raise exception 'A06_FAIL: opción A04 no recuperada';
  end if;
  if jsonb_array_length(l->'transiciones')<>2
     or jsonb_array_length(p->'transiciones')<>2 then
    raise exception 'A06_FAIL: historial A05 no recuperado';
  end if;
  if s->'estado_cobro'->>'estado'<>'SIN_COBRO' then
    raise exception 'A06_FAIL: estado cobro no separado';
  end if;
  if nullif(s->>'revision','') is null
     or nullif(s->'cuenta'->>'last_activity_at','') is null then
    raise exception 'A06_FAIL: revision/actividad ausentes';
  end if;
end $$;

-- Otro día: se puede inspeccionar, pero no reanudar automáticamente.
do $$
declare s jsonb;
begin
  s:=public.abc_recuperar_cuenta(
    'emp-d','loc-d1',
    '50000000-0000-0000-0000-000000000004',
    '20000000-0000-0000-0000-000000000008',
    '40000000-0000-0000-0000-000000000004',
    date '2026-09-24'
  );
  if (s->>'reanudable')::boolean
     or not (s->>'requires_operating_day_resolution')::boolean then
    raise exception 'A06_FAIL: cruce de día no bloqueado';
  end if;
end $$;

-- Listado de recuperables.
do $$
declare r jsonb;
declare c jsonb;
begin
  r:=public.abc_listar_cuentas_recuperables(
    'emp-d','loc-d1',
    '20000000-0000-0000-0000-000000000008',
    '40000000-0000-0000-0000-000000000004',
    date '2026-09-23',
    0
  );
  if jsonb_array_length(r->'cuentas')<>1 then
    raise exception 'A06_FAIL: listado recuperables';
  end if;
  c:=r->'cuentas'->0;
  if c->>'cuenta_id'<>'50000000-0000-0000-0000-000000000004'
     or not (c->>'reanudable_mismo_dia')::boolean
     or not (c->>'posible_abandono')::boolean
     or (c->>'pedidos_count')::int<>1
     or (c->>'lineas_activas_count')::int<>1 then
    raise exception 'A06_FAIL: resumen recuperable incorrecto %',c;
  end if;
end $$;

-- Recuperar el resultado de una operación cuyo response pudo perderse.
do $$
declare r jsonb;
begin
  r:=public.abc_consultar_operacion(
    'emp-d','loc-d1','a06.open.account.0001'
  );
  if r->>'status'<>'COMPLETADA'
     or r->>'command_type'<>'ABC_ABRIR_CUENTA'
     or r->'resultado'->>'cuenta_id'<>'50000000-0000-0000-0000-000000000004' then
    raise exception 'A06_FAIL: consulta operacion propia %',r;
  end if;
end $$;

-- Otro usuario del mismo local no puede consultar la operación ajena.
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000009',false);

do $$
begin
  begin
    perform public.abc_consultar_operacion(
      'emp-d','loc-d1','a06.open.account.0001'
    );
    raise exception 'A06_FAIL: operación ajena expuesta';
  exception when others then
    if sqlerrm not like '%operacion_no_encontrada_o_no_autorizada%' then raise; end if;
  end;
end $$;

-- Encargado puede reasignar responsable con optimistic lock desde T2.
select public.abc_cambiar_responsable_cuenta(
  'a06.change.owner.0001','emp-d','loc-d1',
  '50000000-0000-0000-0000-000000000004',
  '00000000-0000-0000-0000-000000000009',
  'Cambio de turno ficticio',
  2,
  '20000000-0000-0000-0000-000000000008',
  '40000000-0000-0000-0000-000000000004',
  date '2026-09-23'
);

-- Replay exacto no duplica evento ni versión.
select public.abc_cambiar_responsable_cuenta(
  'a06.change.owner.0001','emp-d','loc-d1',
  '50000000-0000-0000-0000-000000000004',
  '00000000-0000-0000-0000-000000000009',
  'Cambio de turno ficticio',
  2,
  '20000000-0000-0000-0000-000000000008',
  '40000000-0000-0000-0000-000000000004',
  date '2026-09-23'
);

do $$
begin
  if (select version from public.cuentas_comerciales
      where id='50000000-0000-0000-0000-000000000004')<>3 then
    raise exception 'A06_FAIL: replay alteró version de cuenta';
  end if;
  if (select responsable_actual from public.cuentas_comerciales
      where id='50000000-0000-0000-0000-000000000004')
      <>'00000000-0000-0000-0000-000000000009'::uuid then
    raise exception 'A06_FAIL: responsable no cambiado';
  end if;
  if (select count(*) from public.abc_eventos
      where operation_id='a06.change.owner.0001'
        and event_type='CUENTA_RESPONSABLE_CAMBIADO')<>1 then
    raise exception 'A06_FAIL: replay duplicó evento';
  end if;
end $$;

-- Terminal con versión antigua falla.
do $$
begin
  begin
    perform public.abc_cambiar_responsable_cuenta(
      'a06.change.stale.0001','emp-d','loc-d1',
      '50000000-0000-0000-0000-000000000004',
      '00000000-0000-0000-0000-000000000008',
      'Intento stale',
      2,
      '20000000-0000-0000-0000-000000000007',
      '40000000-0000-0000-0000-000000000004',
      date '2026-09-23'
    );
    raise exception 'A06_FAIL: version stale aceptada';
  exception when others then
    if sqlerrm not like '%cuenta_version_conflict%' then raise; end if;
  end;
end $$;

-- El actor de la operación de reasignación puede recuperar su resultado.
do $$
declare r jsonb;
begin
  r:=public.abc_consultar_operacion(
    'emp-d','loc-d1','a06.change.owner.0001'
  );
  if r->>'status'<>'COMPLETADA'
     or r->'resultado'->>'responsable_actual'<>'00000000-0000-0000-0000-000000000009'
     or (r->'resultado'->>'version')::bigint<>3 then
    raise exception 'A06_FAIL: resultado reasignación no recuperable %',r;
  end if;
end $$;

-- Snapshot posterior debe reflejar versión/responsable nuevos y revisión nueva.
create temp table a06_snapshot_2 as
select public.abc_recuperar_cuenta(
  'emp-d','loc-d1',
  '50000000-0000-0000-0000-000000000004',
  '20000000-0000-0000-0000-000000000008',
  '40000000-0000-0000-0000-000000000004',
  date '2026-09-23'
) snap;

do $$
declare s1 jsonb;
declare s2 jsonb;
begin
  select snap into s1 from a06_snapshot_1;
  select snap into s2 from a06_snapshot_2;

  if (s2->'cuenta'->>'version')::bigint<>3
     or s2->'cuenta'->>'responsable_actual'<>'00000000-0000-0000-0000-000000000009' then
    raise exception 'A06_FAIL: snapshot posterior no actualizado';
  end if;
  if s1->>'revision'=s2->>'revision' then
    raise exception 'A06_FAIL: revision no cambió tras reasignación';
  end if;
end $$;

-- Usuario de otro local no puede recuperar la cuenta aunque conozca el UUID.
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000010',false);

do $$
begin
  begin
    perform public.abc_recuperar_cuenta(
      'emp-d','loc-d1',
      '50000000-0000-0000-0000-000000000004',
      '20000000-0000-0000-0000-000000000008',
      '40000000-0000-0000-0000-000000000004',
      date '2026-09-23'
    );
    raise exception 'A06_FAIL: recuperación cross-local aceptada';
  exception when others then
    if sqlerrm not like '%cuenta_recuperar_no_autorizada%' then raise; end if;
  end;
end $$;

-- A06 no crea efectos económicos.
do $$
begin
  if exists(select 1 from public.ventas_fiscales where empresa_id='emp-d')
     or exists(select 1 from public.checkouts where empresa_id='emp-d')
     or exists(select 1 from public.pagos where empresa_id='emp-d')
     or exists(select 1 from public.reembolsos where empresa_id='emp-d') then
    raise exception 'A06_FAIL: efectos económicos inesperados';
  end if;
end $$;

select 'ABC_F3_A06_CONTRACT=PASS' as resultado;
