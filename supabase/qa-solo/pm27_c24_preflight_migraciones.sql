-- PM27 / C24 — preflight agregado de migraciones pendientes.
-- SOLO LECTURA. No aplica cambios funcionales ni marca migraciones.
-- Diseñado para ejecutarse con psql antes del lote C13 -> C23.

begin;
set local transaction read only;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $c24_preflight$
declare
  v_def text;
  v_markers text[] := array[]::text[];
  v_bad integer := 0;
begin
  -- -----------------------------------------------------------------------
  -- 1. Dependencias base: una instalación incompleta debe abortar aquí.
  -- -----------------------------------------------------------------------
  if to_regclass('public.perfiles') is null then
    raise exception 'PM27_C24_PREFLIGHT_FALLO: falta public.perfiles';
  end if;
  if to_regclass('public.membresias_usuario') is null then
    raise exception 'PM27_C24_PREFLIGHT_FALLO: falta public.membresias_usuario';
  end if;
  if to_regclass('public.almacen_kv') is null then
    raise exception 'PM27_C24_PREFLIGHT_FALLO: falta public.almacen_kv';
  end if;
  if to_regclass('public.stock_ubicacion') is null
     or to_regclass('public.stock_operaciones') is null
     or to_regclass('public.movimientos_stock') is null then
    raise exception 'PM27_C24_PREFLIGHT_FALLO: faltan tablas base de stock';
  end if;
  if to_regclass('public.encargos_empresa') is null
     or to_regclass('public.clientes_empresa') is null
     or to_regclass('public.pagos_encargo') is null then
    raise exception 'PM27_C24_PREFLIGHT_FALLO: faltan tablas base PM14';
  end if;
  if to_regclass('private.g1_operation_ids_global') is null then
    raise exception 'PM27_C24_PREFLIGHT_FALLO: falta ledger global operation_id';
  end if;

  if to_regprocedure('private.la_usuario_activo()') is null
     or to_regprocedure('private.la_tiene_empresa(text)') is null
     or to_regprocedure('private.la_tiene_local(text,text)') is null then
    raise exception 'PM27_C24_PREFLIGHT_FALLO: faltan helpers tenant';
  end if;
  if to_regprocedure('private.es_propietario_activo()') is null then
    raise exception 'PM27_C24_PREFLIGHT_FALLO: falta private.es_propietario_activo()';
  end if;
  if to_regprocedure('private.pm08_bloquear_operation_id(text)') is null
     or to_regprocedure('private.pm09_bloquear_operation_id_stock(text)') is null then
    raise exception 'PM27_C24_PREFLIGHT_FALLO: faltan helpers de serialización operation_id';
  end if;
  if to_regprocedure('private.pm12_confirmar_ajuste_stock(text,text,text,jsonb,jsonb,jsonb)') is null
     or to_regprocedure('private.pm12_cancelar_conteo_stock(text,text,jsonb,jsonb)') is null then
    raise exception 'PM27_C24_PREFLIGHT_FALLO: faltan RPC privadas PM12 esperadas';
  end if;
  if to_regprocedure('private.pm08_puede_operar_caja()') is null
     or to_regprocedure('private.pm08_local_operable(text,text)') is null
     or to_regprocedure('private.pm08_validar_dinero(numeric,boolean,boolean)') is null then
    raise exception 'PM27_C24_PREFLIGHT_FALLO: faltan helpers PM08/PM14';
  end if;
  if to_regprocedure('private.g1_claim_operation_id()') is null then
    raise exception 'PM27_C24_PREFLIGHT_FALLO: falta private.g1_claim_operation_id()';
  end if;

  if to_regprocedure('public.obtener_contexto_operativo()') is null
     or to_regprocedure('public.registrar_venta_stock(text,text,text,text,numeric,jsonb)') is null
     or to_regprocedure('public.registrar_venta_stock_carrito(text,text,text,jsonb,jsonb)') is null
     or to_regprocedure('public.trasladar_stock_interno(text,text,text,text,text,text,numeric,jsonb)') is null
     or to_regprocedure('public.trasladar_stock_entre_locales(text,text,text,text,text,text,numeric,jsonb)') is null
     or to_regprocedure('public.registrar_encargo(text,text,text,text,numeric,text,jsonb)') is null
     or to_regprocedure('public.registrar_pago_encargo(text,text,text,text,text,text,numeric,date,text,jsonb)') is null
     or to_regprocedure('public.revertir_pago_encargo(text,text,text,text)') is null then
    raise exception 'PM27_C24_PREFLIGHT_FALLO: faltan RPC públicas base esperadas';
  end if;

  -- -----------------------------------------------------------------------
  -- 2. Reaplicación / estado parcial.
  -- C24 no permite ejecutar el lote sobre un destino que ya contiene uno de
  -- los hardenings C13-C23: se detiene para inspección en vez de reejecutar
  -- silenciosamente CREATE OR REPLACE / REVOKE.
  -- -----------------------------------------------------------------------
  v_def := pg_get_functiondef('public.obtener_contexto_operativo()'::regprocedure);
  if strpos(v_def, 'contexto_roles_inconsistentes') > 0 then
    v_markers := array_append(v_markers, 'C13_contexto');
  end if;

  v_def := pg_get_functiondef('public.registrar_venta_stock(text,text,text,text,numeric,jsonb)'::regprocedure);
  if strpos(v_def, 'pm09_bloquear_operation_id_stock') > 0 then
    v_markers := array_append(v_markers, 'C18_venta');
  end if;
  v_def := pg_get_functiondef('public.registrar_venta_stock_carrito(text,text,text,jsonb,jsonb)'::regprocedure);
  if strpos(v_def, 'pm09_bloquear_operation_id_stock') > 0 then
    v_markers := array_append(v_markers, 'C18_carrito');
  end if;

  v_def := pg_get_functiondef('public.trasladar_stock_interno(text,text,text,text,text,text,numeric,jsonb)'::regprocedure);
  if strpos(v_def, 'pm09_bloquear_operation_id_stock') > 0 then
    v_markers := array_append(v_markers, 'C19_interno');
  end if;
  v_def := pg_get_functiondef('public.trasladar_stock_entre_locales(text,text,text,text,text,text,numeric,jsonb)'::regprocedure);
  if strpos(v_def, 'pm09_bloquear_operation_id_stock') > 0 then
    v_markers := array_append(v_markers, 'C19_interlocal');
  end if;

  v_def := pg_get_functiondef('private.pm12_confirmar_ajuste_stock(text,text,text,jsonb,jsonb,jsonb)'::regprocedure);
  if strpos(v_def, 'op.payload ? ''bases''') > 0 then
    v_markers := array_append(v_markers, 'C20_bases_replay');
  end if;

  v_def := pg_get_functiondef('public.registrar_encargo(text,text,text,text,numeric,text,jsonb)'::regprocedure);
  if strpos(v_def, 'cliente_otro_contexto') > 0 then
    v_markers := array_append(v_markers, 'C21_encargos');
  end if;

  if exists (
    select 1 from pg_constraint
     where conrelid = 'public.pagos_encargo'::regclass
       and conname = 'pm27_c22_pagos_encargo_estado_reverso_ck'
  ) or to_regclass('public.pm27_c22_pagos_encargo_un_reverso_por_pago') is not null
     or exists (
       select 1 from pg_trigger t
       where t.tgrelid = 'public.pagos_encargo'::regclass
         and not t.tgisinternal
         and t.tgname in ('pm27_c22_pagos_encargo_integridad','pm27_c22_pagos_encargo_no_truncate')
     ) then
    v_markers := array_append(v_markers, 'C22_ledger_hardening');
  end if;

  v_def := pg_get_functiondef('public.registrar_venta_stock_carrito(text,text,text,jsonb,jsonb)'::regprocedure);
  if strpos(v_def, 'movimientos_datos_norm') > 0 then
    v_markers := array_append(v_markers, 'C23_cart_replay_metadata');
  end if;

  if coalesce(array_length(v_markers, 1), 0) > 0 then
    raise exception 'PM27_C24_PREFLIGHT_REAPLICACION_RECHAZADA: destino ya aplicado/parcial: %', array_to_string(v_markers, ',');
  end if;

  -- -----------------------------------------------------------------------
  -- 3. Compatibilidad de datos C13: no desplegar una función de contexto que
  -- vaya a encontrar perfiles/membresías activas internamente contradictorias.
  -- -----------------------------------------------------------------------
  select count(*) into v_bad
  from (
    select p.user_id
      from public.perfiles p
      left join public.membresias_usuario m
        on m.user_id = p.user_id and m.activo is true
     where p.activo is true
     group by p.user_id
    having count(distinct p.rol) <> 1
       or count(m.user_id) = 0
       or count(distinct m.rol) <> 1
       or min(m.rol) is distinct from min(p.rol)
  ) q;
  if v_bad > 0 then
    raise exception 'PM27_C24_PREFLIGHT_DATOS: % usuarios activos con perfil/membresía incompatible para C13', v_bad;
  end if;

  -- -----------------------------------------------------------------------
  -- 4. Compatibilidad C21: estados/total/contexto de clientes históricos.
  -- -----------------------------------------------------------------------
  if exists (
    select 1 from public.encargos_empresa e
     where coalesce(nullif(e.datos->>'estado',''), 'Pendiente')
           not in ('Pendiente','Entregado','Cancelado','Devuelto')
  ) then
    raise exception 'PM27_C24_PREFLIGHT_DATOS: encargos con estado histórico incompatible';
  end if;

  if exists (
    select 1 from public.encargos_empresa e
     where nullif(btrim(e.datos->>'total'), '') is not null
       and btrim(e.datos->>'total') !~ '^[+-]?([0-9]+([.][0-9]+)?|[.][0-9]+)$'
  ) then
    raise exception 'PM27_C24_PREFLIGHT_DATOS: encargos con total no numérico';
  end if;

  if exists (
    select 1
      from public.encargos_empresa e
      join public.clientes_empresa c on c.id = e.cliente_id
     where c.empresa_id is distinct from e.empresa_id
  ) then
    raise exception 'PM27_C24_PREFLIGHT_DATOS: encargo referencia cliente de otra empresa';
  end if;

  -- -----------------------------------------------------------------------
  -- 5. Compatibilidad C22: repetir explícitamente el preflight económico antes
  -- de iniciar el lote para que ningún DDL anterior se confirme si C22 fallaría.
  -- -----------------------------------------------------------------------
  if exists (
    select 1 from public.pagos_encargo
     where (estado = 'REVERSO' and revierte_pago_id is null)
        or (estado = 'CONFIRMADO' and revierte_pago_id is not null)
  ) then
    raise exception 'PM27_C24_PREFLIGHT_DATOS: pago estado/revierte_pago_id incoherente';
  end if;
  if exists (select 1 from public.pagos_encargo where revierte_pago_id = id) then
    raise exception 'PM27_C24_PREFLIGHT_DATOS: pago que se revierte a sí mismo';
  end if;
  if exists (
    select revierte_pago_id from public.pagos_encargo
     where revierte_pago_id is not null
     group by revierte_pago_id having count(*) > 1
  ) then
    raise exception 'PM27_C24_PREFLIGHT_DATOS: un pago tiene más de un reverso';
  end if;
  if exists (
    select 1
      from public.pagos_encargo r
      left join public.pagos_encargo o on o.id = r.revierte_pago_id
     where r.estado = 'REVERSO'
       and (o.id is null
         or o.estado <> 'CONFIRMADO'
         or o.revierte_pago_id is not null
         or r.empresa_id is distinct from o.empresa_id
         or r.local_id is distinct from o.local_id
         or r.encargo_id is distinct from o.encargo_id
         or r.importe is distinct from o.importe
         or r.concepto is distinct from o.concepto
         or r.medio_pago is distinct from o.medio_pago)
  ) then
    raise exception 'PM27_C24_PREFLIGHT_DATOS: reverso no conserva pago original';
  end if;
  if exists (
    select 1
      from public.pagos_encargo p
      left join private.g1_operation_ids_global g on g.operation_id = p.operation_id
     where g.operation_id is null or g.ledger is distinct from 'pagos_encargo'
  ) then
    raise exception 'PM27_C24_PREFLIGHT_DATOS: pago sin claim global correcto';
  end if;
  if exists (
    select 1
      from private.g1_operation_ids_global g
      left join public.pagos_encargo p on p.operation_id = g.operation_id
     where g.ledger = 'pagos_encargo' and p.operation_id is null
  ) then
    raise exception 'PM27_C24_PREFLIGHT_DATOS: claim pagos_encargo huérfano';
  end if;

  raise notice 'PM27_C24_PREFLIGHT=PASS';
end
$c24_preflight$;

rollback;
