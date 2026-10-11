-- Capa de configuración, PIEZA 3 · contrato vivo de las modalidades de cuenta habilitadas por local (D02).
--
-- Se ejecuta DESPUÉS de las migraciones de las piezas 1 y 3 (20261002190000 y 20261002220000) y de las de
-- apertura de cuentas y cierre de caja, dentro de una transacción que termina en ROLLBACK:
--
--   begin; <este archivo>; select <resumen de la.log>; rollback;
--
-- No depende de los datos de QA: crea su propia empresa de prueba (CFG-EMP-T) y locales (CFG-LA…) dentro de la
-- transacción. Solo necesita que existan en auth.users cuatro identificadores de usuario (en QA ya existen; en
-- la réplica local los crea tests/cfg/local-fixture.sql). Los actores se suplantan a nivel de base de datos
-- (set local role + claims JWT). Todo se revierte con el ROLLBACK.
--
-- Estructura (para poder partirlo en trozos cuando la herramienta corta a los 60 s):
--   -- ==== HELPERS ====   funciones auxiliares
--   -- ==== FIXTURE ====   empresa, locales, membresías, entidad fiscal y reglas del día
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

-- abc_configurar_modalidad_local(operation_id, empresa, local, modalidad, habilitada, motivo)
create function pg_temp.m_cfg(p_nombre text, p_uid text, p_op text, p_local text, p_modalidad text, p_habilitada boolean, p_motivo text, p_espera text default null, p_rol text default 'authenticated') returns jsonb language plpgsql as $f$
begin
  return pg_temp.paso(p_nombre, p_uid,
    format('select public.abc_configurar_modalidad_local(%L,%L,%L,%L,%L::boolean,%L)', p_op, 'CFG-EMP-T', p_local, p_modalidad, p_habilitada, p_motivo),
    p_espera, p_rol);
end $f$;

create function pg_temp.m_obt(p_nombre text, p_uid text, p_local text, p_espera text default null) returns jsonb language plpgsql as $f$
begin
  return pg_temp.paso(p_nombre, p_uid, format('select public.abc_obtener_modalidades_local(%L,%L)', 'CFG-EMP-T', p_local), p_espera);
end $f$;

-- Estado de una modalidad dentro de la respuesta de abc_obtener_modalidades_local
create function pg_temp.m_de(p_lectura jsonb, p_modalidad text) returns jsonb language sql as $f$
  select e from jsonb_array_elements(p_lectura->'modalidades') e where e->>'modalidad' = p_modalidad
$f$;

-- Abre una sesión de caja del local con su caja y su terminal (la apertura de cuentas la exige). Devuelve {s, t}.
create function pg_temp.sesion_abierta(p_pref text, p_uid text, p_local text) returns jsonb language plpgsql as $f$
declare v_caja uuid; v_term uuid; v_s uuid:=gen_random_uuid();
begin
  insert into public.cajas_fisicas(empresa_id, local_id, nombre) values ('CFG-EMP-T', p_local, 'C-' || p_pref) returning id into v_caja;
  insert into public.terminales_tpv(empresa_id, local_id, nombre) values ('CFG-EMP-T', p_local, 'T-' || p_pref) returning id into v_term;
  perform pg_temp.paso(p_pref || ' abre la sesión de caja', p_uid,
    format('select public.abc_abrir_sesion_caja(%L,%L,%L,%L::uuid,%L::uuid,%L::uuid,%L::uuid,%L,%L::numeric,%L::date)',
      p_pref || '-sesion', 'CFG-EMP-T', p_local, v_s, v_caja, '16c79749-a206-47d9-8d56-fbc7a4a49eb7', v_term, 'EUR', 0, current_date));
  return jsonb_build_object('s', v_s, 't', v_term);
end $f$;

-- abc_abrir_cuenta(operation_id, empresa, local, cuenta, modalidad, moneda, responsable, terminal, sesión, día operativo)
create function pg_temp.c_abrir(p_nombre text, p_uid text, p_op text, p_local text, p_cuenta uuid, p_modalidad text, p_sesion uuid, p_term uuid, p_espera text default null) returns jsonb language plpgsql as $f$
begin
  return pg_temp.paso(p_nombre, p_uid,
    format('select public.abc_abrir_cuenta(%L,%L,%L,%L::uuid,%L,%L,%L::uuid,%L::uuid,%L::uuid,null::date)',
      p_op, 'CFG-EMP-T', p_local, p_cuenta, p_modalidad, 'EUR', '16c79749-a206-47d9-8d56-fbc7a4a49eb7', p_term, p_sesion),
    p_espera);
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
  v_ef uuid;
  l text;
begin
  insert into public.empresas(id, nombre, activo) values (k_e, 'Empresa prueba capa de configuración', true), (k_eu, 'Otra empresa prueba', true);
  insert into public.membresias_usuario(user_id, empresa_id, local_id, todos_locales, rol, activo) values
    (k_prop::uuid, k_e, null, true, 'Propietario', true),
    (k_otro::uuid, k_eu, null, true, 'Propietario', true);
  insert into public.entidades_fiscales(empresa_id, nombre_legal, country_code) values (k_e, 'Entidad prueba', 'ES') returning id into v_ef;
  insert into public.entidad_fiscal_monedas(empresa_id, entidad_fiscal_id, currency_code, es_principal) values (k_e, v_ef, 'EUR', true);
  foreach l in array array['CFG-LA', 'CFG-LA2', 'CFG-LB', 'CFG-LC'] loop
    insert into public.locales(id, empresa_id, nombre, activo) values (l, k_e, l, true);
    insert into public.membresias_usuario(user_id, empresa_id, local_id, todos_locales, rol, activo) values
      (k_enc::uuid, k_e, l, false, 'Encargado', true),
      (k_caj::uuid, k_e, l, false, 'Cajero/a', true);
    insert into public.entidad_fiscal_locales(empresa_id, local_id, entidad_fiscal_id) values (k_e, l, v_ef);
    insert into public.entidad_fiscal_local_monedas(empresa_id, local_id, entidad_fiscal_id, currency_code) values (k_e, l, v_ef, 'EUR');
    insert into private.abc_operating_day_reglas(empresa_id, local_id, version, timezone_name, cutoff_time, vigente_desde, vigente_hasta, motivo)
      values (k_e, l, 1, 'Europe/Madrid', time '00:00', timestamptz '2026-09-01 00:00:00+00', null, 'base del contrato');
  end loop;
  insert into public.locales(id, empresa_id, nombre, activo) values ('CFG-LU', k_eu, 'LU', true);
end
$t$;

-- ==== CHUNK: config ====
-- A. Configuración, lectura, permisos, mínimo de una modalidad, auditoría y aislamiento.
do $t$
declare
  k_e    constant text := 'CFG-EMP-T';
  k_loc  constant text := 'CFG-LA';
  k_prop constant text := '16c79749-a206-47d9-8d56-fbc7a4a49eb7';
  k_enc  constant text := '5003adca-2e30-477e-8afd-ffb3037b034e';
  k_caj  constant text := 'eb0bca7b-b366-4d72-80e1-0b02e9bdd666';
  k_otro constant text := '73967f0c-3474-443d-ad83-9f20b94204c3';
  v jsonb; v2 jsonb; v_primero jsonb; v_cnt integer;
begin
  v := pg_temp.m_obt('A1.1 lectura de un local sin configurar', k_prop, k_loc);
  perform pg_temp.ok('A1.2 las cinco modalidades habilitadas por defecto, origen defecto, en orden',
    jsonb_array_length(v->'modalidades') = 5
    and v->'habilitadas' = '["BARRA","MESA","TERRAZA","TAKEAWAY","OTRO"]'::jsonb
    and not exists (select 1 from jsonb_array_elements(v->'modalidades') e where not (e->>'habilitada')::boolean or e->>'origen' <> 'defecto' or (e->>'version')::int <> 0), v);
  perform pg_temp.m_obt('A1.3 el Propietario de otra empresa no puede leer', k_otro, k_loc, 'abc_config_no_autorizado');
  perform pg_temp.paso('A1.4 anon no puede leer', null, format('select public.abc_obtener_modalidades_local(%L,%L)', k_e, k_loc), 'permission denied', 'anon');

  perform pg_temp.m_cfg('A2.1 el Encargado no puede configurar', k_enc, 'cfg3-perm-01', k_loc, 'TERRAZA', false, 'x', 'abc_config_no_autorizado');
  perform pg_temp.m_cfg('A2.2 el Cajero/a no puede', k_caj, 'cfg3-perm-02', k_loc, 'TERRAZA', false, 'x', 'abc_config_no_autorizado');
  perform pg_temp.m_cfg('A2.3 el Propietario de otra empresa no puede', k_otro, 'cfg3-perm-03', k_loc, 'TERRAZA', false, 'x', 'abc_config_no_autorizado');
  perform pg_temp.m_cfg('A2.4 anon no puede', null, 'cfg3-perm-04', k_loc, 'TERRAZA', false, 'x', 'permission denied', 'anon');
  perform pg_temp.m_cfg('A2.5 service_role no puede', null, 'cfg3-perm-05', k_loc, 'TERRAZA', false, 'x', 'permission denied', 'service_role');

  perform pg_temp.m_cfg('A3.1 modalidad inexistente', k_prop, 'cfg3-val-01', k_loc, 'COCINA', false, 'x', 'modalidad_invalida');
  perform pg_temp.m_cfg('A3.2 sin indicar si se habilita o no', k_prop, 'cfg3-val-02', k_loc, 'TERRAZA', null, 'x', 'modalidad_estado_requerido');
  perform pg_temp.m_cfg('A3.3 sin motivo', k_prop, 'cfg3-val-03', k_loc, 'TERRAZA', false, null, 'modalidad_motivo_requerido');
  perform pg_temp.m_cfg('A3.4 local inexistente', k_prop, 'cfg3-val-04', 'CFG-NO-EXISTE', 'TERRAZA', false, 'x', 'modalidad_local_no_disponible');
  perform pg_temp.ok('A3.5 los rechazos no crearon ninguna decisión', (select count(*) from public.abc_local_modalidades where empresa_id = k_e) = 0, null);

  v := pg_temp.m_cfg('A4.1 el Propietario deshabilita TERRAZA', k_prop, 'cfg3-0001', k_loc, 'terraza', false, 'No tenemos terraza');
  v_primero := v;
  perform pg_temp.ok('A4.2 cambio, versión 1, TERRAZA deshabilitada, el resto sigue (la modalidad admite minúsculas)',
    (v->>'cambio')::boolean and (v->>'version')::int = 1 and not (v->>'habilitada')::boolean and v->>'modalidad' = 'TERRAZA'
    and v->'habilitadas' = '["BARRA","MESA","TAKEAWAY","OTRO"]'::jsonb and (v->>'cuentas_abiertas')::int = 0, v);
  v := pg_temp.m_obt('A4.3 la lectura refleja el cambio', k_prop, k_loc);
  perform pg_temp.ok('A4.4 TERRAZA deshabilitada con origen local y versión 1; BARRA sigue por defecto',
    not (pg_temp.m_de(v, 'TERRAZA')->>'habilitada')::boolean and pg_temp.m_de(v, 'TERRAZA')->>'origen' = 'local' and (pg_temp.m_de(v, 'TERRAZA')->>'version')::int = 1
    and (pg_temp.m_de(v, 'BARRA')->>'habilitada')::boolean and pg_temp.m_de(v, 'BARRA')->>'origen' = 'defecto', v);
  v := pg_temp.m_obt('A4.5 el Encargado del local puede leer', k_enc, k_loc);
  perform pg_temp.ok('A4.6 y ve lo mismo', v->'habilitadas' = '["BARRA","MESA","TAKEAWAY","OTRO"]'::jsonb, v);

  v2 := pg_temp.m_cfg('A5.1 replay del mismo operation_id', k_prop, 'cfg3-0001', k_loc, 'terraza', false, 'No tenemos terraza');
  perform pg_temp.ok('A5.2 el replay devuelve el resultado original', v2 = v_primero, v2);
  perform pg_temp.m_cfg('A5.3 mismo operation_id con otro contenido: conflicto', k_prop, 'cfg3-0001', k_loc, 'TERRAZA', true, 'otro', 'operation_id_conflict');
  v2 := pg_temp.m_cfg('A5.4 mismo estado con otro operation_id', k_prop, 'cfg3-0002', k_loc, 'TERRAZA', false, 'repetir');
  perform pg_temp.ok('A5.5 sin cambio: la versión no sube', not (v2->>'cambio')::boolean and (v2->>'version')::int = 1, v2);
  v2 := pg_temp.m_cfg('A5.6 habilitar lo que ya estaba habilitado por defecto (MESA)', k_prop, 'cfg3-0003', k_loc, 'MESA', true, 'ya estaba');
  perform pg_temp.ok('A5.7 sin cambio y sin crear fila', not (v2->>'cambio')::boolean and (v2->>'version')::int = 0
    and not exists (select 1 from public.abc_local_modalidades where empresa_id = k_e and local_id = k_loc and modalidad = 'MESA'), v2);

  v := pg_temp.m_cfg('A6.1 se vuelve a habilitar TERRAZA', k_prop, 'cfg3-0004', k_loc, 'TERRAZA', true, 'Abrimos terraza');
  perform pg_temp.ok('A6.2 versión 2, habilitada, de nuevo las cinco', (v->>'cambio')::boolean and (v->>'version')::int = 2 and (v->>'habilitada')::boolean
    and v->'habilitadas' = '["BARRA","MESA","TERRAZA","TAKEAWAY","OTRO"]'::jsonb, v);

  perform pg_temp.m_cfg('A7.1 deshabilita MESA', k_prop, 'cfg3-0005', k_loc, 'MESA', false, 'sin mesas');
  perform pg_temp.m_cfg('A7.2 deshabilita TERRAZA', k_prop, 'cfg3-0006', k_loc, 'TERRAZA', false, 'sin terraza');
  perform pg_temp.m_cfg('A7.3 deshabilita TAKEAWAY', k_prop, 'cfg3-0007', k_loc, 'TAKEAWAY', false, 'sin llevar');
  v := pg_temp.m_cfg('A7.4 deshabilita OTRO: solo queda BARRA', k_prop, 'cfg3-0008', k_loc, 'OTRO', false, 'solo barra');
  perform pg_temp.ok('A7.5 solo BARRA habilitada', v->'habilitadas' = '["BARRA"]'::jsonb, v);
  perform pg_temp.m_cfg('A7.6 no se puede deshabilitar la última', k_prop, 'cfg3-0009', k_loc, 'BARRA', false, 'ninguna', 'modalidades_minimo_una');
  perform pg_temp.ok('A7.7 BARRA sigue habilitada y sin decisión propia',
    not exists (select 1 from public.abc_local_modalidades where empresa_id = k_e and local_id = k_loc and modalidad = 'BARRA'), null);
  perform pg_temp.m_cfg('A7.8 se habilita OTRO', k_prop, 'cfg3-0010', k_loc, 'OTRO', true, 'otro');
  v := pg_temp.m_cfg('A7.9 ahora sí se puede deshabilitar BARRA', k_prop, 'cfg3-0011', k_loc, 'BARRA', false, 'solo otro');
  perform pg_temp.ok('A7.10 solo OTRO habilitada', v->'habilitadas' = '["OTRO"]'::jsonb and (v->>'version')::int = 1, v);

  select count(*) into v_cnt from public.abc_eventos where empresa_id = k_e and local_id = k_loc and event_type = 'MODALIDAD_LOCAL_CONFIGURADA';
  perform pg_temp.ok('A8.1 ocho cambios reales dejaron ocho eventos (rechazos, replays y repeticiones no)', v_cnt = 8, to_jsonb(v_cnt));
  perform pg_temp.ok('A8.2 el primero guarda modalidad, anterior, nuevo, motivo, cuentas abiertas y actor',
    (select payload->>'modalidad' from public.abc_eventos where operation_id = 'cfg3-0001' and event_type = 'MODALIDAD_LOCAL_CONFIGURADA') = 'TERRAZA'
    and (select (payload->>'anterior')::boolean from public.abc_eventos where operation_id = 'cfg3-0001' and event_type = 'MODALIDAD_LOCAL_CONFIGURADA') = true
    and (select (payload->>'nuevo')::boolean from public.abc_eventos where operation_id = 'cfg3-0001' and event_type = 'MODALIDAD_LOCAL_CONFIGURADA') = false
    and (select payload->>'motivo' from public.abc_eventos where operation_id = 'cfg3-0001' and event_type = 'MODALIDAD_LOCAL_CONFIGURADA') = 'No tenemos terraza'
    and (select (payload->>'cuentas_abiertas')::int from public.abc_eventos where operation_id = 'cfg3-0001' and event_type = 'MODALIDAD_LOCAL_CONFIGURADA') = 0
    and (select actor_user_id from public.abc_eventos where operation_id = 'cfg3-0001' and event_type = 'MODALIDAD_LOCAL_CONFIGURADA') = k_prop::uuid, null);
  perform pg_temp.ok('A8.3 al volver a habilitar, anterior falso y nuevo verdadero',
    (select (payload->>'anterior')::boolean from public.abc_eventos where operation_id = 'cfg3-0004' and event_type = 'MODALIDAD_LOCAL_CONFIGURADA') = false
    and (select (payload->>'nuevo')::boolean from public.abc_eventos where operation_id = 'cfg3-0004' and event_type = 'MODALIDAD_LOCAL_CONFIGURADA') = true, null);

  perform pg_temp.directo('A9.1 la tabla rechaza una modalidad inexistente',
    format('insert into public.abc_local_modalidades(empresa_id,local_id,modalidad,habilitada,motivo) values (%L,%L,%L,true,%L)', k_e, 'CFG-LA2', 'COCINA', 'x'), 'abc_local_modalidad_valor');
  perform pg_temp.directo('A9.2 la tabla rechaza un motivo vacío',
    format('insert into public.abc_local_modalidades(empresa_id,local_id,modalidad,habilitada,motivo) values (%L,%L,%L,true,%L)', k_e, 'CFG-LA2', 'MESA', '  '), 'abc_local_modalidad_motivo');
  perform pg_temp.directo('A9.3 la tabla rechaza una decisión duplicada',
    format('insert into public.abc_local_modalidades(empresa_id,local_id,modalidad,habilitada,motivo) values (%L,%L,%L,true,%L)', k_e, k_loc, 'TERRAZA', 'x'), 'abc_local_modalidad_uq');
  perform pg_temp.directo('A9.4 la tabla rechaza un local que no existe',
    format('insert into public.abc_local_modalidades(empresa_id,local_id,modalidad,habilitada,motivo) values (%L,%L,%L,true,%L)', k_e, 'CFG-NO-EXISTE', 'MESA', 'x'), 'abc_local_modalidad_local_fk');
  perform pg_temp.paso('A10.1 la tabla no se puede leer directamente', k_prop, 'select to_jsonb(count(*)) from public.abc_local_modalidades', 'permission denied');
  perform pg_temp.paso('A10.2 ni escribir directamente', k_prop,
    format('with z as (insert into public.abc_local_modalidades(empresa_id,local_id,modalidad,habilitada,motivo) values (%L,%L,%L,false,%L) returning 1) select to_jsonb(1) from z', k_e, 'CFG-LA2', 'MESA', 'x'), 'permission denied');

  v := pg_temp.m_obt('A11.1 otro local de la misma empresa sigue con todo por defecto', k_prop, 'CFG-LA2');
  perform pg_temp.ok('A11.2 las cinco habilitadas', v->'habilitadas' = '["BARRA","MESA","TERRAZA","TAKEAWAY","OTRO"]'::jsonb, v);
end
$t$;
-- ==== FIN CHUNK ====

-- ==== CHUNK: guarda ====
-- B. La guarda de la apertura de cuentas y del cambio de modalidad.
do $t$
declare
  k_e    constant text := 'CFG-EMP-T';
  k_loc  constant text := 'CFG-LB';
  k_loc2 constant text := 'CFG-LC';
  k_prop constant text := '16c79749-a206-47d9-8d56-fbc7a4a49eb7';
  k_caj  constant text := 'eb0bca7b-b366-4d72-80e1-0b02e9bdd666';
  v jsonb; v2 jsonb; v_primero jsonb; x jsonb; y jsonb; v_s uuid; v_t uuid;
  c_barra uuid := gen_random_uuid(); c_terraza uuid := gen_random_uuid(); c_mesa uuid := gen_random_uuid(); c_otra uuid := gen_random_uuid();
  c_nueva uuid := gen_random_uuid(); c_lc uuid := gen_random_uuid(); c_dir uuid := gen_random_uuid();
begin
  x := pg_temp.sesion_abierta('cfg3-b1', k_caj, k_loc);
  v_s := (x->>'s')::uuid; v_t := (x->>'t')::uuid;

  v_primero := pg_temp.c_abrir('B1.1 sin configurar, una cuenta en BARRA se abre como siempre', k_caj, 'cfg3-b1-ab-01', k_loc, c_barra, 'BARRA', v_s, v_t);
  perform pg_temp.ok('B1.2 abierta en BARRA', v_primero->>'estado' = 'ABIERTA' and v_primero->>'modalidad' = 'BARRA', v_primero);

  perform pg_temp.m_cfg('B2.1 el Propietario deshabilita MESA', k_prop, 'cfg3-b1-m-01', k_loc, 'MESA', false, 'sin mesas');
  perform pg_temp.c_abrir('B2.2 una cuenta nueva en MESA se rechaza', k_caj, 'cfg3-b1-ab-02', k_loc, c_mesa, 'MESA', v_s, v_t, 'modalidad_no_habilitada:MESA');
  perform pg_temp.ok('B2.3 no quedó ninguna cuenta ni operación a medias',
    not exists (select 1 from public.cuentas_comerciales where id = c_mesa)
    and not exists (select 1 from public.abc_operaciones where operation_id = 'cfg3-b1-ab-02'), null);
  v := pg_temp.c_abrir('B2.4 otra modalidad habilitada (TERRAZA) sigue funcionando', k_caj, 'cfg3-b1-ab-03', k_loc, c_terraza, 'TERRAZA', v_s, v_t);
  perform pg_temp.ok('B2.5 abierta en TERRAZA', v->>'modalidad' = 'TERRAZA', v);
  perform pg_temp.c_abrir('B2.6 la modalidad inválida sigue dando su error de siempre', k_caj, 'cfg3-b1-ab-04', k_loc, c_otra, 'COCINA', v_s, v_t, 'modalidad_cuenta_invalida');

  v := pg_temp.m_cfg('B3.1 se deshabilita BARRA con una cuenta abierta en BARRA', k_prop, 'cfg3-b1-m-02', k_loc, 'BARRA', false, 'sin barra');
  perform pg_temp.ok('B3.2 el resultado cuenta 1 cuenta abierta', (v->>'cuentas_abiertas')::int = 1 and (v->>'cambio')::boolean, v);
  perform pg_temp.ok('B3.3 la cuenta abierta en BARRA no se toca',
    (select estado from public.cuentas_comerciales where id = c_barra) = 'ABIERTA' and (select modalidad from public.cuentas_comerciales where id = c_barra) = 'BARRA', null);
  perform pg_temp.directo('B3.4 y puede seguir actualizándose (cambios que no tocan la modalidad)',
    format('update public.cuentas_comerciales set version = version + 1 where id = %L', c_barra));
  perform pg_temp.directo('B3.5 incluso reescribiendo la misma modalidad',
    format('update public.cuentas_comerciales set modalidad = %L where id = %L', 'BARRA', c_barra));
  v2 := pg_temp.c_abrir('B3.6 la repetición idempotente de la apertura anterior sigue devolviendo su resultado', k_caj, 'cfg3-b1-ab-01', k_loc, c_barra, 'BARRA', v_s, v_t);
  perform pg_temp.ok('B3.7 mismo resultado que la primera vez', v2 = v_primero, v2);
  perform pg_temp.c_abrir('B3.8 una cuenta nueva en BARRA se rechaza', k_caj, 'cfg3-b1-ab-05', k_loc, c_nueva, 'BARRA', v_s, v_t, 'modalidad_no_habilitada:BARRA');

  perform pg_temp.directo('B4.1 cambiar la modalidad de una cuenta existente a una deshabilitada se rechaza (BARRA)',
    format('update public.cuentas_comerciales set modalidad = %L where id = %L', 'BARRA', c_terraza), 'modalidad_no_habilitada:BARRA');
  perform pg_temp.directo('B4.2 ni a MESA',
    format('update public.cuentas_comerciales set modalidad = %L where id = %L', 'MESA', c_terraza), 'modalidad_no_habilitada:MESA');
  perform pg_temp.directo('B4.3 pero sí a una habilitada (TAKEAWAY)',
    format('update public.cuentas_comerciales set modalidad = %L where id = %L', 'TAKEAWAY', c_terraza));
  perform pg_temp.ok('B4.4 la cuenta quedó en TAKEAWAY', (select modalidad from public.cuentas_comerciales where id = c_terraza) = 'TAKEAWAY', null);
  perform pg_temp.directo('B4.5 un alta directa en una modalidad deshabilitada también se rechaza (cualquier camino)',
    format('insert into public.cuentas_comerciales(id,empresa_id,local_id,currency_code,modalidad,created_by,opened_operating_day) values (%L,%L,%L,%L,%L,%L,current_date)', c_dir, k_e, k_loc, 'EUR', 'MESA', k_prop),
    'modalidad_no_habilitada:MESA');
  perform pg_temp.directo('B4.6 y en una habilitada se admite',
    format('insert into public.cuentas_comerciales(id,empresa_id,local_id,currency_code,modalidad,created_by,opened_operating_day) values (%L,%L,%L,%L,%L,%L,current_date)', c_dir, k_e, k_loc, 'EUR', 'OTRO', k_prop));

  v := pg_temp.m_cfg('B5.1 se vuelve a habilitar MESA', k_prop, 'cfg3-b1-m-03', k_loc, 'MESA', true, 'abrimos mesas');
  v := pg_temp.c_abrir('B5.2 ahora una cuenta en MESA se abre', k_caj, 'cfg3-b1-ab-06', k_loc, c_mesa, 'MESA', v_s, v_t);
  perform pg_temp.ok('B5.3 abierta en MESA', v->>'modalidad' = 'MESA', v);

  y := pg_temp.sesion_abierta('cfg3-c1', k_caj, k_loc2);
  v := pg_temp.c_abrir('B6.1 otro local de la misma empresa no se ve afectado (BARRA y MESA se abren)', k_caj, 'cfg3-c1-ab-01', k_loc2, c_lc, 'BARRA', (y->>'s')::uuid, (y->>'t')::uuid);
  perform pg_temp.ok('B6.2 abierta en BARRA en el otro local', v->>'modalidad' = 'BARRA', v);
end
$t$;
-- ==== FIN CHUNK ====
