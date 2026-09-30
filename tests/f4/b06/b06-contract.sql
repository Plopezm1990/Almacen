\set ON_ERROR_STOP on

-- F4 B06 / subpunto 1: los conceptos no venta tienen frontera propia,
-- no dependen de checkout_ventas/pagos y no admiten escritura directa.

do $$
declare
  v_rls boolean;
  v_def text;
begin
  if to_regclass('public.abc_cobros_no_venta') is null then
    raise exception 'F4_B06_FAIL: falta ledger no venta';
  end if;

  select c.relrowsecurity into v_rls
    from pg_class c
    join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='public' and c.relname='abc_cobros_no_venta';
  if v_rls is not true then
    raise exception 'F4_B06_FAIL: RLS no activado';
  end if;

  if has_table_privilege('anon','public.abc_cobros_no_venta','SELECT')
     or has_table_privilege('authenticated','public.abc_cobros_no_venta','INSERT')
     or has_table_privilege('authenticated','public.abc_cobros_no_venta','UPDATE')
     or has_table_privilege('authenticated','public.abc_cobros_no_venta','DELETE')
     or not has_table_privilege('authenticated','public.abc_cobros_no_venta','SELECT') then
    raise exception 'F4_B06_FAIL: ACL de ledger no venta incorrecta';
  end if;

  select pg_get_constraintdef(oid) into v_def
    from pg_constraint
   where conrelid='public.abc_cobros_no_venta'::regclass
     and conname='abc_cobro_no_venta_concepto';
  if coalesce(v_def,'') not like '%PROPINA%'
     or coalesce(v_def,'') not like '%ANTICIPO%'
     or coalesce(v_def,'') not like '%FIANZA%' then
    raise exception 'F4_B06_FAIL: conceptos no venta incompletos';
  end if;

  if exists (
    select 1 from information_schema.columns
     where table_schema='public'
       and table_name='abc_cobros_no_venta'
       and column_name in ('venta_fiscal_id','checkout_id','checkout_venta_id')
  ) then
    raise exception 'F4_B06_FAIL: ledger no venta acoplado a venta ordinaria';
  end if;

  if not exists (
    select 1 from pg_policies
     where schemaname='public'
       and tablename='abc_cobros_no_venta'
       and policyname='abc_cobros_no_venta_select'
       and cmd='SELECT'
  ) then
    raise exception 'F4_B06_FAIL: política de lectura ausente';
  end if;

  if to_regclass('public.abc_anticipo_movimientos') is null then
    raise exception 'F4_B06_FAIL: falta relación de aplicación/devolución';
  end if;
  if not exists (
    select 1 from pg_constraint
     where conrelid='public.abc_anticipo_movimientos'::regclass
       and conname='abc_anticipo_movimiento_source_fk'
  ) or not exists (
    select 1 from pg_constraint
     where conrelid='public.abc_anticipo_movimientos'::regclass
       and conname='abc_anticipo_movimiento_venta_fk'
  ) then
    raise exception 'F4_B06_FAIL: relaciones de origen/destino incompletas';
  end if;

  if has_table_privilege('anon','public.abc_anticipo_movimientos','SELECT')
     or has_table_privilege('authenticated','public.abc_anticipo_movimientos','INSERT')
     or has_table_privilege('authenticated','public.abc_anticipo_movimientos','UPDATE')
     or has_table_privilege('authenticated','public.abc_anticipo_movimientos','DELETE')
     or not has_table_privilege('authenticated','public.abc_anticipo_movimientos','SELECT') then
    raise exception 'F4_B06_FAIL: ACL de trazabilidad incorrecta';
  end if;

  if to_regprocedure('private.abc_b06_validar_anticipo_movimiento()') is null
     or not exists (
       select 1 from pg_trigger
        where tgrelid='public.abc_anticipo_movimientos'::regclass
          and tgname='abc_b06_anticipo_movimiento_guard'
          and not tgisinternal
     ) then
    raise exception 'F4_B06_FAIL: guardia de fuente de anticipo ausente';
  end if;

  if to_regprocedure('public.abc_registrar_movimiento_anticipo(text,text,text,uuid,text,numeric,text,uuid,text,text,date,uuid,jsonb)') is null
     or not has_function_privilege(
       'authenticated',
       'public.abc_registrar_movimiento_anticipo(text,text,text,uuid,text,numeric,text,uuid,text,text,date,uuid,jsonb)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'public.abc_registrar_movimiento_anticipo(text,text,text,uuid,text,numeric,text,uuid,text,text,date,uuid,jsonb)',
       'EXECUTE'
     ) then
    raise exception 'F4_B06_FAIL: ACL de RPC de saldo incorrecta';
  end if;

  if strpos(
       pg_get_functiondef(
         'public.abc_registrar_movimiento_anticipo(text,text,text,uuid,text,numeric,text,uuid,text,text,date,uuid,jsonb)'::regprocedure
       ),
       'b06_saldo_insuficiente'
     ) = 0
     or strpos(
       pg_get_functiondef(
         'public.abc_registrar_movimiento_anticipo(text,text,text,uuid,text,numeric,text,uuid,text,text,date,uuid,jsonb)'::regprocedure
       ),
       'abc_operacion_iniciar'
     ) = 0 then
    raise exception 'F4_B06_FAIL: guardas de saldo/idempotencia ausentes';
  end if;

  if to_regclass('public.abc_b06_politica_conceptos') is null then
    raise exception 'F4_B06_FAIL: falta catálogo de política B06';
  end if;
  if (select count(*) from public.abc_b06_politica_conceptos)<>3
     or exists (
       select 1 from public.abc_b06_politica_conceptos
        where estado_definicion<>'PENDIENTE_ASESORIA'
           or tratamiento_fiscal<>'PENDIENTE_ASESORIA'
           or documento_requerido<>'PENDIENTE_ASESORIA'
           or cuenta_contable<>'PENDIENTE_ASESORIA'
     ) then
    raise exception 'F4_B06_FAIL: política fiscal/documental/contable no queda pendiente de asesoría';
  end if;
  if not exists (
    select 1 from public.abc_b06_politica_conceptos
     where concepto='FIANZA' and requiere_titular
  ) or not exists (
    select 1 from public.abc_b06_politica_conceptos
     where concepto='ANTICIPO' and requiere_encargo
  ) then
    raise exception 'F4_B06_FAIL: requisitos de titular/encargo incompletos';
  end if;
  if not exists (
    select 1 from pg_constraint
     where conrelid='public.abc_cobros_no_venta'::regclass
       and conname='abc_cobro_no_venta_politica_fk'
  ) then
    raise exception 'F4_B06_FAIL: cobro no venta sin política referenciada';
  end if;
end $$;

-- Prueba funcional mínima: una aplicación consume saldo una sola vez y una
-- segunda petición que supera el saldo queda rechazada por el servidor.
insert into public.abc_operaciones(
  operation_id,empresa_id,local_id,command_type,request_hash,status,
  actor_user_id,request,resultado,completed_at
) values (
  'b06.source.0001','emp-f4b04','loc-f4b04','B06_SOURCE',repeat('a',64),
  'COMPLETADA','11111111-2222-3333-4444-555555555561','{}'::jsonb,
  '{"ok":true}'::jsonb,now()
);
insert into public.abc_cobros_no_venta(
  id,empresa_id,local_id,abc_command_id,concepto,importe,currency_code,medio,
  encargo_id,titular_id,responsable_user_id,operating_day,created_by
) values (
  'b0600000-0000-0000-0000-000000000001','emp-f4b04','loc-f4b04',
  'b06.source.0001','ANTICIPO',5,'EUR','EFECTIVO','encargo-b06-1',null,
  '11111111-2222-3333-4444-555555555561','2026-09-29',
  '11111111-2222-3333-4444-555555555561'
);

-- La aplicación necesita un destino fiscal real; el fixture común de B04/B05
-- solo prepara cuentas y cobros, no fiscaliza una venta.
insert into public.ventas_fiscales(
  id,empresa_id,local_id,cuenta_id,entidad_fiscal_id,currency_code,
  estado,version,subtotal,descuento_total,impuestos_total,total,
  snapshot_calculo,created_by,created_operating_day
) values (
  'b0600000-0000-0000-0000-000000000002',
  'emp-f4b04','loc-f4b04',
  '50000000-2222-3333-4444-555555555561',
  '10000000-2222-3333-4444-555555555561','EUR',
  'ABIERTA',1,4,0,0,4,'{"test":"B06"}'::jsonb,
  '11111111-2222-3333-4444-555555555561','2026-09-29'
);

select set_config('request.jwt.claim.sub','11111111-2222-3333-4444-555555555561',false);
set role authenticated;
do $$
declare
  v_venta uuid;
  v_first jsonb;
  v_replay jsonb;
  v_movimientos integer;
begin
  -- El SELECT directo estaría sujeto a RLS bajo authenticated; la RPC valida
  -- la existencia del destino con SECURITY DEFINER.
  v_venta := 'b0600000-0000-0000-0000-000000000002';

  v_first:=public.abc_registrar_movimiento_anticipo(
    'b06.apply.0001','emp-f4b04','loc-f4b04',
    'b0600000-0000-0000-0000-000000000001','APLICACION',4,'EUR',
    v_venta,null,null,'2026-09-29',null,'{}'::jsonb
  );
  v_replay:=public.abc_registrar_movimiento_anticipo(
    'b06.apply.0001','emp-f4b04','loc-f4b04',
    'b0600000-0000-0000-0000-000000000001','APLICACION',4,'EUR',
    v_venta,null,null,'2026-09-29',null,'{}'::jsonb
  );

  if (v_first->>'ok')::boolean is not true
     or (v_first->>'saldo_disponible')::numeric<>1
     or (v_replay->>'saldo_disponible')::numeric<>1 then
    raise exception 'F4_B06_FAIL: replay o saldo de aplicación incorrecto';
  end if;
  select count(*) into v_movimientos
    from public.abc_anticipo_movimientos
   where anticipo_id='b0600000-0000-0000-0000-000000000001'
     and abc_command_id='b06.apply.0001';
  if v_movimientos<>1 then raise exception 'F4_B06_FAIL: replay duplicó movimiento'; end if;

  begin
    perform public.abc_registrar_movimiento_anticipo(
      'b06.apply.overflow','emp-f4b04','loc-f4b04',
      'b0600000-0000-0000-0000-000000000001','APLICACION',2,'EUR',
      v_venta,null,null,'2026-09-29',null,'{}'::jsonb
    );
    raise exception 'F4_B06_FAIL: permitió superar saldo de anticipo';
  exception when others then
    if sqlerrm not like '%b06_saldo_insuficiente%' then raise; end if;
  end;
end $$;
reset role;

select 'ABC_F4_B06=PASS' as result;
