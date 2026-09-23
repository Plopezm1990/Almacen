\set ON_ERROR_STOP on

insert into public.empresas(id,nombre) values
  ('E1','Empresa 1'),
  ('E2','Empresa 2');

insert into public.locales(id,empresa_id,nombre) values
  ('L1','E1','Local 1'),
  ('L2','E2','Local 2');

insert into auth.users(id) values
  ('11111111-1111-1111-1111-111111111111'),
  ('22222222-2222-2222-2222-222222222222'),
  ('33333333-3333-3333-3333-333333333333');

insert into public.membresias_usuario(
  user_id,empresa_id,local_id,todos_locales,rol,activo
) values
  ('11111111-1111-1111-1111-111111111111','E1','L1',false,'Propietario',true),
  ('22222222-2222-2222-2222-222222222222','E1','L1',false,'Cajero/a',true),
  ('33333333-3333-3333-3333-333333333333','E2','L2',false,'Propietario',true);

insert into public.cajas_fisicas(id,empresa_id,local_id,nombre,activo) values
  ('a1000000-0000-0000-0000-000000000101','E1','L1','Caja C02',true),
  ('a2000000-0000-0000-0000-000000000101','E2','L2','Caja E2',true);

insert into public.terminales_tpv(id,empresa_id,local_id,nombre,device_key,activo) values
  ('b1000000-0000-0000-0000-000000000101','E1','L1','TPV C02','m04b-t1',true),
  ('b1000000-0000-0000-0000-000000000102','E1','L1','TPV no vinculado','m04b-t2',true),
  ('b2000000-0000-0000-0000-000000000101','E2','L2','TPV E2','m04b-e2',true);

select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false);
select set_config('app.test_empresa','E1',false);
select set_config('app.test_local','L1',false);

set role authenticated;

-- Apertura C01 con fondo, usada para probar que el fondo no es reversible de forma genérica.
select public.abc_abrir_sesion_caja(
  'M04B:open:1','E1','L1',
  'c1000000-0000-0000-0000-000000000101',
  'a1000000-0000-0000-0000-000000000101',
  '11111111-1111-1111-1111-111111111111',
  'b1000000-0000-0000-0000-000000000101',
  'EUR',50,'2026-09-23'
);

-- Reposición manual ABC.
select public.abc_registrar_movimiento_caja(
  'M04B:manual:repo:1','E1','L1',
  'a1000000-0000-0000-0000-000000000101',
  'c1000000-0000-0000-0000-000000000101',
  'b1000000-0000-0000-0000-000000000101',
  'EUR','REPOSICION_CAJA',20,
  'Reposicion de cambio','Cambio para servicio','2026-09-23'
);

-- Replay exacto: no duplica.
select public.abc_registrar_movimiento_caja(
  'M04B:manual:repo:1','E1','L1',
  'a1000000-0000-0000-0000-000000000101',
  'c1000000-0000-0000-0000-000000000101',
  'b1000000-0000-0000-0000-000000000101',
  'EUR','REPOSICION_CAJA',20,
  'Reposicion de cambio','Cambio para servicio','2026-09-23'
);

-- Gasto manual.
select public.abc_registrar_movimiento_caja(
  'M04B:manual:gasto:1','E1','L1',
  'a1000000-0000-0000-0000-000000000101',
  'c1000000-0000-0000-0000-000000000101',
  'b1000000-0000-0000-0000-000000000101',
  'EUR','GASTO_CAJA',5,
  'Compra urgente','Material de limpieza','2026-09-23'
);

-- Movimiento reservado para prueba concurrente del workflow.
select public.abc_registrar_movimiento_caja(
  'M04B:manual:conc:1','E1','L1',
  'a1000000-0000-0000-0000-000000000101',
  'c1000000-0000-0000-0000-000000000101',
  'b1000000-0000-0000-0000-000000000101',
  'EUR','INGRESO_MANUAL',12,
  'Ingreso concurrente','Prueba concurrencia','2026-09-23'
);

-- Categorías económicas de otros dominios no pueden entrar por la RPC manual.
do $$
begin
  begin
    perform public.abc_registrar_movimiento_caja(
      'M04B:invalid:refund','E1','L1',
      'a1000000-0000-0000-0000-000000000101',
      'c1000000-0000-0000-0000-000000000101',
      'b1000000-0000-0000-0000-000000000101',
      'EUR','REEMBOLSO_VENTA',7,
      'No permitido','No debe pasar','2026-09-23'
    );
    raise exception 'M04B_FAIL: reembolso entro como movimiento manual';
  exception when others then
    if sqlerrm not like '%categoria_movimiento_caja_invalida%' then raise; end if;
  end;
end $$;

-- Terminal existente pero no vinculado.
do $$
begin
  begin
    perform public.abc_registrar_movimiento_caja(
      'M04B:invalid:terminal','E1','L1',
      'a1000000-0000-0000-0000-000000000101',
      'c1000000-0000-0000-0000-000000000101',
      'b1000000-0000-0000-0000-000000000102',
      'EUR','RETIRADA_CAJA',3,
      'Retirada','Terminal no vinculado','2026-09-23'
    );
    raise exception 'M04B_FAIL: terminal no vinculado aceptado';
  exception when others then
    if sqlerrm not like '%terminal_no_vinculado_sesion%' then raise; end if;
  end;
end $$;

-- Tenant ajeno.
do $$
begin
  begin
    perform public.abc_registrar_movimiento_caja(
      'M04B:invalid:tenant','E2','L2',
      'a2000000-0000-0000-0000-000000000101',
      'c1000000-0000-0000-0000-000000000101',
      'b2000000-0000-0000-0000-000000000101',
      'EUR','RETIRADA_CAJA',3,
      'Retirada','Tenant ajeno','2026-09-23'
    );
    raise exception 'M04B_FAIL: tenant ajeno aceptado';
  exception when others then
    if sqlerrm not like '%abc_movimiento_caja_no_autorizado%' then raise; end if;
  end;
end $$;

reset role;

do $$
declare
  v_n integer;
  v_effect numeric;
  v_category text;
begin
  select count(*),min(efecto_efectivo),min(categoria)
    into v_n,v_effect,v_category
    from public.caja_operaciones
   where abc_command_id='M04B:manual:repo:1';
  if v_n<>1 or v_effect<>20 or v_category<>'REPOSICION_CAJA' then
    raise exception 'M04B_FAIL: reposicion/replay incorrecto n=% efecto=% categoria=%',
      v_n,v_effect,v_category;
  end if;

  select count(*),min(efecto_efectivo)
    into v_n,v_effect
    from public.caja_operaciones
   where abc_command_id='M04B:manual:gasto:1';
  if v_n<>1 or v_effect<>-5 then
    raise exception 'M04B_FAIL: gasto incorrecto n=% efecto=%',v_n,v_effect;
  end if;
end $$;

-- Simular un movimiento económico de dominio ABC para probar el blindaje.
insert into public.caja_operaciones(
  operation_id,tipo,empresa_id,local_id,fecha,importe,efecto_efectivo,
  medio_pago,concepto,origen_tipo,origen_id,payload,actor_user_id,
  abc_command_id,caja_id,session_id,terminal_id,currency_code,
  operating_day,occurred_at,categoria
) values (
  'M04B:domain:cobro:1','ENTRADA','E1','L1','2026-09-23',30,30,
  'EFECTIVO','Cobro de dominio simulado','ABC_PAGO',
  '50000000-0000-0000-0000-000000000999','{}'::jsonb,
  '11111111-1111-1111-1111-111111111111',
  'M04B:open:1',
  'a1000000-0000-0000-0000-000000000101',
  'c1000000-0000-0000-0000-000000000101',
  'b1000000-0000-0000-0000-000000000101',
  'EUR','2026-09-23',now(),'COBRO_VENTA'
);

-- Legado manual sin contexto ABC: debe seguir siendo corregible por el reversor legacy.
insert into public.caja_operaciones(
  operation_id,tipo,empresa_id,local_id,fecha,importe,efecto_efectivo,
  medio_pago,concepto,origen_tipo,origen_id,payload,actor_user_id
) values (
  'M04B:legacy:manual:1','ENTRADA','E1','L1','2026-09-23',8,8,
  'EFECTIVO','Movimiento legacy','MANUAL',null,
  jsonb_build_object('legacy',true),
  '11111111-1111-1111-1111-111111111111'
);

set role authenticated;

-- Reverso ABC de movimiento manual permitido.
select public.abc_revertir_movimiento_caja(
  'M04B:reverse:repo:1','E1','L1',
  (
    select operation_id
      from public.caja_operaciones
     where abc_command_id='M04B:manual:repo:1'
  ),
  'b1000000-0000-0000-0000-000000000101',
  'Correccion reposicion','2026-09-23'
);

-- Replay exacto del reverso.
select public.abc_revertir_movimiento_caja(
  'M04B:reverse:repo:1','E1','L1',
  (
    select operation_id
      from public.caja_operaciones
     where abc_command_id='M04B:manual:repo:1'
  ),
  'b1000000-0000-0000-0000-000000000101',
  'Correccion reposicion','2026-09-23'
);

-- FONDO_INICIAL no es reversible por el reversor manual ABC.
do $$
begin
  begin
    perform public.abc_revertir_movimiento_caja(
      'M04B:deny:fund:abc','E1','L1',
      (
        select operation_id
          from public.caja_operaciones
         where abc_command_id='M04B:open:1'
           and categoria='FONDO_INICIAL'
      ),
      'b1000000-0000-0000-0000-000000000101',
      'No permitido','2026-09-23'
    );
    raise exception 'M04B_FAIL: fondo inicial revertido por ABC manual';
  exception when others then
    if sqlerrm not like '%movimiento_caja_no_reversible_por_abc%' then raise; end if;
  end;
end $$;

-- COBRO_VENTA tampoco.
do $$
begin
  begin
    perform public.abc_revertir_movimiento_caja(
      'M04B:deny:cobro:abc','E1','L1',
      'M04B:domain:cobro:1',
      'b1000000-0000-0000-0000-000000000101',
      'No permitido','2026-09-23'
    );
    raise exception 'M04B_FAIL: cobro revertido por ABC manual';
  exception when others then
    if sqlerrm not like '%movimiento_caja_no_reversible_por_abc%' then raise; end if;
  end;
end $$;

-- Reversor legacy debe rechazar cualquier fila con autoridad ABC.
do $$
begin
  begin
    perform public.revertir_movimiento_caja(
      'M04B:deny:fund:legacy',
      (
        select operation_id
          from public.caja_operaciones
         where abc_command_id='M04B:open:1'
           and categoria='FONDO_INICIAL'
      ),
      'No permitido','2026-09-23'
    );
    raise exception 'M04B_FAIL: legacy revirtio fondo ABC';
  exception when others then
    if sqlerrm not like '%movimiento_abc_requiere_reverso_abc%' then raise; end if;
  end;

  begin
    perform public.revertir_movimiento_caja(
      'M04B:deny:cobro:legacy',
      'M04B:domain:cobro:1',
      'No permitido','2026-09-23'
    );
    raise exception 'M04B_FAIL: legacy revirtio cobro ABC';
  exception when others then
    if sqlerrm not like '%movimiento_abc_requiere_reverso_abc%' then raise; end if;
  end;
end $$;

-- Compatibilidad: movimiento legacy sigue pudiendo revertirse.
select public.revertir_movimiento_caja(
  'M04B:legacy:reverse:1',
  'M04B:legacy:manual:1',
  'Correccion legacy','2026-09-23'
);

reset role;

do $$
declare
  v_n integer;
  v_tipo text;
  v_cat text;
  v_ref text;
begin
  select count(*),min(tipo),min(categoria),min(ref_operation_id)
    into v_n,v_tipo,v_cat,v_ref
    from public.caja_operaciones
   where abc_command_id='M04B:reverse:repo:1';
  if v_n<>1 or v_tipo<>'REVERSO_ENTRADA' or v_cat<>'CORRECCION_CAJA' then
    raise exception 'M04B_FAIL: reverso ABC incorrecto n=% tipo=% cat=%',v_n,v_tipo,v_cat;
  end if;

  select count(*) into v_n
    from public.caja_operaciones
   where operation_id='M04B:legacy:reverse:1'
     and tipo='REVERSO_ENTRADA'
     and abc_command_id is null;
  if v_n<>1 then raise exception 'M04B_FAIL: compatibilidad legacy perdida'; end if;
end $$;

-- Cajero puede operar caja, pero no corregir movimientos.
select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',false);
set role authenticated;
do $$
begin
  begin
    perform public.abc_revertir_movimiento_caja(
      'M04B:cashier:reverse','E1','L1',
      (
        select operation_id
          from public.caja_operaciones
         where abc_command_id='M04B:manual:gasto:1'
      ),
      'b1000000-0000-0000-0000-000000000101',
      'Cajero no autorizado','2026-09-23'
    );
    raise exception 'M04B_FAIL: cajero corrigio movimiento';
  exception when others then
    if sqlerrm not like '%abc_reverso_caja_no_autorizado%' then raise; end if;
  end;
end $$;
reset role;

-- Mutación directa sigue cerrada para authenticated.
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false);
set role authenticated;
do $$
begin
  begin
    insert into public.caja_operaciones(
      operation_id,tipo,empresa_id,local_id,fecha,importe,efecto_efectivo,
      medio_pago,concepto,origen_tipo,payload,actor_user_id
    ) values (
      'M04B:direct:deny','ENTRADA','E1','L1','2026-09-23',1,1,
      'EFECTIVO','No','MANUAL','{}'::jsonb,
      '11111111-1111-1111-1111-111111111111'
    );
    raise exception 'M04B_FAIL: authenticated pudo insertar directo';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- ACL.
do $$
begin
  if not has_function_privilege(
    'authenticated',
    'public.abc_registrar_movimiento_caja(text,text,text,uuid,uuid,uuid,text,text,numeric,text,text,date)',
    'EXECUTE'
  ) then raise exception 'M04B_FAIL: authenticated sin registrar ABC'; end if;

  if not has_function_privilege(
    'authenticated',
    'public.abc_revertir_movimiento_caja(text,text,text,text,uuid,text,date)',
    'EXECUTE'
  ) then raise exception 'M04B_FAIL: authenticated sin reverso ABC'; end if;

  if has_function_privilege(
    'anon',
    'public.abc_registrar_movimiento_caja(text,text,text,uuid,uuid,uuid,text,text,numeric,text,text,date)',
    'EXECUTE'
  ) then raise exception 'M04B_FAIL: anon puede registrar ABC'; end if;

  if has_function_privilege(
    'anon',
    'public.abc_revertir_movimiento_caja(text,text,text,text,uuid,text,date)',
    'EXECUTE'
  ) then raise exception 'M04B_FAIL: anon puede revertir ABC'; end if;

  if not has_function_privilege(
    'authenticated',
    'public.revertir_movimiento_caja(text,text,text,date)',
    'EXECUTE'
  ) then raise exception 'M04B_FAIL: compatibilidad ACL legacy perdida'; end if;
end $$;

select 'ABC_F2_M04B_CONTRACT=PASS' as resultado;
