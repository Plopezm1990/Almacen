-- Capa de configuración, PIEZA 6d · contrato vivo de `abc_obtener_dia_operativo_local` (día operativo del cierre de caja).
--
-- Se ejecuta DESPUÉS de las migraciones de las piezas 1, 5 y 6d (20261002190000, 20261002240000 y 20261002250000), dentro de
-- una transacción que termina en ROLLBACK:
--
--   begin; <este archivo>; select <resumen de la.log>; rollback;
--
-- No depende de los datos de QA: crea su propia empresa de prueba (CFG-EMP-T), locales (CFG-LA…) y reglas del día dentro de la
-- transacción. Solo necesita que existan en auth.users cuatro identificadores de usuario (en QA ya existen; en la réplica local
-- los crea tests/cfg/local-fixture.sql). Los actores se suplantan a nivel de base de datos (set local role + claims JWT).
-- Todo se revierte con el ROLLBACK.
--
-- Estructura (para poder partirlo en trozos si la herramienta corta a los 60 s):
--   -- ==== HELPERS ====   funciones auxiliares
--   -- ==== FIXTURE ====   empresas, locales, membresías y reglas del día
--   -- ==== CHUNK: nombre ==== ... -- ==== FIN CHUNK ====   cada bloque es independiente (usa sus propios locales)

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

-- abc_obtener_dia_operativo_local(empresa, local)
create function pg_temp.d_dia(p_nombre text, p_uid text, p_local text, p_espera text default null, p_rol text default 'authenticated', p_empresa text default 'CFG-EMP-T') returns jsonb language plpgsql as $f$
begin
  return pg_temp.paso(p_nombre, p_uid, format('select public.abc_obtener_dia_operativo_local(%L,%L)', p_empresa, p_local), p_espera, p_rol);
end $f$;

-- abc_configurar_capacidad_rol(operation_id, empresa, local, ambito, rol, capacidad, permitido, motivo)
create function pg_temp.d_cap(p_nombre text, p_uid text, p_op text, p_local text, p_rol text, p_cap text, p_permitido boolean, p_espera text default null) returns jsonb language plpgsql as $f$
begin
  return pg_temp.paso(p_nombre, p_uid,
    format('select public.abc_configurar_capacidad_rol(%L,%L,%L,%L,%L,%L,%L::boolean,%L)', p_op, 'CFG-EMP-T', p_local, 'LOCAL', p_rol, p_cap, p_permitido, 'prueba 6d'),
    p_espera);
end $f$;

-- ==== FIXTURE ====
do $t$
declare
  k_e    constant text := 'CFG-EMP-T';
  k_eu   constant text := 'CFG-EMP-U';
  k_prop constant text := '16c79749-a206-47d9-8d56-fbc7a4a49eb7';  -- Propietario de la empresa de prueba (todos los locales)
  k_enc  constant text := '5003adca-2e30-477e-8afd-ffb3037b034e';  -- Encargado
  k_caj  constant text := 'eb0bca7b-b366-4d72-80e1-0b02e9bdd666';  -- Cajero/a (y Camarero/a en CFG-LC)
  k_otro constant text := '73967f0c-3474-443d-ad83-9f20b94204c3';  -- Propietario de OTRA empresa
  l text;
begin
  insert into public.empresas(id, nombre, activo) values (k_e, 'Empresa prueba capa de configuración', true), (k_eu, 'Otra empresa prueba', true);
  insert into public.membresias_usuario(user_id, empresa_id, local_id, todos_locales, rol, activo) values
    (k_prop::uuid, k_e, null, true, 'Propietario', true),
    (k_otro::uuid, k_eu, null, true, 'Propietario', true);
  -- CFG-LA (corte 12:00), CFG-LB (corte 00:00), CFG-LM (otra zona horaria): Encargado y Cajero/a
  foreach l in array array['CFG-LA', 'CFG-LB', 'CFG-LM', 'CFG-LN', 'CFG-LT', 'CFG-LP'] loop
    insert into public.locales(id, empresa_id, nombre, activo) values (l, k_e, l, true);
    insert into public.membresias_usuario(user_id, empresa_id, local_id, todos_locales, rol, activo) values
      (k_enc::uuid, k_e, l, false, 'Encargado', true),
      (k_caj::uuid, k_e, l, false, 'Cajero/a', true);
  end loop;
  -- CFG-LC: sin regla del día; el «Cajero/a» es allí Camarero/a (no opera la caja); el Encargado no tiene acceso
  insert into public.locales(id, empresa_id, nombre, activo) values ('CFG-LC', k_e, 'CFG-LC', true);
  insert into public.membresias_usuario(user_id, empresa_id, local_id, todos_locales, rol, activo) values
    (k_caj::uuid, k_e, 'CFG-LC', false, 'Camarero/a', true);
  insert into public.locales(id, empresa_id, nombre, activo) values ('CFG-LU', k_eu, 'LU', true), ('CFG-LOFF', k_e, 'LOFF', false);
  insert into private.abc_operating_day_reglas(empresa_id, local_id, version, timezone_name, cutoff_time, vigente_desde, vigente_hasta, motivo) values
    (k_e, 'CFG-LA', 1, 'Europe/Madrid', time '12:00', timestamptz '2026-09-01 00:00:00+00', null, 'base del contrato'),
    (k_e, 'CFG-LB', 1, 'Europe/Madrid', time '00:00', timestamptz '2026-09-01 00:00:00+00', null, 'base del contrato'),
    (k_e, 'CFG-LM', 1, 'America/Mexico_City', time '00:00', timestamptz '2026-09-01 00:00:00+00', null, 'base del contrato'),
    -- Casos que no dependen de la hora a la que se ejecute el contrato:
    -- CFG-LN: corte a las 23:59:59, así que (salvo el último segundo del día) el día operativo es SIEMPRE el anterior.
    (k_e, 'CFG-LN', 1, 'Europe/Madrid', time '23:59:59', timestamptz '2026-09-01 00:00:00+00', null, 'base del contrato'),
    -- CFG-LT y CFG-LP: zonas a +14 h y -11 h de UTC; a cualquier hora al menos una tiene una fecha distinta a la de Madrid.
    (k_e, 'CFG-LT', 1, 'Pacific/Kiritimati', time '00:00', timestamptz '2026-09-01 00:00:00+00', null, 'base del contrato'),
    (k_e, 'CFG-LP', 1, 'Pacific/Pago_Pago', time '00:00', timestamptz '2026-09-01 00:00:00+00', null, 'base del contrato');
end
$t$;

-- ==== CHUNK: permisos ====
do $t$
declare
  k_e    constant text := 'CFG-EMP-T';
  k_prop constant text := '16c79749-a206-47d9-8d56-fbc7a4a49eb7';
  k_enc  constant text := '5003adca-2e30-477e-8afd-ffb3037b034e';
  k_caj  constant text := 'eb0bca7b-b366-4d72-80e1-0b02e9bdd666';
  k_otro constant text := '73967f0c-3474-443d-ad83-9f20b94204c3';
  v jsonb;
begin
  v := pg_temp.d_dia('A1.1 el Propietario puede leer el día operativo', k_prop, 'CFG-LB');
  perform pg_temp.ok('A1.1b devuelve ok y una fecha', (v->>'ok')::boolean and v->>'operating_day' ~ '^\d{4}-\d{2}-\d{2}$', v);
  perform pg_temp.d_dia('A1.2 el Encargado del local puede', k_enc, 'CFG-LB');
  perform pg_temp.d_dia('A1.3 el Cajero/a del local puede', k_caj, 'CFG-LB');
  perform pg_temp.d_dia('A1.4 quien es Camarero/a en el local no opera la caja y no puede', k_caj, 'CFG-LC', 'abc_caja_no_autorizado');
  perform pg_temp.d_dia('A1.5 el Propietario de otra empresa no puede', k_otro, 'CFG-LB', 'abc_caja_no_autorizado');
  perform pg_temp.d_dia('A1.6 el Encargado sin acceso a ese local no puede', k_enc, 'CFG-LC', 'abc_caja_no_autorizado');
  perform pg_temp.d_dia('A1.7 anon no puede ejecutar la función', null, 'CFG-LB', 'permission denied', 'anon');
  perform pg_temp.d_dia('A1.8 service_role no puede ejecutar la función', null, 'CFG-LB', 'permission denied', 'service_role');
  perform pg_temp.d_dia('A1.9 authenticated sin sesión (sin sub) no puede', null, 'CFG-LB', 'abc_caja_no_autorizado');
  perform pg_temp.d_dia('A1.10 empresa vacía', k_prop, 'CFG-LB', 'abc_caja_no_autorizado', 'authenticated', '   ');
  perform pg_temp.d_dia('A1.11 local vacío', k_prop, '  ', 'abc_caja_no_autorizado');
  perform pg_temp.d_dia('A1.12 local inexistente: el Propietario recibe «local no disponible»', k_prop, 'CFG-NO-EXISTE', 'dia_operativo_local_no_disponible');
  perform pg_temp.d_dia('A1.12b local inexistente: un Encargado simplemente no está autorizado', k_enc, 'CFG-NO-EXISTE', 'abc_caja_no_autorizado');
  perform pg_temp.d_dia('A1.12c local desactivado', k_prop, 'CFG-LOFF', 'dia_operativo_local_no_disponible');
  perform pg_temp.d_dia('A1.13 el Cajero/a de un local no lee otro local suyo sin acceso (CFG-LU es de otra empresa)', k_caj, 'CFG-LU', 'abc_caja_no_autorizado', 'authenticated', 'CFG-EMP-U');
  perform pg_temp.d_dia('A1.14 el local de otra empresa pedido con la empresa propia', k_prop, 'CFG-LU', 'dia_operativo_local_no_disponible');
end
$t$;
-- ==== FIN CHUNK ====

-- ==== CHUNK: calculo ====
do $t$
declare
  k_e    constant text := 'CFG-EMP-T';
  k_prop constant text := '16c79749-a206-47d9-8d56-fbc7a4a49eb7';
  k_enc  constant text := '5003adca-2e30-477e-8afd-ffb3037b034e';
  v jsonb; v2 jsonb;
  n_ev bigint; n_op bigint; n_aj bigint; n_ev2 bigint; n_op2 bigint; n_aj2 bigint;
begin
  v := pg_temp.d_dia('B1.1 corte 12:00 (zona Madrid)', k_prop, 'CFG-LA');
  perform pg_temp.ok('B1.2 el día es el de hace 12 horas en Madrid',
    v->>'operating_day' = (((now() at time zone 'Europe/Madrid') - interval '12 hours')::date)::text, v);
  v := pg_temp.d_dia('B2.1 corte 00:00 (zona Madrid)', k_prop, 'CFG-LB');
  perform pg_temp.ok('B2.2 el día es la fecha de hoy en Madrid', v->>'operating_day' = ((now() at time zone 'Europe/Madrid')::date)::text, v);
  v := pg_temp.d_dia('B3.1 otra zona horaria (México, corte 00:00)', k_prop, 'CFG-LM');
  perform pg_temp.ok('B3.2 usa la zona de la regla, no una fija',
    v->>'operating_day' = ((now() at time zone 'America/Mexico_City')::date)::text, v);
  v := pg_temp.d_dia('B4.1 local sin regla del día', k_prop, 'CFG-LC');
  perform pg_temp.ok('B4.2 cae al día de Madrid (como los eventos de configuración)', v->>'operating_day' = ((now() at time zone 'Europe/Madrid')::date)::text, v);

  -- Pruebas que no dependen de la hora del día en que se ejecute el contrato
  v := pg_temp.d_dia('B8.1 corte a las 23:59:59 (Madrid)', k_prop, 'CFG-LN');
  perform pg_temp.ok('B8.2 el día operativo es el anterior a la fecha de hoy en Madrid',
    v->>'operating_day' = (((now() at time zone 'Europe/Madrid')::date) - 1)::text, v);
  v := pg_temp.d_dia('B8.3 zona Pacific/Kiritimati (+14 h)', k_prop, 'CFG-LT');
  perform pg_temp.ok('B8.4 usa la fecha de esa zona', v->>'operating_day' = ((now() at time zone 'Pacific/Kiritimati')::date)::text, v);
  v := pg_temp.d_dia('B8.5 zona Pacific/Pago_Pago (-11 h)', k_prop, 'CFG-LP');
  perform pg_temp.ok('B8.6 usa la fecha de esa zona', v->>'operating_day' = ((now() at time zone 'Pacific/Pago_Pago')::date)::text, v);
  perform pg_temp.ok('B8.7 a esta hora al menos una de las dos zonas tiene una fecha distinta a la de Madrid (el contrato distingue una zona fija)',
    (now() at time zone 'Pacific/Kiritimati')::date <> (now() at time zone 'Europe/Madrid')::date
    or (now() at time zone 'Pacific/Pago_Pago')::date <> (now() at time zone 'Europe/Madrid')::date, null);

  -- Mismo cálculo que ya usan los eventos de configuración
  perform pg_temp.ok('B5.1 coincide con private.abc_config_dia_evento (corte 12:00)',
    (pg_temp.d_dia('B5.0 lectura', k_enc, 'CFG-LA'))->>'operating_day' = private.abc_config_dia_evento(k_e, 'CFG-LA')::text, null);
  perform pg_temp.ok('B5.2 coincide con private.abc_config_dia_evento (otra zona)',
    (pg_temp.d_dia('B5.0b lectura', k_enc, 'CFG-LM'))->>'operating_day' = private.abc_config_dia_evento(k_e, 'CFG-LM')::text, null);

  -- Forma exacta de la respuesta
  v := pg_temp.d_dia('B6.1 forma de la respuesta', k_prop, 'CFG-LB');
  perform pg_temp.ok('B6.2 solo ok y operating_day', (select array_agg(k order by k) from jsonb_object_keys(v) k) = array['ok', 'operating_day'], v);

  -- Estable y sin efectos: dos llamadas dan lo mismo y no se escribe nada
  select count(*) into n_ev from public.abc_eventos; select count(*) into n_op from public.abc_operaciones; select count(*) into n_aj from public.abc_config_ajustes;
  v := pg_temp.d_dia('B7.1 primera llamada', k_prop, 'CFG-LB');
  v2 := pg_temp.d_dia('B7.2 segunda llamada', k_prop, 'CFG-LB');
  select count(*) into n_ev2 from public.abc_eventos; select count(*) into n_op2 from public.abc_operaciones; select count(*) into n_aj2 from public.abc_config_ajustes;
  perform pg_temp.ok('B7.3 las dos llamadas dan lo mismo', v = v2, jsonb_build_array(v, v2));
  perform pg_temp.ok('B7.4 no escribe eventos, operaciones ni ajustes', n_ev = n_ev2 and n_op = n_op2 and n_aj = n_aj2, jsonb_build_array(n_ev, n_ev2, n_op, n_op2, n_aj, n_aj2));
  perform pg_temp.ok('B7.5 la función es de solo lectura (STABLE)', (select p.provolatile from pg_proc p where p.oid = 'public.abc_obtener_dia_operativo_local(text,text)'::regprocedure) = 's', null);
end
$t$;
-- ==== FIN CHUNK ====

-- ==== CHUNK: capacidades ====
do $t$
declare
  k_e    constant text := 'CFG-EMP-T';
  k_prop constant text := '16c79749-a206-47d9-8d56-fbc7a4a49eb7';
  k_enc  constant text := '5003adca-2e30-477e-8afd-ffb3037b034e';
  k_caj  constant text := 'eb0bca7b-b366-4d72-80e1-0b02e9bdd666';
  v jsonb;
begin
  -- El permiso es el mismo que el de operar la caja (pieza 5): si el Propietario se lo quita a un rol, deja de poder leerlo
  v := pg_temp.d_cap('C1.1 el Propietario quita «operar la caja» al Cajero/a en CFG-LB', k_prop, 'cfg6d-cap-0001', 'CFG-LB', 'Cajero/a', 'ABC_CAJA_OPERAR', false);
  perform pg_temp.ok('C1.1b el cambio se aplicó', coalesce((v->>'cambio')::boolean, false), v);
  perform pg_temp.d_dia('C1.2 el Cajero/a ya no puede leer el día en CFG-LB', k_caj, 'CFG-LB', 'abc_caja_no_autorizado');
  perform pg_temp.d_dia('C1.3 el Encargado sigue pudiendo en CFG-LB', k_enc, 'CFG-LB');
  perform pg_temp.d_dia('C1.4 en otro local (CFG-LA) el Cajero/a sigue pudiendo: el cambio era de un local', k_caj, 'CFG-LA');
  perform pg_temp.d_cap('C2.1 «volver a lo normal»', k_prop, 'cfg6d-cap-0002', 'CFG-LB', 'Cajero/a', 'ABC_CAJA_OPERAR', null);
  perform pg_temp.d_dia('C2.2 el Cajero/a vuelve a poder', k_caj, 'CFG-LB');
  perform pg_temp.d_cap('C3.1 el Propietario quita «operar la caja» al Encargado en CFG-LB', k_prop, 'cfg6d-cap-0003', 'CFG-LB', 'Encargado', 'ABC_CAJA_OPERAR', false);
  perform pg_temp.d_dia('C3.2 el Encargado ya no puede', k_enc, 'CFG-LB', 'abc_caja_no_autorizado');
  perform pg_temp.d_dia('C3.3 el Propietario siempre puede', k_prop, 'CFG-LB');
end
$t$;
-- ==== FIN CHUNK ====

-- ==== CHUNK: acl ====
do $t$
declare
  v_acl text;
begin
  perform pg_temp.ok('D1.1 es SECURITY DEFINER con search_path vacío',
    (select p.prosecdef and p.proconfig = array['search_path=""'] from pg_proc p where p.oid = 'public.abc_obtener_dia_operativo_local(text,text)'::regprocedure), null);
  perform pg_temp.ok('D1.2 solo authenticated puede ejecutarla (ni public, ni anon, ni service_role)',
    has_function_privilege('authenticated', 'public.abc_obtener_dia_operativo_local(text,text)', 'execute')
    and not has_function_privilege('anon', 'public.abc_obtener_dia_operativo_local(text,text)', 'execute')
    and not has_function_privilege('service_role', 'public.abc_obtener_dia_operativo_local(text,text)', 'execute')
    and not exists (select 1 from pg_proc p, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
                     where p.oid = 'public.abc_obtener_dia_operativo_local(text,text)'::regprocedure and a.grantee = 0 and a.privilege_type = 'EXECUTE'), null);
  perform pg_temp.ok('D1.3 devuelve jsonb', (select p.prorettype = 'jsonb'::regtype from pg_proc p where p.oid = 'public.abc_obtener_dia_operativo_local(text,text)'::regprocedure), null);
end
$t$;
-- ==== FIN CHUNK ====
