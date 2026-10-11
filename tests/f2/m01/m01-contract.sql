\set ON_ERROR_STOP on

do $$
declare missing text[];
begin
  select array_agg(x) into missing
  from unnest(array[
    'terminales_tpv','abc_operaciones','abc_eventos','cajas_fisicas',
    'caja_sesiones','caja_sesion_terminales','caja_cierres','caja_conteos',
    'efectos_pendientes'
  ]) x
  where to_regclass('public.'||x) is null;
  if missing is not null then
    raise exception 'M01 tablas ausentes: %',missing;
  end if;
end $$;

insert into public.empresas(id,nombre) values ('E1','Empresa 1'),('E2','Empresa 2');
insert into public.locales(id,empresa_id,nombre) values ('L1','E1','Local 1'),('L2','E2','Local 2');
insert into auth.users(id) values
  ('11111111-1111-1111-1111-111111111111'),
  ('22222222-2222-2222-2222-222222222222');

insert into public.terminales_tpv(id,empresa_id,local_id,nombre,device_key) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1','E1','L1','TPV 1','dev-e1-l1-1'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2','E2','L2','TPV 2','dev-e2-l2-1');

insert into public.cajas_fisicas(id,empresa_id,local_id,nombre) values
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1','E1','L1','Caja 1'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2','E2','L2','Caja 2'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb3','E1','L1','Caja 3');

-- Compatibilidad legacy: las nuevas columnas de caja_operaciones pueden quedar NULL.
insert into public.caja_operaciones(
  operation_id,tipo,empresa_id,local_id,fecha,importe,efecto_efectivo,
  medio_pago,concepto,origen_tipo,payload,actor_user_id
) values (
  'legacy-caja-0001','ENTRADA','E1','L1','2026-09-23',10,10,
  'EFECTIVO','Legacy válido','MANUAL','{}',
  '11111111-1111-1111-1111-111111111111'
);

-- operation_id global: una identidad ya reclamada por ABC no puede reutilizarse en caja.
insert into public.abc_operaciones(
  operation_id,empresa_id,local_id,command_type,request_hash,status,
  actor_user_id,terminal_id,request
) values (
  'abc-op-00000001','E1','L1','OPEN_CASH_SESSION',
  repeat('a',64),'PROCESANDO',
  '11111111-1111-1111-1111-111111111111',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1','{}'
);

do $$
begin
  begin
    insert into public.caja_operaciones(
      operation_id,tipo,empresa_id,local_id,fecha,importe,efecto_efectivo,
      medio_pago,concepto,origen_tipo,payload,actor_user_id
    ) values (
      'abc-op-00000001','ENTRADA','E1','L1','2026-09-23',1,1,
      'EFECTIVO','Debe colisionar','MANUAL','{}',
      '11111111-1111-1111-1111-111111111111'
    );
    raise exception 'M01_FAIL: operation_id global duplicado aceptado';
  exception when others then
    if position('operation_id_conflict' in sqlerrm)=0 then raise; end if;
  end;
end $$;

-- Una sola sesión activa por caja física.
insert into public.caja_sesiones(
  id,empresa_id,local_id,caja_id,estado,version,abierta_at,abierta_por
) values (
  'cccccccc-cccc-cccc-cccc-ccccccccccc1','E1','L1',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1','ABIERTA',1,now(),
  '11111111-1111-1111-1111-111111111111'
);

do $$
begin
  begin
    insert into public.caja_sesiones(
      id,empresa_id,local_id,caja_id,estado,version,abierta_at,abierta_por
    ) values (
      'cccccccc-cccc-cccc-cccc-ccccccccccc2','E1','L1',
      'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1','ABIERTA',1,now(),
      '11111111-1111-1111-1111-111111111111'
    );
    raise exception 'M01_FAIL: dos sesiones activas aceptadas';
  exception when unique_violation then null;
  end;
end $$;

-- El contexto compuesto impide cruzar tenant/local.
do $$
begin
  begin
    insert into public.caja_sesiones(
      id,empresa_id,local_id,caja_id,estado,version,abierta_at,abierta_por
    ) values (
      'cccccccc-cccc-cccc-cccc-ccccccccccc3','E2','L2',
      'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb3','ABIERTA',1,now(),
      '22222222-2222-2222-2222-222222222222'
    );
    raise exception 'M01_FAIL: caja cross-tenant aceptada';
  exception when foreign_key_violation then null;
  end;
end $$;

-- Una sola operación de cierre activa y un solo cierre final por sesión.
insert into public.caja_cierres(
  id,empresa_id,local_id,session_id,estado,version,expected_snapshot,iniciado_por
) values (
  'dddddddd-dddd-dddd-dddd-ddddddddddd1','E1','L1',
  'cccccccc-cccc-cccc-cccc-ccccccccccc1','INICIADO',1,'{}',
  '11111111-1111-1111-1111-111111111111'
);

do $$
begin
  begin
    insert into public.caja_cierres(
      id,empresa_id,local_id,session_id,estado,version,expected_snapshot,iniciado_por
    ) values (
      'dddddddd-dddd-dddd-dddd-ddddddddddd2','E1','L1',
      'cccccccc-cccc-cccc-cccc-ccccccccccc1','PROVISIONAL',1,'{}',
      '11111111-1111-1111-1111-111111111111'
    );
    raise exception 'M01_FAIL: dos cierres activos aceptados';
  exception when unique_violation then null;
  end;
end $$;

-- Conteos múltiples y separados por moneda.
insert into public.caja_conteos(
  id,empresa_id,local_id,cierre_id,currency_code,numero,counted_amount,actor_user_id
) values
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee1','E1','L1','dddddddd-dddd-dddd-dddd-ddddddddddd1','EUR',1,100,
   '11111111-1111-1111-1111-111111111111'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee2','E1','L1','dddddddd-dddd-dddd-dddd-ddddddddddd1','EUR',2,99,
   '11111111-1111-1111-1111-111111111111'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee3','E1','L1','dddddddd-dddd-dddd-dddd-ddddddddddd1','USD',1,50,
   '11111111-1111-1111-1111-111111111111');

do $$
begin
  begin
    insert into public.caja_conteos(
      id,empresa_id,local_id,cierre_id,currency_code,numero,counted_amount,actor_user_id
    ) values (
      'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee4','E1','L1',
      'dddddddd-dddd-dddd-dddd-ddddddddddd1','EU',1,10,
      '11111111-1111-1111-1111-111111111111'
    );
    raise exception 'M01_FAIL: moneda inválida aceptada';
  exception when check_violation then null;
  end;
end $$;

-- Una operación de caja ABC exige contexto completo.
do $$
begin
  begin
    insert into public.caja_operaciones(
      operation_id,tipo,empresa_id,local_id,fecha,importe,efecto_efectivo,
      medio_pago,concepto,origen_tipo,payload,actor_user_id,abc_command_id
    ) values (
      'abc-op-00000001:cash:bad','ENTRADA','E1','L1','2026-09-23',10,10,
      'EFECTIVO','ABC incompleto','ABC','{}',
      '11111111-1111-1111-1111-111111111111','abc-op-00000001'
    );
    raise exception 'M01_FAIL: caja ABC incompleta aceptada';
  exception when check_violation then null;
  end;
end $$;

insert into public.caja_operaciones(
  operation_id,tipo,empresa_id,local_id,fecha,importe,efecto_efectivo,
  medio_pago,concepto,origen_tipo,payload,actor_user_id,
  abc_command_id,caja_id,session_id,terminal_id,currency_code,operating_day,occurred_at,categoria
) values (
  'abc-op-00000001:cash:1','ENTRADA','E1','L1','2026-09-23',10,10,
  'EFECTIVO','Fondo ABC','ABC','{}',
  '11111111-1111-1111-1111-111111111111',
  'abc-op-00000001',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1',
  'cccccccc-cccc-cccc-cccc-ccccccccccc1',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
  'EUR','2026-09-23',now(),'FONDO_APERTURA'
);

-- Outbox: deduplicación dentro de empresa.
insert into public.efectos_pendientes(
  id,empresa_id,local_id,abc_command_id,tipo,dedupe_key,payload
) values (
  'ffffffff-ffff-ffff-ffff-fffffffffff1','E1','L1',
  'abc-op-00000001','IMPRESION','ticket:abc-op-00000001','{}'
);

do $$
begin
  begin
    insert into public.efectos_pendientes(
      id,empresa_id,local_id,abc_command_id,tipo,dedupe_key,payload
    ) values (
      'ffffffff-ffff-ffff-ffff-fffffffffff2','E1','L1',
      'abc-op-00000001','IMPRESION','ticket:abc-op-00000001','{}'
    );
    raise exception 'M01_FAIL: dedupe_key duplicada aceptada';
  exception when unique_violation then null;
  end;
end $$;

-- RLS de lectura por local y ausencia de mutación directa.
set role authenticated;
select set_config('app.test_empresa','E1',false);
select set_config('app.test_local','L1',false);

do $$
declare n integer;
begin
  select count(*) into n from public.terminales_tpv;
  if n<>1 then raise exception 'M01_FAIL: RLS esperaba 1 terminal y obtuvo %',n; end if;
  if exists (
    select 1
    from information_schema.role_table_grants
    where table_schema='public'
      and table_name in (
        'terminales_tpv','abc_operaciones','abc_eventos','cajas_fisicas',
        'caja_sesiones','caja_sesion_terminales','caja_cierres','caja_conteos',
        'efectos_pendientes'
      )
      and grantee='authenticated'
      and privilege_type in ('INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER')
  ) then
    raise exception 'M01_FAIL: authenticated conserva privilegios directos no permitidos';
  end if;

  if exists (
    select 1
    from information_schema.role_table_grants
    where table_schema='public'
      and table_name in (
        'terminales_tpv','abc_operaciones','abc_eventos','cajas_fisicas',
        'caja_sesiones','caja_sesion_terminales','caja_cierres','caja_conteos',
        'efectos_pendientes'
      )
      and grantee='anon'
  ) then
    raise exception 'M01_FAIL: anon conserva privilegios directos sobre tablas M01';
  end if;

  if not has_table_privilege('authenticated','public.terminales_tpv','SELECT')
     or not has_table_privilege('authenticated','public.cajas_fisicas','SELECT')
     or not has_table_privilege('authenticated','public.caja_sesiones','SELECT')
     or not has_table_privilege('authenticated','public.caja_sesion_terminales','SELECT')
     or not has_table_privilege('authenticated','public.caja_cierres','SELECT')
     or not has_table_privilege('authenticated','public.caja_conteos','SELECT') then
    raise exception 'M01_FAIL: falta SELECT operativo autorizado';
  end if;

  if has_table_privilege('authenticated','public.abc_operaciones','SELECT')
     or has_table_privilege('authenticated','public.abc_eventos','SELECT')
     or has_table_privilege('authenticated','public.efectos_pendientes','SELECT') then
    raise exception 'M01_FAIL: ledger interno expuesto por SELECT directo';
  end if;

  if has_sequence_privilege('authenticated','public.abc_eventos_id_seq','USAGE')
     or has_sequence_privilege('authenticated','public.abc_eventos_id_seq','SELECT')
     or has_sequence_privilege('authenticated','public.abc_eventos_id_seq','UPDATE')
     or has_sequence_privilege('anon','public.abc_eventos_id_seq','USAGE')
     or has_sequence_privilege('anon','public.abc_eventos_id_seq','SELECT')
     or has_sequence_privilege('anon','public.abc_eventos_id_seq','UPDATE') then
    raise exception 'M01_FAIL: secuencia interna abc_eventos expuesta';
  end if;
end $$;
reset role;

-- Tras cerrar la sesión anterior, puede abrirse una nueva en la misma caja.
update public.caja_cierres
   set estado='FINAL',
       finalizado_por='11111111-1111-1111-1111-111111111111',
       completed_at=now()
 where id='dddddddd-dddd-dddd-dddd-ddddddddddd1';

update public.caja_sesiones
   set estado='CERRADA_FINAL',cerrada_at=now(),version=2
 where id='cccccccc-cccc-cccc-cccc-ccccccccccc1';

insert into public.caja_sesiones(
  id,empresa_id,local_id,caja_id,estado,version,abierta_at,abierta_por
) values (
  'cccccccc-cccc-cccc-cccc-ccccccccccc4','E1','L1',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1','ABIERTA',1,now(),
  '11111111-1111-1111-1111-111111111111'
);

select 'ABC_F2_M01_CONTRACT=PASS' as resultado;
