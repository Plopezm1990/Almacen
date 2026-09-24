\set ON_ERROR_STOP on

-- A07 — zonas, mesas, ocupación derivada, multi-cuenta, movimiento y recuperación A06.

do $$
declare
  v_table text;
  v_rpc text;
  v_oid oid;
  v_tables text[]:=array['tpv_zonas','tpv_mesas','cuenta_mesa_asignaciones'];
  v_rpcs text[]:=array[
    'public.abc_crear_zona(text,text,text,uuid,text,text,text,integer,uuid,uuid,date)',
    'public.abc_actualizar_zona(text,text,text,uuid,text,text,text,integer,boolean,bigint,uuid,uuid,date)',
    'public.abc_crear_mesa(text,text,text,uuid,uuid,text,text,integer,integer,uuid,uuid,date)',
    'public.abc_actualizar_mesa(text,text,text,uuid,uuid,text,text,integer,integer,boolean,text,bigint,uuid,uuid,date)',
    'public.abc_cambiar_estado_mesa(text,text,text,uuid,text,timestamptz,text,text,bigint,uuid,uuid,date)',
    'public.abc_asignar_cuenta_mesa(text,text,text,uuid,uuid,integer,bigint,bigint,uuid,uuid,date)',
    'public.abc_mover_cuenta_mesa(text,text,text,uuid,uuid,integer,text,bigint,bigint,bigint,uuid,uuid,date)',
    'public.abc_liberar_cuenta_mesa(text,text,text,uuid,text,bigint,bigint,uuid,uuid,date)',
    'public.abc_listar_mapa_sala(text,text,uuid,uuid,date)'
  ];
  v_capdef text;
begin
  foreach v_table in array v_tables loop
    if to_regclass('public.'||v_table) is null then
      raise exception 'A07_FAIL: tabla ausente %',v_table;
    end if;
    if not (select relrowsecurity from pg_class where oid=to_regclass('public.'||v_table)) then
      raise exception 'A07_FAIL: RLS ausente %',v_table;
    end if;
    if not has_table_privilege('authenticated','public.'||v_table,'SELECT')
       or has_table_privilege('authenticated','public.'||v_table,'INSERT')
       or has_table_privilege('authenticated','public.'||v_table,'UPDATE')
       or has_table_privilege('authenticated','public.'||v_table,'DELETE')
       or has_table_privilege('anon','public.'||v_table,'SELECT')
       or has_table_privilege('service_role','public.'||v_table,'SELECT') then
      raise exception 'A07_FAIL: ACL tabla incorrecta %',v_table;
    end if;
  end loop;

  foreach v_rpc in array v_rpcs loop
    v_oid:=to_regprocedure(v_rpc);
    if v_oid is null then raise exception 'A07_FAIL: RPC ausente %',v_rpc; end if;
    if not exists(
      select 1 from pg_proc
      where oid=v_oid and prosecdef
        and pg_get_userbyid(proowner)='postgres'
        and coalesce(proconfig,'{}')::text like '%search_path=%'
    ) then
      raise exception 'A07_FAIL: SECURITY DEFINER/owner/search_path %',v_rpc;
    end if;
    if not has_function_privilege('authenticated',v_oid,'EXECUTE')
       or has_function_privilege('anon',v_oid,'EXECUTE')
       or has_function_privilege('service_role',v_oid,'EXECUTE') then
      raise exception 'A07_FAIL: ACL RPC incorrecta %',v_rpc;
    end if;
  end loop;

  if has_function_privilege('authenticated','private.abc_estado_mesa_efectivo(text,text,uuid)','EXECUTE')
     or has_function_privilege('authenticated','private.abc_ubicacion_cuenta(text,text,uuid)','EXECUTE')
     or has_function_privilege('anon','private.abc_ubicacion_cuenta(text,text,uuid)','EXECUTE')
     or has_function_privilege('service_role','private.abc_ubicacion_cuenta(text,text,uuid)','EXECUTE') then
    raise exception 'A07_FAIL: helpers privados expuestos';
  end if;

  v_capdef:=pg_get_functiondef(to_regprocedure('private.abc_tiene_capacidad(text,text,text)'));
  if v_capdef not like '%ABC_CUENTA_OPERAR%'
     or v_capdef not like '%ABC_CUENTA_REASIGNAR%'
     or v_capdef not like '%ABC_PEDIDO_ENVIAR%'
     or v_capdef not like '%ABC_SALA_VER%'
     or v_capdef not like '%ABC_SALA_CONFIGURAR%'
     or v_capdef not like '%ABC_MESA_ASIGNAR%'
     or v_capdef not like '%ABC_MESA_RESERVAR%'
     or v_capdef not like '%ABC_MESA_BLOQUEAR%' then
    raise exception 'A07_FAIL: capacidades existentes/A07 incompletas';
  end if;

  if position('ubicacion' in pg_get_functiondef(to_regprocedure(
      'public.abc_recuperar_cuenta(text,text,uuid,uuid,uuid,date)'
  )))=0
     or position('abc_ubicacion_cuenta' in pg_get_functiondef(to_regprocedure(
      'public.abc_listar_cuentas_recuperables(text,text,uuid,uuid,date,integer)'
  )))=0 then
    raise exception 'A07_FAIL: A06 no extendida con ubicación';
  end if;
end $$;

-- Fixture lógico A07.
insert into auth.users(id) values
('00000000-0000-0000-0000-000000000011'),
('00000000-0000-0000-0000-000000000012'),
('00000000-0000-0000-0000-000000000013'),
('00000000-0000-0000-0000-000000000014');

insert into public.empresas(id,nombre,activo)
values ('emp-e','Empresa E ficticia',true);

insert into public.locales(id,empresa_id,nombre,activo)
values
('loc-e1','emp-e','Local E1',true),
('loc-e2','emp-e','Local E2',true);

select set_config('app.test_empresa','emp-e',false);
select set_config('app.test_local','loc-e1',false);
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000011',false);

insert into public.membresias_usuario(user_id,empresa_id,local_id,todos_locales,rol,activo)
values
('00000000-0000-0000-0000-000000000011','emp-e','loc-e1',false,'Propietario',true),
('00000000-0000-0000-0000-000000000012','emp-e','loc-e1',false,'Camarero/a',true),
('00000000-0000-0000-0000-000000000013','emp-e','loc-e1',false,'Churrero/a',true),
('00000000-0000-0000-0000-000000000014','emp-e','loc-e2',false,'Encargado',true);

insert into public.entidades_fiscales(
  id,empresa_id,nombre_legal,identificador_fiscal,country_code,simulada,activa
) values (
  '10000000-0000-0000-0000-000000000005',
  'emp-e','Entidad E ficticia','SIM-E','ES',true,true
);

insert into public.entidad_fiscal_monedas(
  empresa_id,entidad_fiscal_id,currency_code,es_principal,activa
) values (
  'emp-e','10000000-0000-0000-0000-000000000005','EUR',true,true
);

insert into public.entidad_fiscal_locales(
  empresa_id,local_id,entidad_fiscal_id,activa
) values (
  'emp-e','loc-e1','10000000-0000-0000-0000-000000000005',true
);

insert into public.entidad_fiscal_local_monedas(
  empresa_id,local_id,entidad_fiscal_id,currency_code,activa
) values (
  'emp-e','loc-e1','10000000-0000-0000-0000-000000000005','EUR',true
);

insert into public.terminales_tpv(id,empresa_id,local_id,nombre,activo)
values
('20000000-0000-0000-0000-000000000009','emp-e','loc-e1','Terminal E1',true),
('20000000-0000-0000-0000-000000000010','emp-e','loc-e1','Terminal E2',true);

insert into public.cajas_fisicas(id,empresa_id,local_id,nombre,activo)
values ('30000000-0000-0000-0000-000000000005','emp-e','loc-e1','Caja E',true);

insert into public.caja_sesiones(
  id,empresa_id,local_id,caja_id,estado,version,abierta_at,abierta_por
) values (
  '40000000-0000-0000-0000-000000000005','emp-e','loc-e1',
  '30000000-0000-0000-0000-000000000005','ABIERTA',1,now(),
  '00000000-0000-0000-0000-000000000011'
);

insert into public.caja_sesion_terminales(
  empresa_id,local_id,session_id,terminal_id,desde
) values
('emp-e','loc-e1','40000000-0000-0000-0000-000000000005','20000000-0000-0000-0000-000000000009',now()),
('emp-e','loc-e1','40000000-0000-0000-0000-000000000005','20000000-0000-0000-0000-000000000010',now());

insert into public.caja_sesion_responsables(
  empresa_id,local_id,session_id,user_id,desde,asignado_por,motivo
) values (
  'emp-e','loc-e1','40000000-0000-0000-0000-000000000005',
  '00000000-0000-0000-0000-000000000011',now(),
  '00000000-0000-0000-0000-000000000011','TEST_A07'
);

-- Zonas; replay exacto de creación no duplica.
select public.abc_crear_zona(
  'a07.zone.sala','emp-e','loc-e1',
  '90000000-0000-0000-0000-000000000001',
  'SALA','Sala Principal','SALA',1,
  '20000000-0000-0000-0000-000000000009',
  '40000000-0000-0000-0000-000000000005',
  date '2026-09-24'
);
select public.abc_crear_zona(
  'a07.zone.sala','emp-e','loc-e1',
  '90000000-0000-0000-0000-000000000001',
  'SALA','Sala Principal','SALA',1,
  '20000000-0000-0000-0000-000000000009',
  '40000000-0000-0000-0000-000000000005',
  date '2026-09-24'
);
select public.abc_crear_zona(
  'a07.zone.terraza','emp-e','loc-e1',
  '90000000-0000-0000-0000-000000000002',
  'TERRAZA','Terraza','TERRAZA',2,
  '20000000-0000-0000-0000-000000000009',
  '40000000-0000-0000-0000-000000000005',
  date '2026-09-24'
);

do $$
begin
  if (select count(*) from public.tpv_zonas where empresa_id='emp-e')<>2 then
    raise exception 'A07_FAIL: replay zona duplicó';
  end if;
end $$;

-- Mesas: M1 multi-cuenta, T1 destino, M2 capacidad 2.
select public.abc_crear_mesa(
  'a07.table.m1','emp-e','loc-e1',
  '91000000-0000-0000-0000-000000000001',
  '90000000-0000-0000-0000-000000000001',
  'M1','Mesa 1',4,1,
  '20000000-0000-0000-0000-000000000009',
  '40000000-0000-0000-0000-000000000005',
  date '2026-09-24'
);
select public.abc_crear_mesa(
  'a07.table.t1','emp-e','loc-e1',
  '91000000-0000-0000-0000-000000000002',
  '90000000-0000-0000-0000-000000000002',
  'T1','Terraza 1',4,1,
  '20000000-0000-0000-0000-000000000009',
  '40000000-0000-0000-0000-000000000005',
  date '2026-09-24'
);
select public.abc_crear_mesa(
  'a07.table.m2','emp-e','loc-e1',
  '91000000-0000-0000-0000-000000000003',
  '90000000-0000-0000-0000-000000000001',
  'M2','Mesa 2',2,2,
  '20000000-0000-0000-0000-000000000009',
  '40000000-0000-0000-0000-000000000005',
  date '2026-09-24'
);

-- Reserva y desbloqueo de M2.
select public.abc_cambiar_estado_mesa(
  'a07.table.m2.reserve','emp-e','loc-e1',
  '91000000-0000-0000-0000-000000000003',
  'RESERVADA',now()+interval '2 hours','RES-A07','Reserva A07',
  1,
  '20000000-0000-0000-0000-000000000009',
  '40000000-0000-0000-0000-000000000005',
  date '2026-09-24'
);

do $$
begin
  if private.abc_estado_mesa_efectivo('emp-e','loc-e1','91000000-0000-0000-0000-000000000003')<>'RESERVADA' then
    raise exception 'A07_FAIL: mesa reservada no RESERVADA';
  end if;
end $$;

-- Cuatro cuentas.
select public.abc_abrir_cuenta(
  'a07.account.1','emp-e','loc-e1',
  '50000000-0000-0000-0000-000000000005','MESA','EUR',
  '00000000-0000-0000-0000-000000000011',
  '20000000-0000-0000-0000-000000000009',
  '40000000-0000-0000-0000-000000000005',date '2026-09-24'
);
select public.abc_abrir_cuenta(
  'a07.account.2','emp-e','loc-e1',
  '50000000-0000-0000-0000-000000000006','MESA','EUR',
  '00000000-0000-0000-0000-000000000012',
  '20000000-0000-0000-0000-000000000009',
  '40000000-0000-0000-0000-000000000005',date '2026-09-24'
);
select public.abc_abrir_cuenta(
  'a07.account.3','emp-e','loc-e1',
  '50000000-0000-0000-0000-000000000007','MESA','EUR',
  '00000000-0000-0000-0000-000000000011',
  '20000000-0000-0000-0000-000000000009',
  '40000000-0000-0000-0000-000000000005',date '2026-09-24'
);
select public.abc_abrir_cuenta(
  'a07.account.4','emp-e','loc-e1',
  '50000000-0000-0000-0000-000000000008','MESA','EUR',
  '00000000-0000-0000-0000-000000000011',
  '20000000-0000-0000-0000-000000000009',
  '40000000-0000-0000-0000-000000000005',date '2026-09-24'
);

-- M2 reservada bloquea asignación.
do $$
begin
  begin
    perform public.abc_asignar_cuenta_mesa(
      'a07.assign.reserved','emp-e','loc-e1',
      '50000000-0000-0000-0000-000000000007',
      '91000000-0000-0000-0000-000000000003',
      3,1,2,
      '20000000-0000-0000-0000-000000000009',
      '40000000-0000-0000-0000-000000000005',date '2026-09-24'
    );
    raise exception 'A07_FAIL: asignación sobre reservada aceptada';
  exception when others then
    if sqlerrm not like '%mesa_no_asignable%' then raise; end if;
  end;
end $$;

select public.abc_cambiar_estado_mesa(
  'a07.table.m2.normal','emp-e','loc-e1',
  '91000000-0000-0000-0000-000000000003',
  'NORMAL',null,null,null,2,
  '20000000-0000-0000-0000-000000000009',
  '40000000-0000-0000-0000-000000000005',date '2026-09-24'
);

-- Cuenta 1 a M1 por propietario.
select public.abc_asignar_cuenta_mesa(
  'a07.assign.1','emp-e','loc-e1',
  '50000000-0000-0000-0000-000000000005',
  '91000000-0000-0000-0000-000000000001',
  2,1,1,
  '20000000-0000-0000-0000-000000000009',
  '40000000-0000-0000-0000-000000000005',date '2026-09-24'
);

-- Cuenta 2 a la misma M1 por Camarero: varias cuentas por mesa sí.
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000012',false);
select public.abc_asignar_cuenta_mesa(
  'a07.assign.2','emp-e','loc-e1',
  '50000000-0000-0000-0000-000000000006',
  '91000000-0000-0000-0000-000000000001',
  3,1,2,
  '20000000-0000-0000-0000-000000000010',
  '40000000-0000-0000-0000-000000000005',date '2026-09-24'
);

-- Stale mesa version rechazada para una tercera cuenta.
do $$
begin
  begin
    perform public.abc_asignar_cuenta_mesa(
      'a07.assign.stale','emp-e','loc-e1',
      '50000000-0000-0000-0000-000000000008',
      '91000000-0000-0000-0000-000000000001',
      1,1,2,
      '20000000-0000-0000-0000-000000000010',
      '40000000-0000-0000-0000-000000000005',date '2026-09-24'
    );
    raise exception 'A07_FAIL: stale mesa version aceptada';
  exception when others then
    if sqlerrm not like '%mesa_version_conflict%' then raise; end if;
  end;
end $$;

-- Cuenta 3 a M2 con 3 comensales aunque capacidad=2: advertencia, no bloqueo.
select public.abc_asignar_cuenta_mesa(
  'a07.assign.3','emp-e','loc-e1',
  '50000000-0000-0000-0000-000000000007',
  '91000000-0000-0000-0000-000000000003',
  3,1,3,
  '20000000-0000-0000-0000-000000000010',
  '40000000-0000-0000-0000-000000000005',date '2026-09-24'
);

-- Mesa ocupada no puede bloquearse/reservarse.
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000011',false);
do $$
begin
  begin
    perform public.abc_cambiar_estado_mesa(
      'a07.table.m2.block.occupied','emp-e','loc-e1',
      '91000000-0000-0000-0000-000000000003',
      'BLOQUEADA',null,null,'No debe aplicar',4,
      '20000000-0000-0000-0000-000000000009',
      '40000000-0000-0000-0000-000000000005',date '2026-09-24'
    );
    raise exception 'A07_FAIL: bloqueo mesa ocupada aceptado';
  exception when others then
    if sqlerrm not like '%mesa_ocupada_no_cambia_estado_manual%' then raise; end if;
  end;
end $$;

-- Mapa: M1 dos cuentas, M2 sobre capacidad.
do $$
declare r jsonb; z jsonb; m jsonb; found_m1 boolean:=false; found_m2 boolean:=false;
begin
  r:=public.abc_listar_mapa_sala(
    'emp-e','loc-e1',
    '20000000-0000-0000-0000-000000000009',
    '40000000-0000-0000-0000-000000000005',date '2026-09-24'
  );
  if jsonb_array_length(r->'zonas')<>2 then raise exception 'A07_FAIL: mapa zonas'; end if;
  for z in select value from jsonb_array_elements(r->'zonas') loop
    for m in select value from jsonb_array_elements(z->'mesas') loop
      if m->>'mesa_id'='91000000-0000-0000-0000-000000000001' then
        found_m1:=true;
        if m->>'estado_efectivo'<>'OCUPADA' or jsonb_array_length(m->'cuentas')<>2
           or (m->>'ocupacion_comensales')::int<>5 then
          raise exception 'A07_FAIL: M1 multi-cuenta incorrecta %',m;
        end if;
      elsif m->>'mesa_id'='91000000-0000-0000-0000-000000000003' then
        found_m2:=true;
        if m->>'estado_efectivo'<>'OCUPADA'
           or not (m->>'sobre_capacidad')::boolean
           or (m->>'ocupacion_comensales')::int<>3 then
          raise exception 'A07_FAIL: M2 capacidad/ocupación incorrecta %',m;
        end if;
      end if;
    end loop;
  end loop;
  if not found_m1 or not found_m2 then raise exception 'A07_FAIL: mesas no presentes mapa'; end if;
end $$;

-- Churrero no ve sala por defecto.
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000013',false);
do $$
begin
  begin
    perform public.abc_listar_mapa_sala(
      'emp-e','loc-e1',
      '20000000-0000-0000-0000-000000000009',
      '40000000-0000-0000-0000-000000000005',date '2026-09-24'
    );
    raise exception 'A07_FAIL: Churrero con acceso sala';
  exception when others then
    if sqlerrm not like '%sala_ver_no_autorizada%' then raise; end if;
  end;
end $$;

-- Movimiento M1 -> T1; cambia modalidad a TERRAZA y conserva histórico.
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000012',false);
select public.abc_mover_cuenta_mesa(
  'a07.move.1','emp-e','loc-e1',
  '50000000-0000-0000-0000-000000000005',
  '91000000-0000-0000-0000-000000000002',
  2,'Cliente cambia a terraza',
  2,3,1,
  '20000000-0000-0000-0000-000000000010',
  '40000000-0000-0000-0000-000000000005',date '2026-09-24'
);

-- Replay exacto del movimiento.
select public.abc_mover_cuenta_mesa(
  'a07.move.1','emp-e','loc-e1',
  '50000000-0000-0000-0000-000000000005',
  '91000000-0000-0000-0000-000000000002',
  2,'Cliente cambia a terraza',
  2,3,1,
  '20000000-0000-0000-0000-000000000010',
  '40000000-0000-0000-0000-000000000005',date '2026-09-24'
);

do $$
declare s jsonb; loc jsonb;
begin
  if (select version from public.cuentas_comerciales where id='50000000-0000-0000-0000-000000000005')<>3 then
    raise exception 'A07_FAIL: replay movimiento cambió cuenta version';
  end if;
  if (select modalidad from public.cuentas_comerciales where id='50000000-0000-0000-0000-000000000005')<>'TERRAZA' then
    raise exception 'A07_FAIL: modalidad no TERRAZA';
  end if;
  if (select count(*) from public.cuenta_mesa_asignaciones where cuenta_id='50000000-0000-0000-0000-000000000005')<>2
     or (select count(*) from public.cuenta_mesa_asignaciones where cuenta_id='50000000-0000-0000-0000-000000000005' and hasta is null)<>1 then
    raise exception 'A07_FAIL: histórico movimiento incorrecto';
  end if;
  if (select count(*) from public.abc_eventos where operation_id='a07.move.1' and event_type='CUENTA_MESA_MOVIDA')<>1 then
    raise exception 'A07_FAIL: replay duplicó evento movimiento';
  end if;

  s:=public.abc_recuperar_cuenta(
    'emp-e','loc-e1',
    '50000000-0000-0000-0000-000000000005',
    '20000000-0000-0000-0000-000000000010',
    '40000000-0000-0000-0000-000000000005',date '2026-09-24'
  );
  loc:=s->'ubicacion';
  if loc->>'mesa_id'<>'91000000-0000-0000-0000-000000000002'
     or loc->>'zona_tipo'<>'TERRAZA'
     or (loc->>'comensales')::int<>2 then
    raise exception 'A07_FAIL: A06 no recupera ubicación A07 %',loc;
  end if;
end $$;

-- Stale cuenta version tras movimiento.
do $$
begin
  begin
    perform public.abc_mover_cuenta_mesa(
      'a07.move.stale','emp-e','loc-e1',
      '50000000-0000-0000-0000-000000000005',
      '91000000-0000-0000-0000-000000000003',
      2,'Intento stale',
      2,2,4,
      '20000000-0000-0000-0000-000000000010',
      '40000000-0000-0000-0000-000000000005',date '2026-09-24'
    );
    raise exception 'A07_FAIL: stale cuenta version aceptada';
  exception when others then
    if sqlerrm not like '%cuenta_version_conflict%' then raise; end if;
  end;
end $$;

-- Listado A06 incluye ubicación.
do $$
declare r jsonb; c jsonb; ok boolean:=false;
begin
  r:=public.abc_listar_cuentas_recuperables(
    'emp-e','loc-e1',
    '20000000-0000-0000-0000-000000000010',
    '40000000-0000-0000-0000-000000000005',
    date '2026-09-24',30
  );
  for c in select value from jsonb_array_elements(r->'cuentas') loop
    if c->>'cuenta_id'='50000000-0000-0000-0000-000000000005' then
      ok:=true;
      if c->'ubicacion'->>'mesa_id'<>'91000000-0000-0000-0000-000000000002' then
        raise exception 'A07_FAIL: lista recuperables sin ubicación %',c;
      end if;
    end if;
  end loop;
  if not ok then raise exception 'A07_FAIL: cuenta movida no listada'; end if;
end $$;

-- Liberar de T1.
select public.abc_liberar_cuenta_mesa(
  'a07.release.1','emp-e','loc-e1',
  '50000000-0000-0000-0000-000000000005',
  'Cliente abandona mesa',
  3,2,
  '20000000-0000-0000-0000-000000000010',
  '40000000-0000-0000-0000-000000000005',date '2026-09-24'
);

do $$
declare s jsonb;
begin
  if private.abc_estado_mesa_efectivo('emp-e','loc-e1','91000000-0000-0000-0000-000000000002')<>'LIBRE' then
    raise exception 'A07_FAIL: T1 no quedó LIBRE';
  end if;
  if (select count(*) from public.cuenta_mesa_asignaciones
      where cuenta_id='50000000-0000-0000-0000-000000000005' and hasta is null)<>0 then
    raise exception 'A07_FAIL: asignación activa tras liberar';
  end if;
  s:=public.abc_recuperar_cuenta(
    'emp-e','loc-e1',
    '50000000-0000-0000-0000-000000000005',
    '20000000-0000-0000-0000-000000000010',
    '40000000-0000-0000-0000-000000000005',date '2026-09-24'
  );
  if s->'ubicacion'<>'null'::jsonb then
    raise exception 'A07_FAIL: ubicación no nula tras liberar %',s->'ubicacion';
  end if;
end $$;

-- Usuario de otro local no puede leer mapa del local E1.
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000014',false);
do $$
begin
  begin
    perform public.abc_listar_mapa_sala(
      'emp-e','loc-e1',
      '20000000-0000-0000-0000-000000000010',
      '40000000-0000-0000-0000-000000000005',date '2026-09-24'
    );
    raise exception 'A07_FAIL: mapa cross-local aceptado';
  exception when others then
    if sqlerrm not like '%sala_ver_no_autorizada%' then raise; end if;
  end;
end $$;

-- No hay efectos económicos A07.
do $$
begin
  if exists(select 1 from public.ventas_fiscales where empresa_id='emp-e')
     or exists(select 1 from public.checkouts where empresa_id='emp-e')
     or exists(select 1 from public.pagos where empresa_id='emp-e')
     or exists(select 1 from public.reembolsos where empresa_id='emp-e') then
    raise exception 'A07_FAIL: efectos económicos inesperados';
  end if;
end $$;

select 'ABC_F3_A07_CONTRACT=PASS' as resultado;
