-- PM26 P08b -- comportamiento del cliente contra el ESQUEMA POSTERIOR
-- (tras aplicar la migracion propuesta del Defecto L): (1) demuestra
-- de forma concreta, no solo declarada, el riesgo bloqueante ya
-- documentado -- el cliente ANTIGUO (sin empresa/local) deja de poder
-- crear porque las columnas ya son NOT NULL; (2) confirma que el
-- cliente NUEVO (con empresa/local, tal como lo envia
-- crearLogicaPrefiltros tras P08b) funciona correctamente; (3)
-- reproduce exactamente el patron DELETE ... RETURNING que usa
-- supabase-js con .select() tras .delete(), confirmando que la brecha
-- de ANT2 queda cerrada y que el cliente puede distinguir un borrado
-- real de uno bloqueado por RLS.
set client_min_messages to notice;
set role authenticated;

do $$
begin
  -- POST1: estilo de cliente ANTIGUO (sin empresa/local) -- debe fallar
  -- ahora, de forma real y ruidosa (nunca silenciosa). El motivo real
  -- observado es RLS, no NOT NULL: con empresa_id/local_id en NULL,
  -- private.la_tiene_local(NULL, NULL) evalua a false antes de que la
  -- restriccion de columna llegue a comprobarse, asi que Postgres
  -- rechaza la fila por la politica de RLS.
  perform set_config('app.current_uid', '11111111-1111-1111-1111-111111111111', false);
  insert into public.prefiltros_candidatos (token, candidato_nombre, estado)
  values ('tok-post-antiguo', 'No deberia crearse con cliente antiguo', 'pendiente');
  raise notice 'POST1_CLIENTE_ANTIGUO_FALLA=FAIL (no debia permitirse sin empresa/local)';
exception when insufficient_privilege or not_null_violation then
  raise notice 'POST1_CLIENTE_ANTIGUO_FALLA=PASS';
when others then
  raise notice 'POST1_CLIENTE_ANTIGUO_FALLA=FAIL (%)', sqlerrm;
end $$;

do $$
begin
  -- POST2: estilo de cliente NUEVO (con empresa/local) -- debe funcionar
  perform set_config('app.current_uid', '11111111-1111-1111-1111-111111111111', false);
  insert into public.prefiltros_candidatos (token, candidato_nombre, estado, empresa_id, local_id)
  values ('tok-post-nuevo', 'Candidato cliente nuevo', 'pendiente', 'EMPRESA_A', 'LOCAL_A1');
  raise notice 'POST2_CLIENTE_NUEVO_FUNCIONA=PASS';
exception when others then
  raise notice 'POST2_CLIENTE_NUEVO_FUNCIONA=FAIL (%)', sqlerrm;
end $$;

do $$
declare v_filas int;
begin
  -- POST3 (la brecha de ANT2, cerrada): Propietario B intenta el mismo
  -- borrado "solo por token" que en ANT2 tuvo exito -- ahora debe
  -- afectar 0 filas, reproduciendo exactamente DELETE ... RETURNING,
  -- el patron real que usa supabase-js con .delete().eq(...).select().
  perform set_config('app.current_uid', '44444444-4444-4444-4444-444444444444', false);
  with borrado as (
    delete from public.prefiltros_candidatos where token = 'tok-post-nuevo' returning token
  )
  select count(*) into v_filas from borrado;
  if v_filas = 0 then raise notice 'POST3_BRECHA_CERRADA=PASS'; else raise notice 'POST3_BRECHA_CERRADA=FAIL (se borraron % filas, la brecha seguiria abierta)', v_filas; end if;
end $$;

do $$
declare v_existe boolean;
begin
  -- Confirma que tok-post-nuevo sigue existiendo tras el intento
  -- bloqueado de POST3 (visto por su propio Propietario).
  perform set_config('app.current_uid', '11111111-1111-1111-1111-111111111111', false);
  select exists(select 1 from public.prefiltros_candidatos where token = 'tok-post-nuevo') into v_existe;
  if v_existe then raise notice 'POST3_SIN_RESIDUO_BORRADO=PASS'; else raise notice 'POST3_SIN_RESIDUO_BORRADO=FAIL'; end if;
end $$;

do $$
declare v_filas int;
begin
  -- POST4: el propio dueño SI puede borrar con el patron DELETE ...
  -- RETURNING -- confirma que el patron de deteccion no rompe el caso
  -- de exito, solo el bloqueado.
  perform set_config('app.current_uid', '11111111-1111-1111-1111-111111111111', false);
  with borrado as (
    delete from public.prefiltros_candidatos where token = 'tok-post-nuevo' returning token
  )
  select count(*) into v_filas from borrado;
  if v_filas = 1 then raise notice 'POST4_BORRADO_PROPIO_FUNCIONA=PASS'; else raise notice 'POST4_BORRADO_PROPIO_FUNCIONA=FAIL (esperada 1 fila, encontrado %)', v_filas; end if;
end $$;
