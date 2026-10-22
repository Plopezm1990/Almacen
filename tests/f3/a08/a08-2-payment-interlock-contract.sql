\set ON_ERROR_STOP on

-- A08.2.1: preservación de partes pagadas/fiscalizadas + bloqueo de cobro incierto.
-- Se ejecuta después de tests/f3/a08/a08-contract.sql sobre PostgreSQL desechable.

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000021',false);

-- Seguridad de helpers privados.
do $$
begin
  if has_function_privilege('authenticated',
      'private.abc_cuenta_tiene_cobro_incierto(text,text,uuid)','EXECUTE')
     or has_function_privilege('anon',
      'private.abc_cuenta_tiene_cobro_incierto(text,text,uuid)','EXECUTE')
     or has_function_privilege('service_role',
      'private.abc_cuenta_tiene_cobro_incierto(text,text,uuid)','EXECUTE') then
    raise exception 'A08_2_FAIL: helper de detección expuesto';
  end if;
  if has_function_privilege('authenticated',
      'private.abc_bloquear_cuenta_cobro_interlock(text,text,uuid)','EXECUTE')
     or has_function_privilege('anon',
      'private.abc_bloquear_cuenta_cobro_interlock(text,text,uuid)','EXECUTE')
     or has_function_privilege('service_role',
      'private.abc_bloquear_cuenta_cobro_interlock(text,text,uuid)','EXECUTE') then
    raise exception 'A08_2_FAIL: helper de lock expuesto';
  end if;
  if has_function_privilege('authenticated',
      'private.abc_exigir_cuenta_sin_cobro_incierto(text,text,uuid)','EXECUTE')
     or has_function_privilege('anon',
      'private.abc_exigir_cuenta_sin_cobro_incierto(text,text,uuid)','EXECUTE')
     or has_function_privilege('service_role',
      'private.abc_exigir_cuenta_sin_cobro_incierto(text,text,uuid)','EXECUTE') then
    raise exception 'A08_2_FAIL: helper guard expuesto';
  end if;
end $$;

-- Las ACL públicas existentes deben sobrevivir a CREATE OR REPLACE.
do $$
begin
  if not has_function_privilege('authenticated',
      'public.abc_mover_cantidad_linea_cuenta(text,text,text,uuid,uuid,uuid,numeric,text,bigint,bigint,bigint,uuid,uuid,date)','EXECUTE')
     or not has_function_privilege('authenticated',
      'public.abc_asignar_cuota_importe(text,text,text,uuid,uuid,numeric,text,bigint,bigint,uuid,uuid,date)','EXECUTE')
     or not has_function_privilege('authenticated',
      'public.abc_unir_cuentas(text,text,text,uuid,uuid,text,bigint,bigint,uuid,uuid,date)','EXECUTE')
     or not has_function_privilege('authenticated',
      'public.abc_iniciar_cobro(text,text,text,uuid,uuid,uuid,text,numeric,text,uuid,numeric,numeric)','EXECUTE')
     or not has_function_privilege('service_role',
      'public.abc_resolver_intento(text,text,text,uuid,text,text,text,numeric,numeric,numeric,jsonb)','EXECUTE') then
    raise exception 'A08_2_FAIL: ACL pública cambió';
  end if;
end $$;

-- Antes de iniciar cobro la cuenta no debe estar marcada como incierta.
do $$
begin
  if private.abc_cuenta_tiene_cobro_incierto(
      'emp-f','loc-f1','50000000-0000-0000-0000-000000000011') then
    raise exception 'A08_2_FAIL: falso positivo de cobro incierto';
  end if;
end $$;

-- La venta fiscal creada por el contrato A08 tiene total EUR 11.
select public.abc_abrir_checkout(
  'a082.checkout.open',
  'emp-f','loc-f1',
  '83000000-0000-0000-0000-000000000001',
  '50000000-0000-0000-0000-000000000011',
  array['81000000-0000-0000-0000-000000000001'::uuid],
  date '2026-09-24'
);

select public.abc_iniciar_cobro(
  'a082.payment.start',
  'emp-f','loc-f1',
  '83000000-0000-0000-0000-000000000001',
  '84000000-0000-0000-0000-000000000001',
  '85000000-0000-0000-0000-000000000001',
  'TARJETA',11,'EUR',
  '20000000-0000-0000-0000-000000000013',
  null,null
);

do $$
begin
  if not private.abc_cuenta_tiene_cobro_incierto(
      'emp-f','loc-f1','50000000-0000-0000-0000-000000000011') then
    raise exception 'A08_2_FAIL: PENDIENTE no detectado';
  end if;
  if not exists(
    select 1 from public.reservas_saldo
    where empresa_id='emp-f' and local_id='loc-f1'
      and intento_id='85000000-0000-0000-0000-000000000001'
      and estado='ACTIVA'
  ) then
    raise exception 'A08_2_FAIL: iniciar cobro no creó reserva activa';
  end if;
end $$;

-- Con PENDIENTE, incluso una línea no fiscalizada en la otra cuenta no puede volver
-- a una cuenta afectada por el cobro incierto.
do $$
declare
  v_o bigint; v_d bigint; v_l bigint;
begin
  select version into v_o from public.cuentas_comerciales
   where id='50000000-0000-0000-0000-000000000012';
  select version into v_d from public.cuentas_comerciales
   where id='50000000-0000-0000-0000-000000000011';
  select version into v_l from public.pedido_lineas
   where id='70000000-0000-0000-0000-000000000011';

  begin
    perform public.abc_mover_cantidad_linea_cuenta(
      'a082.block.pending',
      'emp-f','loc-f1',
      '70000000-0000-0000-0000-000000000011',
      '50000000-0000-0000-0000-000000000012',
      '50000000-0000-0000-0000-000000000011',
      1,null,v_o,v_d,v_l,
      '20000000-0000-0000-0000-000000000013',
      '40000000-0000-0000-0000-000000000008',
      date '2026-09-24'
    );
    raise exception 'A08_2_FAIL: reparto aceptado con pago PENDIENTE';
  exception when others then
    if sqlerrm not like '%cuenta_con_cobro_incierto%' then raise; end if;
  end;
end $$;

-- El estado AUTORIZADO sigue siendo incierto.
select public.abc_resolver_intento(
  'a082.resolve.authorized',
  'emp-f','loc-f1',
  '85000000-0000-0000-0000-000000000001',
  'AUTORIZADO','SIMULADOR','a082-provider-ref',
  11,null,null,'{"fase":"autorizado"}'::jsonb
);

do $$
begin
  if not private.abc_cuenta_tiene_cobro_incierto(
      'emp-f','loc-f1','50000000-0000-0000-0000-000000000011') then
    raise exception 'A08_2_FAIL: AUTORIZADO no detectado';
  end if;
end $$;

-- DESCONOCIDO también debe inmovilizar el reparto.
select public.abc_resolver_intento(
  'a082.resolve.unknown',
  'emp-f','loc-f1',
  '85000000-0000-0000-0000-000000000001',
  'DESCONOCIDO','SIMULADOR','a082-provider-ref',
  11,null,null,'{"fase":"desconocido"}'::jsonb
);

do $$
begin
  if not private.abc_cuenta_tiene_cobro_incierto(
      'emp-f','loc-f1','50000000-0000-0000-0000-000000000011') then
    raise exception 'A08_2_FAIL: DESCONOCIDO no detectado';
  end if;
end $$;

-- Al resolverse como RECHAZADO se liberan reservas y vuelve a permitirse A08.
select public.abc_resolver_intento(
  'a082.resolve.rejected',
  'emp-f','loc-f1',
  '85000000-0000-0000-0000-000000000001',
  'RECHAZADO','SIMULADOR','a082-provider-ref',
  11,null,null,'{"fase":"rechazado"}'::jsonb
);

do $$
begin
  if private.abc_cuenta_tiene_cobro_incierto(
      'emp-f','loc-f1','50000000-0000-0000-0000-000000000011') then
    raise exception 'A08_2_FAIL: cobro resuelto sigue bloqueando';
  end if;
  if exists(
    select 1 from public.reservas_saldo
    where empresa_id='emp-f' and local_id='loc-f1'
      and intento_id='85000000-0000-0000-0000-000000000001'
      and estado='ACTIVA'
  ) then
    raise exception 'A08_2_FAIL: reserva no liberada tras rechazo';
  end if;
  if (select estado from public.pagos
      where id='84000000-0000-0000-0000-000000000001')<>'RECHAZADO'
     or (select estado from public.pago_intentos
      where id='85000000-0000-0000-0000-000000000001')<>'RECHAZADO' then
    raise exception 'A08_2_FAIL: pago/intento no terminaron RECHAZADO';
  end if;
end $$;

-- El mismo movimiento ahora sí debe aplicar. La unidad fiscalizada original no cambia.
do $$
declare
  v_o bigint; v_d bigint; v_l bigint; v_result jsonb;
begin
  select version into v_o from public.cuentas_comerciales
   where id='50000000-0000-0000-0000-000000000012';
  select version into v_d from public.cuentas_comerciales
   where id='50000000-0000-0000-0000-000000000011';
  select version into v_l from public.pedido_lineas
   where id='70000000-0000-0000-0000-000000000011';

  v_result:=public.abc_mover_cantidad_linea_cuenta(
    'a082.move.after-reject',
    'emp-f','loc-f1',
    '70000000-0000-0000-0000-000000000011',
    '50000000-0000-0000-0000-000000000012',
    '50000000-0000-0000-0000-000000000011',
    1,null,v_o,v_d,v_l,
    '20000000-0000-0000-0000-000000000013',
    '40000000-0000-0000-0000-000000000008',
    date '2026-09-24'
  );
  if coalesce((v_result->>'ok')::boolean,false) is not true then
    raise exception 'A08_2_FAIL: movimiento posterior al rechazo no aplicó %',v_result;
  end if;

  if private.abc_cantidad_fiscalizada_linea_cuenta(
      'emp-f','loc-f1',
      '70000000-0000-0000-0000-000000000011',
      '50000000-0000-0000-0000-000000000011')<>1 then
    raise exception 'A08_2_FAIL: parte fiscalizada cambió';
  end if;
end $$;

-- Contrato estructural: las cuatro operaciones A08 deben invocar el guard y
-- las tres transiciones de cobro deben tomar el lock de cuenta.
do $$
declare d text;
begin
  foreach d in array array[
    pg_get_functiondef('public.abc_mover_cantidad_linea_cuenta(text,text,text,uuid,uuid,uuid,numeric,text,bigint,bigint,bigint,uuid,uuid,date)'::regprocedure),
    pg_get_functiondef('public.abc_asignar_cuota_importe(text,text,text,uuid,uuid,numeric,text,bigint,bigint,uuid,uuid,date)'::regprocedure),
    pg_get_functiondef('public.abc_revertir_cuota_importe(text,text,text,uuid,bigint,bigint,bigint,uuid,uuid,date)'::regprocedure),
    pg_get_functiondef('public.abc_unir_cuentas(text,text,text,uuid,uuid,text,bigint,bigint,uuid,uuid,date)'::regprocedure)
  ] loop
    if position('private.abc_exigir_cuenta_sin_cobro_incierto' in d)=0 then
      raise exception 'A08_2_FAIL: RPC A08 sin guard de cobro incierto';
    end if;
  end loop;

  foreach d in array array[
    pg_get_functiondef('public.abc_iniciar_cobro(text,text,text,uuid,uuid,uuid,text,numeric,text,uuid,numeric,numeric)'::regprocedure),
    pg_get_functiondef('public.abc_confirmar_efectivo(text,text,text,uuid,uuid,uuid,uuid,date)'::regprocedure),
    pg_get_functiondef('public.abc_resolver_intento(text,text,text,uuid,text,text,text,numeric,numeric,numeric,jsonb)'::regprocedure)
  ] loop
    if position('private.abc_bloquear_cuenta_cobro_interlock' in d)=0 then
      raise exception 'A08_2_FAIL: RPC de cobro sin lock compartido de cuenta';
    end if;
  end loop;
end $$;

select 'ABC_F3_A08_2_1_PAYMENT_INTERLOCK=PASS' as resultado;
