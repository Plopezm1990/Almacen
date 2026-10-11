-- Capa de configuración, PIEZA 4 · contrato vivo del registro de equipos por local (D04).
--
-- Se ejecuta DESPUÉS de las migraciones de las piezas 1 y 4 (20261002190000 y 20261002230000), dentro de una
-- transacción que termina en ROLLBACK:
--
--   begin; <este archivo>; select <resumen de la.log>; rollback;
--
-- No depende de los datos de QA: crea su propia empresa de prueba (CFG-EMP-T), locales (CFG-LA…) y terminales
-- dentro de la transacción. Solo necesita que existan en auth.users cuatro identificadores de usuario (en QA ya
-- existen; en la réplica local los crea tests/cfg/local-fixture.sql). Los actores se suplantan a nivel de base
-- de datos (set local role + claims JWT). Todo se revierte con el ROLLBACK.
--
-- Estructura (para poder partirlo en trozos si la herramienta corta a los 60 s):
--   -- ==== HELPERS ====   funciones auxiliares
--   -- ==== FIXTURE ====   empresas, locales, membresías y terminales
--   -- ==== CHUNK: nombre ==== ... -- ==== FIN CHUNK ====   cada bloque usa sus propios locales y es independiente

-- ==== HELPERS ====
select set_config('la.log', '[]', true);

create function pg_temp.log(p_paso text, p_res text, p_det jsonb default null) returns void language plpgsql as $f$
begin
  perform set_config('la.log', (coalesce(nullif(current_setting('la.log', true), ''), '[]')::jsonb
    || jsonb_build_array(jsonb_build_object('paso', p_paso, 'res', p_res, 'det', p_det)))::text, true);
end $f$;

create function pg_temp.ok(p_nombre text, p_cond boolean, p_det jsonb default null) returns void language plpgsql as $f$
begin
  perform pg_temp.log(p_nombre, case when coalesce(p_cond, false) then 'OK' else 'FALLA' end, p_det);
end $f$;

create function pg_temp.as_user(p_uid text, p_rol text default 'authenticated') returns void language plpgsql as $f$
begin
  if p_uid is not null then
    perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', p_rol)::text, true);
    perform set_config('request.jwt.claim.sub', p_uid, true);
  else
    perform set_config('request.jwt.claims', json_build_object('role', p_rol)::text, true);
    perform set_config('request.jwt.claim.sub', '', true);
  end if;
  execute 'set local role ' || quote_ident(p_rol);
end $f$;

-- Ejecuta un SQL como un usuario/rol. p_espera NULL: debe funcionar; texto: el error debe contenerlo.
create function pg_temp.paso(p_nombre text, p_uid text, p_sql text, p_espera text default null, p_rol text default 'authenticated') returns jsonb language plpgsql as $f$
declare v_res jsonb; v_msg text; v_state text;
begin
  begin
    perform pg_temp.as_user(p_uid, p_rol);
    execute p_sql into v_res;
    execute 'reset role';
    perform pg_temp.log(p_nombre, case when p_espera is null then 'OK' else 'NEGATIVA_NO_RECHAZADA' end, to_jsonb(left(coalesce(v_res::text, 'null'), 300)));
    return v_res;
  exception when others then
    get stacked diagnostics v_msg = message_text, v_state = returned_sqlstate;
    execute 'reset role';
    perform pg_temp.log(p_nombre,
      case when p_espera is null then 'ERROR' when v_msg like '%' || p_espera || '%' then 'NEGATIVA_OK' else 'NEGATIVA_OTRO_ERROR' end,
      to_jsonb(v_state || ' ' || v_msg));
    return null;
  end;
end $f$;

-- Ejecuta un SQL como el dueño de la base (sin suplantar a nadie): p_espera NULL, debe funcionar; texto, debe fallar con él.
create function pg_temp.directo(p_nombre text, p_sql text, p_espera text default null) returns void language plpgsql as $f$
declare v_msg text;
begin
  begin
    execute p_sql;
    perform pg_temp.log(p_nombre, case when p_espera is null then 'OK' else 'NEGATIVA_NO_RECHAZADA' end, null);
  exception when others then
    get stacked diagnostics v_msg = message_text;
    perform pg_temp.log(p_nombre,
      case when p_espera is null then 'ERROR' when v_msg like '%' || p_espera || '%' then 'NEGATIVA_OK' else 'NEGATIVA_OTRO_ERROR' end,
      to_jsonb(v_msg));
  end;
end $f$;

-- abc_configurar_equipo_local(operation_id, empresa, local, equipo, tipo, nombre, referencia, terminal, activo, notas, motivo)
create function pg_temp.e_cfg(p_nombre text, p_uid text, p_op text, p_local text, p_equipo uuid, p_tipo text, p_nom text, p_ref text, p_term uuid, p_activo boolean, p_notas text, p_motivo text, p_espera text default null, p_rol text default 'authenticated') returns jsonb language plpgsql as $f$
begin
  return pg_temp.paso(p_nombre, p_uid,
    format('select public.abc_configurar_equipo_local(%L,%L,%L,%L::uuid,%L,%L,%L,%L::uuid,%L::boolean,%L,%L)',
      p_op, 'CFG-EMP-T', p_local, p_equipo, p_tipo, p_nom, p_ref, p_term, p_activo, p_notas, p_motivo),
    p_espera, p_rol);
end $f$;

create function pg_temp.e_lista(p_nombre text, p_uid text, p_local text, p_inactivos boolean default false, p_espera text default null) returns jsonb language plpgsql as $f$
begin
  return pg_temp.paso(p_nombre, p_uid, format('select public.abc_listar_equipos_local(%L,%L,%L::boolean)', 'CFG-EMP-T', p_local, p_inactivos), p_espera);
end $f$;

-- ==== FIXTURE ====
do $t$
declare
  k_e    constant text := 'CFG-EMP-T';
  k_eu   constant text := 'CFG-EMP-U';
  k_prop constant text := '16c79749-a206-47d9-8d56-fbc7a4a49eb7';  -- Propietario de la empresa de prueba (todos los locales)
  k_enc  constant text := '5003adca-2e30-477e-8afd-ffb3037b034e';  -- Encargado (locales de la prueba)
  k_caj  constant text := 'eb0bca7b-b366-4d72-80e1-0b02e9bdd666';  -- Cajero/a (locales de la prueba)
  k_otro constant text := '73967f0c-3474-443d-ad83-9f20b94204c3';  -- Propietario de OTRA empresa
  l text;
begin
  insert into public.empresas(id, nombre, activo) values (k_e, 'Empresa prueba capa de configuración', true), (k_eu, 'Otra empresa prueba', true);
  insert into public.membresias_usuario(user_id, empresa_id, local_id, todos_locales, rol, activo) values
    (k_prop::uuid, k_e, null, true, 'Propietario', true),
    (k_otro::uuid, k_eu, null, true, 'Propietario', true);
  foreach l in array array['CFG-LA', 'CFG-LA2'] loop
    insert into public.locales(id, empresa_id, nombre, activo) values (l, k_e, l, true);
    insert into public.membresias_usuario(user_id, empresa_id, local_id, todos_locales, rol, activo) values
      (k_enc::uuid, k_e, l, false, 'Encargado', true),
      (k_caj::uuid, k_e, l, false, 'Cajero/a', true);
    insert into public.terminales_tpv(empresa_id, local_id, nombre) values (k_e, l, 'Terminal ' || l);
  end loop;
  insert into public.terminales_tpv(empresa_id, local_id, nombre, activo) values (k_e, 'CFG-LA', 'Terminal apagado', false);
  insert into public.locales(id, empresa_id, nombre, activo) values ('CFG-LU', k_eu, 'LU', true);
  insert into public.locales(id, empresa_id, nombre, activo) values ('CFG-LOFF', k_e, 'LOFF', false);
end
$t$;

-- ==== CHUNK: equipos ====
do $t$
declare
  k_e    constant text := 'CFG-EMP-T';
  k_loc  constant text := 'CFG-LA';
  k_loc2 constant text := 'CFG-LA2';
  k_prop constant text := '16c79749-a206-47d9-8d56-fbc7a4a49eb7';
  k_enc  constant text := '5003adca-2e30-477e-8afd-ffb3037b034e';
  k_caj  constant text := 'eb0bca7b-b366-4d72-80e1-0b02e9bdd666';
  k_otro constant text := '73967f0c-3474-443d-ad83-9f20b94204c3';
  v jsonb; v2 jsonb; v_primero jsonb; v_cnt integer;
  e1 uuid := gen_random_uuid(); e2 uuid := gen_random_uuid(); e3 uuid := gen_random_uuid(); e4 uuid := gen_random_uuid();
  t_a uuid; t_b uuid; t_off uuid;
begin
  select id into t_a from public.terminales_tpv where empresa_id = k_e and local_id = k_loc and activo;
  select id into t_b from public.terminales_tpv where empresa_id = k_e and local_id = k_loc2 and activo;
  select id into t_off from public.terminales_tpv where empresa_id = k_e and local_id = k_loc and not activo;

  v := pg_temp.e_lista('A1.1 un local sin equipos (D04: ninguno por ahora)', k_prop, k_loc);
  perform pg_temp.ok('A1.2 lista vacía', v->'equipos' = '[]'::jsonb, v);
  perform pg_temp.e_lista('A1.3 el Propietario de otra empresa no puede leer', k_otro, k_loc, false, 'abc_config_no_autorizado');
  perform pg_temp.paso('A1.4 anon no puede leer', null, format('select public.abc_listar_equipos_local(%L,%L,false)', k_e, k_loc), 'permission denied', 'anon');
  perform pg_temp.paso('A1.5 service_role no puede leer', null, format('select public.abc_listar_equipos_local(%L,%L,false)', k_e, k_loc), 'permission denied', 'service_role');

  perform pg_temp.e_cfg('A2.1 el Encargado no puede configurar', k_enc, 'cfg4-perm-01', k_loc, e1, 'DATAFONO', 'Datáfono barra', null, null, true, null, 'x', 'abc_config_no_autorizado');
  perform pg_temp.e_cfg('A2.2 el Cajero/a no puede', k_caj, 'cfg4-perm-02', k_loc, e1, 'DATAFONO', 'Datáfono barra', null, null, true, null, 'x', 'abc_config_no_autorizado');
  perform pg_temp.e_cfg('A2.3 el Propietario de otra empresa no puede', k_otro, 'cfg4-perm-03', k_loc, e1, 'DATAFONO', 'Datáfono barra', null, null, true, null, 'x', 'abc_config_no_autorizado');
  perform pg_temp.e_cfg('A2.4 anon no puede', null, 'cfg4-perm-04', k_loc, e1, 'DATAFONO', 'Datáfono barra', null, null, true, null, 'x', 'permission denied', 'anon');
  perform pg_temp.e_cfg('A2.5 service_role no puede', null, 'cfg4-perm-05', k_loc, e1, 'DATAFONO', 'Datáfono barra', null, null, true, null, 'x', 'permission denied', 'service_role');

  perform pg_temp.e_cfg('A3.1 sin identificador', k_prop, 'cfg4-val-01', k_loc, null, 'DATAFONO', 'Datáfono barra', null, null, true, null, 'x', 'equipo_id_requerido');
  perform pg_temp.e_cfg('A3.2 tipo inexistente', k_prop, 'cfg4-val-02', k_loc, e1, 'FREIDORA', 'Datáfono barra', null, null, true, null, 'x', 'equipo_tipo_invalido');
  perform pg_temp.e_cfg('A3.3 sin nombre', k_prop, 'cfg4-val-03', k_loc, e1, 'DATAFONO', '   ', null, null, true, null, 'x', 'equipo_nombre_invalido');
  perform pg_temp.e_cfg('A3.4 nombre de más de 80 caracteres', k_prop, 'cfg4-val-04', k_loc, e1, 'DATAFONO', repeat('n', 81), null, null, true, null, 'x', 'equipo_nombre_invalido');
  perform pg_temp.e_cfg('A3.5 referencia de más de 120 caracteres', k_prop, 'cfg4-val-05', k_loc, e1, 'DATAFONO', 'Datáfono barra', repeat('r', 121), null, true, null, 'x', 'equipo_referencia_invalida');
  perform pg_temp.e_cfg('A3.6 notas de más de 500 caracteres', k_prop, 'cfg4-val-06', k_loc, e1, 'DATAFONO', 'Datáfono barra', null, null, true, repeat('n', 501), 'x', 'equipo_notas_invalidas');
  perform pg_temp.e_cfg('A3.7 sin indicar si está activo', k_prop, 'cfg4-val-07', k_loc, e1, 'DATAFONO', 'Datáfono barra', null, null, null, null, 'x', 'equipo_estado_requerido');
  perform pg_temp.e_cfg('A3.8 sin motivo', k_prop, 'cfg4-val-08', k_loc, e1, 'DATAFONO', 'Datáfono barra', null, null, true, null, null, 'equipo_motivo_requerido');
  perform pg_temp.e_cfg('A3.9 local inexistente', k_prop, 'cfg4-val-09', 'CFG-NO-EXISTE', e1, 'DATAFONO', 'Datáfono barra', null, null, true, null, 'x', 'equipo_local_no_disponible');
  perform pg_temp.e_cfg('A3.9b local desactivado', k_prop, 'cfg4-val-09b', 'CFG-LOFF', e1, 'DATAFONO', 'Datáfono barra', null, null, true, null, 'x', 'equipo_local_no_disponible');
  perform pg_temp.e_cfg('A3.10 terminal de otro local', k_prop, 'cfg4-val-10', k_loc, e1, 'DATAFONO', 'Datáfono barra', null, t_b, true, null, 'x', 'equipo_terminal_no_disponible');
  perform pg_temp.e_cfg('A3.11 terminal inexistente', k_prop, 'cfg4-val-11', k_loc, e1, 'DATAFONO', 'Datáfono barra', null, gen_random_uuid(), true, null, 'x', 'equipo_terminal_no_disponible');
  perform pg_temp.e_cfg('A3.12 terminal inactivo', k_prop, 'cfg4-val-12', k_loc, e1, 'DATAFONO', 'Datáfono barra', null, t_off, true, null, 'x', 'equipo_terminal_no_disponible');
  perform pg_temp.ok('A3.13 los rechazos no crearon nada', (select count(*) from public.abc_local_equipos where empresa_id = k_e) = 0, null);

  v := pg_temp.e_cfg('A4.1 el Propietario da de alta un datáfono (el tipo admite minúsculas)', k_prop, 'cfg4-0001', k_loc, e1, 'datafono', '  Datáfono barra ', 'SN-1234', t_a, true, 'Junto a la caja', 'Compra nueva');
  v_primero := v;
  perform pg_temp.ok('A4.2 creado, versión 1, con sus datos recortados',
    (v->>'creado')::boolean and (v->>'cambio')::boolean and (v->>'version')::int = 1 and v->>'equipo_id' = e1::text
    and v->'equipo'->>'tipo' = 'DATAFONO' and v->'equipo'->>'nombre' = 'Datáfono barra' and v->'equipo'->>'referencia' = 'SN-1234'
    and v->'equipo'->>'terminal_id' = t_a::text and (v->'equipo'->>'activo')::boolean and v->'equipo'->>'notas' = 'Junto a la caja', v);
  v := pg_temp.e_lista('A4.3 la lista lo muestra', k_prop, k_loc);
  perform pg_temp.ok('A4.4 un equipo, con el nombre del terminal',
    jsonb_array_length(v->'equipos') = 1 and v->'equipos'->0->>'nombre' = 'Datáfono barra' and v->'equipos'->0->>'terminal_nombre' = 'Terminal CFG-LA'
    and (v->'equipos'->0->>'version')::int = 1, v);
  v := pg_temp.e_lista('A4.5 el Encargado del local puede leer', k_enc, k_loc);
  perform pg_temp.ok('A4.6 y lo ve', jsonb_array_length(v->'equipos') = 1, v);
  v := pg_temp.e_lista('A4.7 otro local de la misma empresa no lo ve', k_prop, k_loc2);
  perform pg_temp.ok('A4.8 vacío', v->'equipos' = '[]'::jsonb, v);

  v2 := pg_temp.e_cfg('A5.1 replay del mismo operation_id', k_prop, 'cfg4-0001', k_loc, e1, 'datafono', '  Datáfono barra ', 'SN-1234', t_a, true, 'Junto a la caja', 'Compra nueva');
  perform pg_temp.ok('A5.2 el replay devuelve el resultado original', v2 = v_primero, v2);
  perform pg_temp.e_cfg('A5.3 mismo operation_id con otro contenido: conflicto', k_prop, 'cfg4-0001', k_loc, e1, 'DATAFONO', 'Otro nombre', 'SN-1234', t_a, true, 'Junto a la caja', 'Compra nueva', 'operation_id_conflict');
  v2 := pg_temp.e_cfg('A5.4 los mismos datos con otro operation_id', k_prop, 'cfg4-0002', k_loc, e1, 'DATAFONO', 'Datáfono barra', 'SN-1234', t_a, true, 'Junto a la caja', 'repetir');
  perform pg_temp.ok('A5.5 sin cambio: la versión no sube y no es una alta', not (v2->>'cambio')::boolean and not (v2->>'creado')::boolean and (v2->>'version')::int = 1, v2);

  v := pg_temp.e_cfg('A6.1 se actualiza la referencia y se quita el terminal', k_prop, 'cfg4-0003', k_loc, e1, 'DATAFONO', 'Datáfono barra', 'SN-9999', null, true, 'Junto a la caja', 'Cambio de aparato');
  perform pg_temp.ok('A6.2 versión 2, no es una alta, referencia nueva y sin terminal',
    (v->>'cambio')::boolean and not (v->>'creado')::boolean and (v->>'version')::int = 2 and v->'equipo'->>'referencia' = 'SN-9999' and v->'equipo'->'terminal_id' = 'null'::jsonb, v);

  perform pg_temp.e_cfg('A7.1 otro equipo con el mismo nombre en el mismo local (sin distinguir mayúsculas)', k_prop, 'cfg4-0004', k_loc, e2, 'IMPRESORA_TICKET', 'DATÁFONO BARRA', null, null, true, null, 'x', 'equipo_nombre_duplicado');
  v := pg_temp.e_cfg('A7.2 el mismo nombre en otro local sí se admite', k_prop, 'cfg4-0005', k_loc2, e2, 'DATAFONO', 'Datáfono barra', null, t_b, true, null, 'Otro local');
  perform pg_temp.ok('A7.3 creado en el otro local', (v->>'creado')::boolean, v);
  perform pg_temp.e_cfg('A7.4 el identificador de un equipo de otro local no se reutiliza', k_prop, 'cfg4-0006', k_loc, e2, 'DATAFONO', 'Datáfono nuevo', null, null, true, null, 'x', 'equipo_id_en_uso');
  v := pg_temp.e_cfg('A7.5 un equipo puede conservar su propio nombre al actualizarse', k_prop, 'cfg4-0007', k_loc, e1, 'DATAFONO', 'DATÁFONO BARRA', 'SN-9999', null, true, 'Junto a la caja', 'Mayúsculas');
  perform pg_temp.ok('A7.6 y se actualiza (cambia el nombre en mayúsculas)', (v->>'cambio')::boolean and (v->>'version')::int = 3 and v->'equipo'->>'nombre' = 'DATÁFONO BARRA', v);

  perform pg_temp.e_cfg('A8.1 el tipo no cambia una vez creado', k_prop, 'cfg4-0008', k_loc, e1, 'IMPRESORA_TICKET', 'DATÁFONO BARRA', 'SN-9999', null, true, 'Junto a la caja', 'x', 'equipo_tipo_inmutable');

  perform pg_temp.e_cfg('A9.1 se da de alta una impresora de cocina', k_prop, 'cfg4-0009', k_loc, e3, 'IMPRESORA_COCINA', 'Impresora cocina', null, t_a, true, null, 'Cocina');
  v := pg_temp.e_cfg('A9.2 se desactiva el datáfono (no se borra)', k_prop, 'cfg4-0010', k_loc, e1, 'DATAFONO', 'DATÁFONO BARRA', 'SN-9999', null, false, 'Junto a la caja', 'Averiado');
  perform pg_temp.ok('A9.3 versión 4, inactivo', (v->>'cambio')::boolean and (v->>'version')::int = 4 and not (v->'equipo'->>'activo')::boolean, v);
  v := pg_temp.e_lista('A9.4 por defecto solo se listan los activos', k_prop, k_loc);
  perform pg_temp.ok('A9.5 solo la impresora de cocina', jsonb_array_length(v->'equipos') = 1 and v->'equipos'->0->>'tipo' = 'IMPRESORA_COCINA', v);
  v := pg_temp.e_lista('A9.6 con los inactivos aparecen los dos, ordenados por tipo y nombre', k_prop, k_loc, true);
  perform pg_temp.ok('A9.7 datáfono antes que impresora de cocina', jsonb_array_length(v->'equipos') = 2 and v->'equipos'->0->>'tipo' = 'DATAFONO' and v->'equipos'->1->>'tipo' = 'IMPRESORA_COCINA'
    and not (v->'equipos'->0->>'activo')::boolean, v);
  v := pg_temp.e_cfg('A9.8 se vuelve a activar', k_prop, 'cfg4-0011', k_loc, e1, 'DATAFONO', 'DATÁFONO BARRA', 'SN-9999', t_a, true, 'Junto a la caja', 'Reparado');
  perform pg_temp.ok('A9.9 versión 5, activo y con terminal', (v->>'version')::int = 5 and (v->'equipo'->>'activo')::boolean and v->'equipo'->>'terminal_id' = t_a::text, v);
  v := pg_temp.e_cfg('A9.10 una caja monedero y un tipo OTRO', k_prop, 'cfg4-0012', k_loc, e4, 'CAJON_MONEDERO', 'Cajón barra', null, null, true, null, 'Alta');
  perform pg_temp.ok('A9.11 creado', (v->>'creado')::boolean and v->'equipo'->>'tipo' = 'CAJON_MONEDERO', v);

  select count(*) into v_cnt from public.abc_eventos where empresa_id = k_e and local_id = k_loc and event_type = 'EQUIPO_LOCAL_REGISTRADO';
  perform pg_temp.ok('A10.1 tres altas en el local dejaron tres eventos de registro', v_cnt = 3, to_jsonb(v_cnt));
  select count(*) into v_cnt from public.abc_eventos where empresa_id = k_e and local_id = k_loc and event_type = 'EQUIPO_LOCAL_ACTUALIZADO';
  perform pg_temp.ok('A10.2 cuatro cambios reales dejaron cuatro eventos de actualización (rechazos, replays y repeticiones no)', v_cnt = 4, to_jsonb(v_cnt));
  perform pg_temp.ok('A10.3 el alta guarda el equipo, el motivo y el actor',
    (select payload->'equipo'->>'nombre' from public.abc_eventos where operation_id = 'cfg4-0001' and event_type = 'EQUIPO_LOCAL_REGISTRADO') = 'Datáfono barra'
    and (select payload->>'motivo' from public.abc_eventos where operation_id = 'cfg4-0001' and event_type = 'EQUIPO_LOCAL_REGISTRADO') = 'Compra nueva'
    and (select actor_user_id from public.abc_eventos where operation_id = 'cfg4-0001' and event_type = 'EQUIPO_LOCAL_REGISTRADO') = k_prop::uuid, null);
  perform pg_temp.ok('A10.4 la actualización guarda el valor anterior y el nuevo',
    (select payload->'anterior'->>'referencia' from public.abc_eventos where operation_id = 'cfg4-0003' and event_type = 'EQUIPO_LOCAL_ACTUALIZADO') = 'SN-1234'
    and (select payload->'nuevo'->>'referencia' from public.abc_eventos where operation_id = 'cfg4-0003' and event_type = 'EQUIPO_LOCAL_ACTUALIZADO') = 'SN-9999'
    and (select payload->'anterior'->>'terminal_id' from public.abc_eventos where operation_id = 'cfg4-0003' and event_type = 'EQUIPO_LOCAL_ACTUALIZADO') = t_a::text
    and (select payload->'nuevo'->'terminal_id' from public.abc_eventos where operation_id = 'cfg4-0003' and event_type = 'EQUIPO_LOCAL_ACTUALIZADO') = 'null'::jsonb
    and (select payload->>'motivo' from public.abc_eventos where operation_id = 'cfg4-0003' and event_type = 'EQUIPO_LOCAL_ACTUALIZADO') = 'Cambio de aparato'
    and (select (payload->>'version')::int from public.abc_eventos where operation_id = 'cfg4-0003' and event_type = 'EQUIPO_LOCAL_ACTUALIZADO') = 2, null);

  perform pg_temp.directo('A11.1 la tabla rechaza un tipo inexistente',
    format('insert into public.abc_local_equipos(id,empresa_id,local_id,tipo,nombre) values (gen_random_uuid(),%L,%L,%L,%L)', k_e, k_loc2, 'FREIDORA', 'x'), 'abc_local_equipo_tipo');
  perform pg_temp.directo('A11.2 la tabla rechaza un nombre vacío',
    format('insert into public.abc_local_equipos(id,empresa_id,local_id,tipo,nombre) values (gen_random_uuid(),%L,%L,%L,%L)', k_e, k_loc2, 'OTRO', '  '), 'abc_local_equipo_nombre');
  perform pg_temp.directo('A11.3 la tabla rechaza un nombre repetido en el local aunque cambien las mayúsculas',
    format('insert into public.abc_local_equipos(id,empresa_id,local_id,tipo,nombre) values (gen_random_uuid(),%L,%L,%L,%L)', k_e, k_loc2, 'OTRO', 'DATÁFONO BARRA'), 'abc_local_equipo_nombre_uq');
  perform pg_temp.directo('A11.4 la tabla rechaza un terminal de otro local',
    format('insert into public.abc_local_equipos(id,empresa_id,local_id,tipo,nombre,terminal_id) values (gen_random_uuid(),%L,%L,%L,%L,%L)', k_e, k_loc2, 'OTRO', 'Con terminal ajeno', t_a), 'abc_local_equipo_terminal_fk');
  perform pg_temp.directo('A11.5 la tabla rechaza un local que no existe',
    format('insert into public.abc_local_equipos(id,empresa_id,local_id,tipo,nombre) values (gen_random_uuid(),%L,%L,%L,%L)', k_e, 'CFG-NO-EXISTE', 'OTRO', 'x'), 'abc_local_equipo_local_fk');
  perform pg_temp.paso('A12.1 la tabla no se puede leer directamente', k_prop, 'select to_jsonb(count(*)) from public.abc_local_equipos', 'permission denied');
  perform pg_temp.paso('A12.2 ni escribir directamente', k_prop,
    format('with z as (insert into public.abc_local_equipos(id,empresa_id,local_id,tipo,nombre) values (gen_random_uuid(),%L,%L,%L,%L) returning 1) select to_jsonb(1) from z', k_e, k_loc2, 'OTRO', 'directo'), 'permission denied');
  perform pg_temp.ok('A12.3 el registro de equipos de otra empresa o local no se mezcla (solo 1 equipo en el otro local)',
    (select count(*) from public.abc_local_equipos where empresa_id = k_e and local_id = k_loc2) = 1, null);
  perform pg_temp.ok('A12.4 la tabla tiene activada la seguridad por filas', (select relrowsecurity from pg_class where oid = 'public.abc_local_equipos'::regclass), null);
  perform pg_temp.directo('A12.5 un alta directa sin indicar el estado queda activa y en versión 1',
    format('insert into public.abc_local_equipos(id,empresa_id,local_id,tipo,nombre) values (gen_random_uuid(),%L,%L,%L,%L)', k_e, k_loc2, 'OTRO', 'zz por defecto'));
  perform pg_temp.ok('A12.6 por defecto activo y versión 1', (select activo and version = 1 from public.abc_local_equipos where empresa_id = k_e and local_id = k_loc2 and nombre = 'zz por defecto'), null);
end
$t$;
-- ==== FIN CHUNK ====
