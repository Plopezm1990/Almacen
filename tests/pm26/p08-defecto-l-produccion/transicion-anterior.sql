-- PM26 P08b -- comportamiento del cliente contra el ESQUEMA ANTERIOR
-- (antes de aplicar la migracion propuesta del Defecto L): confirma
-- que el cliente actualmente desplegado en produccion (INSERT/DELETE
-- directos, sin empresa/local) sigue funcionando igual que hoy, Y
-- documenta con una reproduccion real, no solo afirmada, la brecha
-- exacta que el Defecto L corrige: cualquier Propietario activo puede
-- borrar el prefiltro de OTRA empresa, porque la politica de borrado
-- de hoy no comprueba empresa ni local.
set client_min_messages to notice;
set role authenticated;

do $$
begin
  -- ANT1: estilo de cliente ACTUAL (sin empresa/local) -- Propietario A crea
  perform set_config('app.current_uid', '11111111-1111-1111-1111-111111111111', false);
  insert into public.prefiltros_candidatos (token, candidato_nombre, estado)
  values ('tok-ant1', 'Candidato Anterior', 'pendiente');
  raise notice 'ANT1=PASS';
exception when others then
  raise notice 'ANT1=FAIL (%)', sqlerrm;
end $$;

do $$
declare v_count int;
begin
  -- ANT2 (brecha real que el Defecto L corrige): Propietario B, SIN
  -- ninguna relacion con la empresa de la fila, borra con el estilo de
  -- cliente actual (solo por token) -- la politica de hoy solo exige
  -- rol Propietario, sin comprobar empresa/local, así que esto TIENE
  -- EXITO hoy. Esta reproduccion demuestra la brecha, no es un
  -- resultado deseable.
  perform set_config('app.current_uid', '44444444-4444-4444-4444-444444444444', false);
  delete from public.prefiltros_candidatos where token = 'tok-ant1';
  get diagnostics v_count = row_count;
  if v_count = 1 then raise notice 'ANT2_BRECHA_REPRODUCIDA=PASS'; else raise notice 'ANT2_BRECHA_REPRODUCIDA=FAIL (esperada 1 fila borrada por un Propietario ajeno, encontrado %)', v_count; end if;
end $$;
