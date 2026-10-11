\set ON_ERROR_STOP on

-- Datos aislados C01-M04A.
insert into public.empresas(id,nombre) values
  ('E1','Empresa 1'),
  ('E2','Empresa 2');

insert into public.locales(id,empresa_id,nombre) values
  ('L1','E1','Local 1'),
  ('L2','E2','Local 2');

insert into auth.users(id) values
  ('11111111-1111-1111-1111-111111111111'),
  ('22222222-2222-2222-2222-222222222222'),
  ('33333333-3333-3333-3333-333333333333'),
  ('44444444-4444-4444-4444-444444444444');

insert into public.membresias_usuario(
  user_id,empresa_id,local_id,todos_locales,rol,activo
) values
  ('11111111-1111-1111-1111-111111111111','E1','L1',false,'Propietario',true),
  ('22222222-2222-2222-2222-222222222222','E1','L1',false,'Cajero/a',true),
  ('33333333-3333-3333-3333-333333333333','E1','L1',false,'Camarero/a',true),
  ('44444444-4444-4444-4444-444444444444','E2','L2',false,'Propietario',true);

insert into public.cajas_fisicas(id,empresa_id,local_id,nombre,activo) values
  ('a1000000-0000-0000-0000-000000000001','E1','L1','Caja 1',true),
  ('a1000000-0000-0000-0000-000000000002','E1','L1','Caja 2',true),
  ('a1000000-0000-0000-0000-000000000003','E1','L1','Caja 3',true),
  ('a1000000-0000-0000-0000-000000000004','E1','L1','Caja 4 concurrencia',true),
  ('a1000000-0000-0000-0000-000000000005','E1','L1','Caja 5 concurrencia',true),
  ('a1000000-0000-0000-0000-000000000006','E1','L1','Caja 6 concurrencia',true),
  ('a2000000-0000-0000-0000-000000000001','E2','L2','Caja E2',true);

insert into public.terminales_tpv(id,empresa_id,local_id,nombre,device_key,activo) values
  ('b1000000-0000-0000-0000-000000000001','E1','L1','TPV 1','m04a-t1',true),
  ('b1000000-0000-0000-0000-000000000002','E1','L1','TPV 2','m04a-t2',true),
  ('b1000000-0000-0000-0000-000000000003','E1','L1','TPV 3','m04a-t3',true),
  ('b1000000-0000-0000-0000-000000000004','E1','L1','TPV 4','m04a-t4',true),
  ('b1000000-0000-0000-0000-000000000005','E1','L1','TPV 5','m04a-t5',true),
  ('b1000000-0000-0000-0000-000000000006','E1','L1','TPV 6','m04a-t6',true),
  ('b1000000-0000-0000-0000-000000000007','E1','L1','TPV 7','m04a-t7',true),
  ('b2000000-0000-0000-0000-000000000001','E2','L2','TPV E2','m04a-e2',true);

select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false);
select set_config('app.test_empresa','E1',false);
select set_config('app.test_local','L1',false);

set role authenticated;

select public.abc_abrir_sesion_caja(
  'M04A:open:1','E1','L1',
  'c1000000-0000-0000-0000-000000000001',
  'a1000000-0000-0000-0000-000000000001',
  '22222222-2222-2222-2222-222222222222',
  'b1000000-0000-0000-0000-000000000001',
  'EUR',100,'2026-09-23'
);

select public.abc_abrir_sesion_caja(
  'M04A:open:1','E1','L1',
  'c1000000-0000-0000-0000-000000000001',
  'a1000000-0000-0000-0000-000000000001',
  '22222222-2222-2222-2222-222222222222',
  'b1000000-0000-0000-0000-000000000001',
  'EUR',100,'2026-09-23'
);

reset role;

do $$
declare
  v_n integer;
  v_estado text;
  v_user uuid;
  v_importe numeric;
begin
  select estado into v_estado
    from public.caja_sesiones
   where id='c1000000-0000-0000-0000-000000000001';
  if v_estado<>'ABIERTA' then raise exception 'M04A_FAIL: sesion 1 no abierta'; end if;

  select count(*) into v_n
    from public.caja_sesion_terminales
   where session_id='c1000000-0000-0000-0000-000000000001'
     and terminal_id='b1000000-0000-0000-0000-000000000001'
     and hasta is null;
  if v_n<>1 then raise exception 'M04A_FAIL: replay duplico terminal'; end if;

  select user_id into v_user
    from public.caja_sesion_responsables
   where session_id='c1000000-0000-0000-0000-000000000001'
     and hasta is null;
  if v_user<>'22222222-2222-2222-2222-222222222222'::uuid then
    raise exception 'M04A_FAIL: responsable inicial incorrecto';
  end if;

  select count(*),min(importe) into v_n,v_importe
    from public.caja_operaciones
   where abc_command_id='M04A:open:1'
     and categoria='FONDO_INICIAL';
  if v_n<>1 or v_importe<>100 then
    raise exception 'M04A_FAIL: fondo inicial incorrecto n=% importe=%',v_n,v_importe;
  end if;
end $$;

set role authenticated;

select public.abc_abrir_sesion_caja(
  'M04A:open:2','E1','L1',
  'c1000000-0000-0000-0000-000000000002',
  'a1000000-0000-0000-0000-000000000002',
  '11111111-1111-1111-1111-111111111111',
  'b1000000-0000-0000-0000-000000000002',
  'EUR',0,'2026-09-23'
);

select public.abc_vincular_terminal_caja(
  'M04A:link:2:t3','E1','L1',
  'c1000000-0000-0000-0000-000000000002',
  'b1000000-0000-0000-0000-000000000003',
  '2026-09-23'
);

select public.abc_cambiar_responsable_caja(
  'M04A:responsable:2','E1','L1',
  'c1000000-0000-0000-0000-000000000002',
  '22222222-2222-2222-2222-222222222222',
  'Cambio de turno',
  'b1000000-0000-0000-0000-000000000002',
  '2026-09-23'
);

select public.abc_desvincular_terminal_caja(
  'M04A:unlink:2:t3','E1','L1',
  'c1000000-0000-0000-0000-000000000002',
  'b1000000-0000-0000-0000-000000000003',
  'Fin de apoyo',
  '2026-09-23'
);

do $$
begin
  begin
    perform public.abc_vincular_terminal_caja(
      'M04A:link:duplicate-terminal','E1','L1',
      'c1000000-0000-0000-0000-000000000002',
      'b1000000-0000-0000-0000-000000000001',
      '2026-09-23'
    );
    raise exception 'M04A_FAIL: terminal activo aceptado en otra sesion';
  exception when others then
    if sqlerrm not like '%terminal_ya_vinculado_otra_sesion%' then raise; end if;
  end;
end $$;

reset role;

do $$
declare
  v_n integer;
  v_user uuid;
begin
  select count(*) into v_n
    from public.caja_operaciones
   where abc_command_id='M04A:open:2';
  if v_n<>0 then raise exception 'M04A_FAIL: fondo cero creo movimiento'; end if;

  select count(*) into v_n
    from public.caja_sesion_terminales
   where session_id='c1000000-0000-0000-0000-000000000002'
     and hasta is null;
  if v_n<>1 then raise exception 'M04A_FAIL: esperaba un terminal activo tras desvinculo'; end if;

  select user_id into v_user
    from public.caja_sesion_responsables
   where session_id='c1000000-0000-0000-0000-000000000002'
     and hasta is null;
  if v_user<>'22222222-2222-2222-2222-222222222222'::uuid then
    raise exception 'M04A_FAIL: relevo no persistio';
  end if;

  select count(*) into v_n
    from public.caja_sesion_responsables
   where session_id='c1000000-0000-0000-0000-000000000002';
  if v_n<>2 then raise exception 'M04A_FAIL: historial de responsables incompleto'; end if;
end $$;

insert into public.caja_sesiones(
  id,empresa_id,local_id,caja_id,estado,version,abierta_at,abierta_por
) values (
  'c1000000-0000-0000-0000-000000000003','E1','L1',
  'a1000000-0000-0000-0000-000000000003',
  'PREPARANDO_APERTURA',1,null,'11111111-1111-1111-1111-111111111111'
);
insert into public.caja_sesion_terminales(
  empresa_id,local_id,session_id,terminal_id
) values (
  'E1','L1','c1000000-0000-0000-0000-000000000003',
  'b1000000-0000-0000-0000-000000000004'
);
insert into public.caja_sesion_responsables(
  empresa_id,local_id,session_id,user_id,asignado_por,motivo
) values (
  'E1','L1','c1000000-0000-0000-0000-000000000003',
  '11111111-1111-1111-1111-111111111111',
  '11111111-1111-1111-1111-111111111111','PREPARACION'
);

set role authenticated;
select public.abc_cancelar_apertura_caja(
  'M04A:cancel:3','E1','L1',
  'c1000000-0000-0000-0000-000000000003',
  'Apertura abortada',
  'b1000000-0000-0000-0000-000000000004',
  '2026-09-23'
);
reset role;

do $$
declare
  v_estado text;
  v_n integer;
begin
  select estado into v_estado
    from public.caja_sesiones
   where id='c1000000-0000-0000-0000-000000000003';
  if v_estado<>'APERTURA_CANCELADA' then raise exception 'M04A_FAIL: apertura no cancelada'; end if;

  select count(*) into v_n
    from public.caja_sesion_terminales
   where session_id='c1000000-0000-0000-0000-000000000003' and hasta is null;
  if v_n<>0 then raise exception 'M04A_FAIL: terminal quedo activo tras cancelacion'; end if;

  select count(*) into v_n
    from public.caja_sesion_responsables
   where session_id='c1000000-0000-0000-0000-000000000003' and hasta is null;
  if v_n<>0 then raise exception 'M04A_FAIL: responsable quedo activo tras cancelacion'; end if;
end $$;

select set_config('request.jwt.claim.sub','33333333-3333-3333-3333-333333333333',false);
set role authenticated;
do $$
begin
  begin
    perform public.abc_abrir_sesion_caja(
      'M04A:unauthorized','E1','L1',
      'c1000000-0000-0000-0000-000000000099',
      'a1000000-0000-0000-0000-000000000004',
      '33333333-3333-3333-3333-333333333333',
      'b1000000-0000-0000-0000-000000000005',
      'EUR',0,'2026-09-23'
    );
    raise exception 'M04A_FAIL: usuario sin capacidad opero caja';
  exception when others then
    if sqlerrm not like '%abc_caja_no_autorizado%' then raise; end if;
  end;
end $$;
reset role;

select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false);
set role authenticated;
do $$
begin
  begin
    perform public.abc_abrir_sesion_caja(
      'M04A:wrong-tenant','E2','L2',
      'c2000000-0000-0000-0000-000000000099',
      'a2000000-0000-0000-0000-000000000001',
      '44444444-4444-4444-4444-444444444444',
      'b2000000-0000-0000-0000-000000000001',
      'EUR',0,'2026-09-23'
    );
    raise exception 'M04A_FAIL: usuario E1 opero tenant E2';
  exception when others then
    if sqlerrm not like '%abc_caja_no_autorizado%' then raise; end if;
  end;
end $$;
reset role;

do $$
begin
  begin
    insert into public.caja_sesiones(
      id,empresa_id,local_id,caja_id,estado,version,abierta_at,abierta_por
    ) values (
      'c1000000-0000-0000-0000-000000000098','E1','L1',
      'a1000000-0000-0000-0000-000000000004',
      'ABIERTA',1,null,'11111111-1111-1111-1111-111111111111'
    );
    raise exception 'M04A_FAIL: ABIERTA sin abierta_at aceptada';
  exception when check_violation then null;
  end;
end $$;

set role authenticated;
do $$
begin
  begin
    insert into public.caja_sesiones(
      id,empresa_id,local_id,caja_id,estado,version,abierta_at,abierta_por
    ) values (
      'c1000000-0000-0000-0000-000000000097','E1','L1',
      'a1000000-0000-0000-0000-000000000004',
      'ABIERTA',1,now(),'11111111-1111-1111-1111-111111111111'
    );
    raise exception 'M04A_FAIL: authenticated pudo insertar directo';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

do $$
begin
  if not has_function_privilege(
    'authenticated',
    'public.abc_abrir_sesion_caja(text,text,text,uuid,uuid,uuid,uuid,text,numeric,date)',
    'EXECUTE'
  ) then raise exception 'M04A_FAIL: authenticated sin abrir sesion'; end if;

  if not has_function_privilege(
    'authenticated',
    'public.abc_vincular_terminal_caja(text,text,text,uuid,uuid,date)',
    'EXECUTE'
  ) then raise exception 'M04A_FAIL: authenticated sin vincular terminal'; end if;

  if not has_function_privilege(
    'authenticated',
    'public.abc_desvincular_terminal_caja(text,text,text,uuid,uuid,text,date)',
    'EXECUTE'
  ) then raise exception 'M04A_FAIL: authenticated sin desvincular terminal'; end if;

  if not has_function_privilege(
    'authenticated',
    'public.abc_cambiar_responsable_caja(text,text,text,uuid,uuid,text,uuid,date)',
    'EXECUTE'
  ) then raise exception 'M04A_FAIL: authenticated sin relevo'; end if;

  if not has_function_privilege(
    'authenticated',
    'public.abc_cancelar_apertura_caja(text,text,text,uuid,text,uuid,date)',
    'EXECUTE'
  ) then raise exception 'M04A_FAIL: authenticated sin cancelar apertura'; end if;

  if has_function_privilege(
    'anon',
    'public.abc_abrir_sesion_caja(text,text,text,uuid,uuid,uuid,uuid,text,numeric,date)',
    'EXECUTE'
  ) then raise exception 'M04A_FAIL: anon puede abrir sesion'; end if;

  if has_function_privilege(
    'authenticated',
    'private.abc_usuario_activo_local(text,text,uuid)',
    'EXECUTE'
  ) then raise exception 'M04A_FAIL: helper privado expuesto'; end if;
end $$;

select 'ABC_F2_M04A_CONTRACT=PASS' as resultado;
