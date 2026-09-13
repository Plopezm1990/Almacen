-- PM26 P06b-H -- preflight de catalogo. Ejecutar SIEMPRE antes de
-- aplicar supabase/qa-solo/pm26_p06b_rendimiento_indices_rls_initplan.sql
-- contra cualquier proyecto, y abortar si algo falla. No modifica
-- nada -- solo lee pg_policies/pg_indexes y aborta con una excepcion
-- real si el estado esperado no coincide.
--
-- La comprobacion mas importante no es solo "esto es correcto": es
-- "esto es QA". Las 4 politicas qa_* que este preflight exige no
-- existen en produccion (produccion tiene, para las mismas tablas,
-- politicas con otros nombres o ninguna) -- si el preflight falla
-- porque no las encuentra, eso incluye el caso de estar apuntando por
-- error al proyecto equivocado, y aborta antes de tocar nada.

do $$
declare
  v_qual text;
  v_check text;
  v_encontradas int;
begin
  -- 1) Las 4 politicas qa_* deben existir, exactamente con el texto
  --    SIN optimizar (auth.uid() sin envolver) -- si ya estuvieran
  --    optimizadas, esta migracion ya se aplico antes (no es un error,
  --    pero se detiene para no reintentar a ciegas sobre otra cosa).
  select count(*) into v_encontradas
    from pg_policies
   where tablename in ('perfiles', 'suscripciones_push', 'membresias_usuario')
     and policyname in ('qa_perfil_propio_select', 'qa_perfil_propio_update', 'qa_push_propio', 'membresia_propia_select');
  if v_encontradas <> 4 then
    raise exception 'PREFLIGHT_FALLO: se esperaban 4 politicas qa_*/membresia_propia_select, encontradas %. ¿Es este el proyecto QA?', v_encontradas;
  end if;

  select qual into v_qual from pg_policies where tablename = 'perfiles' and policyname = 'qa_perfil_propio_select';
  if v_qual is distinct from '(user_id = auth.uid())' then
    raise exception 'PREFLIGHT_FALLO: qa_perfil_propio_select.qual no es el esperado antes de aplicar -- valor actual: %', v_qual;
  end if;

  select qual, with_check into v_qual, v_check from pg_policies where tablename = 'perfiles' and policyname = 'qa_perfil_propio_update';
  if v_qual is distinct from '(user_id = auth.uid())' or v_check is distinct from '(user_id = auth.uid())' then
    raise exception 'PREFLIGHT_FALLO: qa_perfil_propio_update no tiene el USING/WITH CHECK esperado antes de aplicar';
  end if;

  select qual, with_check into v_qual, v_check from pg_policies where tablename = 'suscripciones_push' and policyname = 'qa_push_propio';
  if v_qual is distinct from '(user_id = auth.uid())' or v_check is distinct from '(user_id = auth.uid())' then
    raise exception 'PREFLIGHT_FALLO: qa_push_propio no tiene el USING/WITH CHECK esperado antes de aplicar';
  end if;

  select qual into v_qual from pg_policies where tablename = 'membresias_usuario' and policyname = 'membresia_propia_select';
  if v_qual is distinct from '((user_id = auth.uid()) AND (activo = true) AND private.la_usuario_activo())' then
    raise exception 'PREFLIGHT_FALLO: membresia_propia_select.qual no es el esperado antes de aplicar -- valor actual: %', v_qual;
  end if;

  -- 2) Ninguno de los 4 indices nuevos debe existir todavia.
  select count(*) into v_encontradas
    from pg_indexes
   where schemaname = 'public'
     and indexname in (
       'idx_auditoria_registro_actor_user_id',
       'idx_movimientos_stock_operation_id',
       'idx_pagos_encargo_revierte_pago_id',
       'idx_suscripciones_push_user_id'
     );
  if v_encontradas <> 0 then
    raise exception 'PREFLIGHT_FALLO: ya existen % de los 4 indices nuevos -- la migracion puede haberse aplicado ya', v_encontradas;
  end if;

  -- 3) Las 4 tablas objetivo de los indices deben existir con la
  --    columna exacta que se va a indexar (evita un error de nombre
  --    de columna en un catalogo que no coincide con el esperado).
  perform 1 from information_schema.columns where table_schema='public' and table_name='auditoria_registro' and column_name='actor_user_id';
  if not found then raise exception 'PREFLIGHT_FALLO: auditoria_registro.actor_user_id no existe'; end if;
  perform 1 from information_schema.columns where table_schema='public' and table_name='movimientos_stock' and column_name='operation_id';
  if not found then raise exception 'PREFLIGHT_FALLO: movimientos_stock.operation_id no existe'; end if;
  perform 1 from information_schema.columns where table_schema='public' and table_name='pagos_encargo' and column_name='revierte_pago_id';
  if not found then raise exception 'PREFLIGHT_FALLO: pagos_encargo.revierte_pago_id no existe'; end if;
  perform 1 from information_schema.columns where table_schema='public' and table_name='suscripciones_push' and column_name='user_id';
  if not found then raise exception 'PREFLIGHT_FALLO: suscripciones_push.user_id no existe'; end if;

  -- 4) Ningun indice EXISTENTE, con cualquier nombre, debe cubrir ya
  --    esa misma columna como su columna inicial -- si lo hiciera, el
  --    asesor original ya no aplicaria y crear otro seria redundante.
  select count(*) into v_encontradas
    from pg_index i
    join pg_class t on t.oid = i.indrelid
    join pg_namespace n on n.oid = t.relnamespace
    join pg_attribute a on a.attrelid = t.oid and a.attnum = i.indkey[0]
   where n.nspname = 'public' and t.relname = 'auditoria_registro' and a.attname = 'actor_user_id';
  if v_encontradas > 0 then
    raise exception 'PREFLIGHT_FALLO: ya existe un indice (con cualquier nombre) que cubre auditoria_registro.actor_user_id como columna inicial';
  end if;

  select count(*) into v_encontradas
    from pg_index i
    join pg_class t on t.oid = i.indrelid
    join pg_namespace n on n.oid = t.relnamespace
    join pg_attribute a on a.attrelid = t.oid and a.attnum = i.indkey[0]
   where n.nspname = 'public' and t.relname = 'movimientos_stock' and a.attname = 'operation_id';
  if v_encontradas > 0 then
    raise exception 'PREFLIGHT_FALLO: ya existe un indice (con cualquier nombre) que cubre movimientos_stock.operation_id como columna inicial';
  end if;

  select count(*) into v_encontradas
    from pg_index i
    join pg_class t on t.oid = i.indrelid
    join pg_namespace n on n.oid = t.relnamespace
    join pg_attribute a on a.attrelid = t.oid and a.attnum = i.indkey[0]
   where n.nspname = 'public' and t.relname = 'pagos_encargo' and a.attname = 'revierte_pago_id';
  if v_encontradas > 0 then
    raise exception 'PREFLIGHT_FALLO: ya existe un indice (con cualquier nombre) que cubre pagos_encargo.revierte_pago_id como columna inicial';
  end if;

  select count(*) into v_encontradas
    from pg_index i
    join pg_class t on t.oid = i.indrelid
    join pg_namespace n on n.oid = t.relnamespace
    join pg_attribute a on a.attrelid = t.oid and a.attnum = i.indkey[0]
   where n.nspname = 'public' and t.relname = 'suscripciones_push' and a.attname = 'user_id';
  if v_encontradas > 0 then
    raise exception 'PREFLIGHT_FALLO: ya existe un indice (con cualquier nombre) que cubre suscripciones_push.user_id como columna inicial';
  end if;

  raise notice 'PREFLIGHT_CATALOGO=PASS';
end
$$;
