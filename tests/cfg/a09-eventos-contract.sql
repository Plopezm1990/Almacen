-- A09 · lectura de los eventos de descuento de una cuenta. Contrato vivo de `abc_listar_eventos_descuento_cuenta`
-- (migración 20261003120000_abc_a09_eventos_descuento_cuenta.sql).
--
-- Se ejecuta DESPUÉS de esa migración (y de las anteriores de la cadena ABC), dentro de una transacción que termina en ROLLBACK:
--
--   begin; <este archivo>; select <resumen de la.log>; rollback;
--
-- No depende de los datos de QA: crea su propia empresa (A09V-EMP y otra), locales, membresías y eventos dentro de la transacción. Solo necesita
-- que existan en auth.users cuatro identificadores de usuario (en QA ya existen; en la réplica local los crea tests/cfg/local-fixture.sql).
-- Los actores se suplantan a nivel de base de datos (set local role + claims JWT). Todo se revierte con el ROLLBACK.

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

-- abc_listar_eventos_descuento_cuenta(empresa, local, cuenta)
create function pg_temp.ev(p_nombre text, p_uid text, p_empresa text, p_local text, p_cuenta text, p_espera text default null, p_rol text default 'authenticated') returns jsonb language plpgsql as $f$
begin
  return pg_temp.paso(p_nombre, p_uid,
    format('select public.abc_listar_eventos_descuento_cuenta(%L,%L,%L::uuid)', p_empresa, p_local, p_cuenta),
    p_espera, p_rol);
end $f$;

-- Lectura rápida (como superusuario) del resultado de una llamada, sin dejar rastro en el registro
create function pg_temp.leer(p_uid text, p_empresa text, p_local text, p_cuenta text) returns jsonb language plpgsql as $f$
declare v_res jsonb;
begin
  perform pg_temp.as_user(p_uid);
  select public.abc_listar_eventos_descuento_cuenta(p_empresa, p_local, p_cuenta::uuid) into v_res;
  execute 'reset role';
  return v_res;
end $f$;

-- ==== FIXTURE ====
do $t$
declare
  k_e    constant text := 'A09V-EMP';
  k_eu   constant text := 'A09V-EMP2';
  k_prop constant text := '16c79749-a206-47d9-8d56-fbc7a4a49eb7';  -- Propietario de la empresa de prueba (todos los locales)
  k_enc  constant text := '5003adca-2e30-477e-8afd-ffb3037b034e';  -- Encargado de L1 (en L2: membresía desactivada)
  k_caj  constant text := 'eb0bca7b-b366-4d72-80e1-0b02e9bdd666';  -- Cajero/a de L1 y Camarero/a de L2
  k_otro constant text := '73967f0c-3474-443d-ad83-9f20b94204c3';  -- Propietario de OTRA empresa
  c1 constant text := '30000000-0000-0000-0000-0000000009a1';
  c2 constant text := '30000000-0000-0000-0000-0000000009a2';
  c3 constant text := '30000000-0000-0000-0000-0000000009a3';
  i int;
begin
  insert into public.empresas(id, nombre, activo) values (k_e, 'Empresa prueba A09V', true), (k_eu, 'Otra empresa prueba A09V', true);
  insert into public.locales(id, empresa_id, nombre, activo) values ('A09V-L1', k_e, 'A09V-L1', true), ('A09V-L2', k_e, 'A09V-L2', true), ('A09V-LU', k_eu, 'A09V-LU', true);
  insert into public.membresias_usuario(user_id, empresa_id, local_id, todos_locales, rol, activo) values
    (k_prop::uuid, k_e, null, true, 'Propietario', true),
    (k_enc::uuid, k_e, 'A09V-L1', false, 'Encargado', true),
    (k_enc::uuid, k_e, 'A09V-L2', false, 'Encargado', false),
    (k_caj::uuid, k_e, 'A09V-L1', false, 'Cajero/a', true),
    (k_caj::uuid, k_e, 'A09V-L2', false, 'Camarero/a', true),
    (k_otro::uuid, k_eu, null, true, 'Propietario', true);

  -- Una operación por evento (los eventos cuelgan de abc_operaciones)
  -- C1 en L1: tres descuentos y un evento de otro tipo; C2 en L1: un descuento; el mismo id de cuenta que C1 en L2: un descuento;
  -- C3 en L1: 105 descuentos (para el límite de 100).
  insert into public.abc_operaciones(operation_id, empresa_id, local_id, command_type, request_hash, status, actor_user_id, resultado, completed_at)
  select 'A09V:op:' || n, k_e, case when n = 'l2c1' then 'A09V-L2' else 'A09V-L1' end, 'PRUEBA', repeat('a', 64), 'COMPLETADA', k_prop::uuid, '{}'::jsonb, now()
    from (select unnest(array['c1a','c1b','c1c','c1x','c2a','l2c1']) as n) q;
  insert into public.abc_operaciones(operation_id, empresa_id, local_id, command_type, request_hash, status, actor_user_id, resultado, completed_at)
  select 'A09V:op:c3-' || lpad(g::text, 3, '0'), k_e, 'A09V-L1', 'PRUEBA', repeat('a', 64), 'COMPLETADA', k_prop::uuid, '{}'::jsonb, now() from generate_series(1, 105) g;

  insert into public.abc_eventos(empresa_id, local_id, operation_id, aggregate_type, aggregate_id, event_type, payload, actor_user_id, occurred_at, operating_day) values
    (k_e, 'A09V-L1', 'A09V:op:c1a', 'CUENTA', c1, 'CUENTA_DESCUENTO_APLICADO', '{"tipo":"PERCENT","valor":10,"importe":1.5,"motivo":"primero"}', k_prop::uuid, '2026-09-23 10:00:00+00', '2026-09-23'),
    (k_e, 'A09V-L1', 'A09V:op:c1b', 'CUENTA', c1, 'CUENTA_DESCUENTO_APLICADO', '{"tipo":"AMOUNT","valor":2,"importe":2,"motivo":"segundo"}', k_enc::uuid, '2026-09-23 11:00:00+00', '2026-09-23'),
    (k_e, 'A09V-L1', 'A09V:op:c1c', 'CUENTA', c1, 'CUENTA_DESCUENTO_APLICADO', '{"tipo":"COURTESY","valor":null,"importe":3,"motivo":"tercero"}', k_prop::uuid, '2026-09-23 12:00:00+00', '2026-09-23'),
    (k_e, 'A09V-L1', 'A09V:op:c1x', 'CUENTA', c1, 'CUENTA_ABIERTA', '{"nota":"otro tipo de evento"}', k_prop::uuid, '2026-09-23 13:00:00+00', '2026-09-23'),
    (k_e, 'A09V-L1', 'A09V:op:c2a', 'CUENTA', c2, 'CUENTA_DESCUENTO_APLICADO', '{"tipo":"PERCENT","valor":5,"importe":0.5,"motivo":"otra cuenta"}', k_prop::uuid, '2026-09-23 09:00:00+00', '2026-09-23'),
    (k_e, 'A09V-L2', 'A09V:op:l2c1', 'CUENTA', c1, 'CUENTA_DESCUENTO_APLICADO', '{"tipo":"PERCENT","valor":99,"importe":99,"motivo":"otro local, mismo id de cuenta"}', k_prop::uuid, '2026-09-23 14:00:00+00', '2026-09-23');
  insert into public.abc_eventos(empresa_id, local_id, operation_id, aggregate_type, aggregate_id, event_type, payload, actor_user_id, occurred_at, operating_day)
  select k_e, 'A09V-L1', 'A09V:op:c3-' || lpad(g::text, 3, '0'), 'CUENTA', c3, 'CUENTA_DESCUENTO_APLICADO', jsonb_build_object('n', g), k_prop::uuid, '2026-09-24 00:00:00+00'::timestamptz + (g || ' minutes')::interval, '2026-09-24'
    from generate_series(1, 105) g;
  -- un evento de otro agregado con el mismo identificador y tipo (no es una cuenta): no debe salir
  insert into public.abc_operaciones(operation_id, empresa_id, local_id, command_type, request_hash, status, actor_user_id, resultado, completed_at)
    values ('A09V:op:otroagg', k_e, 'A09V-L1', 'PRUEBA', repeat('a', 64), 'COMPLETADA', k_prop::uuid, '{}'::jsonb, now());
  insert into public.abc_eventos(empresa_id, local_id, operation_id, aggregate_type, aggregate_id, event_type, payload, actor_user_id, occurred_at, operating_day)
    values (k_e, 'A09V-L1', 'A09V:op:otroagg', 'PEDIDO', c1, 'CUENTA_DESCUENTO_APLICADO', '{"motivo":"no es una cuenta"}', k_prop::uuid, '2026-09-23 15:00:00+00', '2026-09-23');
end $t$;

-- ==== CHUNK: acl ====
do $t$
declare p regprocedure := 'public.abc_listar_eventos_descuento_cuenta(text,text,uuid)'::regprocedure; r record;
begin
  select * into r from pg_proc where oid = p;
  perform pg_temp.ok('A1 es SECURITY DEFINER, con search_path vacío y de solo lectura (STABLE)', r.prosecdef and r.provolatile = 's'
    and coalesce(array_to_string(r.proconfig, ','), '') like '%search_path=""%', jsonb_build_object('prosecdef', r.prosecdef, 'provolatile', r.provolatile, 'proconfig', r.proconfig));
  perform pg_temp.ok('A2 devuelve jsonb', r.prorettype = 'jsonb'::regtype);
  perform pg_temp.ok('A3 la puede ejecutar authenticated', has_function_privilege('authenticated', p, 'execute'));
  perform pg_temp.ok('A4 no la pueden ejecutar anon ni service_role', not has_function_privilege('anon', p, 'execute') and not has_function_privilege('service_role', p, 'execute'));
  perform pg_temp.ok('A5 no hay concesión a PUBLIC (grantee 0) y la única concesión es a authenticated',
    not exists (select 1 from aclexplode(r.proacl) a where a.grantee = 0)
    and (select count(*) from aclexplode(r.proacl) a where a.grantee = (select oid from pg_roles where rolname = 'authenticated') and a.privilege_type = 'EXECUTE') = 1,
    to_jsonb(r.proacl::text));
  perform pg_temp.ok('A6 el navegador sigue sin poder leer abc_eventos directamente (la causa del fallo)',
    not has_table_privilege('authenticated', 'public.abc_eventos', 'select'));
end $t$;
-- ==== FIN CHUNK ====

-- ==== CHUNK: lectura ====
do $t$
declare v jsonb; v2 jsonb; antes int; despues int;
begin
  v := pg_temp.ev('L1 el Propietario lee los descuentos de la cuenta C1', '16c79749-a206-47d9-8d56-fbc7a4a49eb7', 'A09V-EMP', 'A09V-L1', '30000000-0000-0000-0000-0000000009a1');
  perform pg_temp.ok('L2 salen exactamente los tres descuentos de C1 (no el evento de otro tipo, ni el de otro local, ni el de otro agregado)',
    jsonb_typeof(v) = 'array' and jsonb_array_length(v) = 3 and (select bool_and(e->>'event_type' = 'CUENTA_DESCUENTO_APLICADO') from jsonb_array_elements(v) e), v);
  perform pg_temp.ok('L3 del más reciente al más antiguo', (select array_agg(e->'payload'->>'motivo' order by ord) from jsonb_array_elements(v) with ordinality t(e, ord)) = array['tercero', 'segundo', 'primero'], v);
  perform pg_temp.ok('L4 cada elemento trae exactamente las seis columnas de siempre',
    (select bool_and((select array_agg(k order by k) from jsonb_object_keys(e) k) = array['actor_user_id', 'event_type', 'occurred_at', 'operating_day', 'operation_id', 'payload'])
       from jsonb_array_elements(v) e), v);
  perform pg_temp.ok('L5 la carga, el actor, el día y la operación llegan tal cual',
    (v->1->'payload'->>'tipo') = 'AMOUNT' and (v->1->'payload'->>'importe')::numeric = 2 and v->1->>'actor_user_id' = '5003adca-2e30-477e-8afd-ffb3037b034e'
    and v->0->>'operating_day' = '2026-09-23' and v->2->>'operation_id' = 'A09V:op:c1a' and (v->0->>'occurred_at')::timestamptz = '2026-09-23 12:00:00+00'::timestamptz, v);
  v := pg_temp.ev('L6 el Encargado de L1 también lee', '5003adca-2e30-477e-8afd-ffb3037b034e', 'A09V-EMP', 'A09V-L1', '30000000-0000-0000-0000-0000000009a1');
  perform pg_temp.ok('L7 el Encargado ve los mismos tres', jsonb_array_length(v) = 3, v);
  v := pg_temp.ev('L8 el Cajero/a de L1 también lee', 'eb0bca7b-b366-4d72-80e1-0b02e9bdd666', 'A09V-EMP', 'A09V-L1', '30000000-0000-0000-0000-0000000009a1');
  perform pg_temp.ok('L9 el Cajero/a ve los mismos tres', jsonb_array_length(v) = 3, v);
  v := pg_temp.ev('L10 el Camarero/a de L2 lee lo de L2', 'eb0bca7b-b366-4d72-80e1-0b02e9bdd666', 'A09V-EMP', 'A09V-L2', '30000000-0000-0000-0000-0000000009a1');
  perform pg_temp.ok('L11 en L2 con el mismo id de cuenta solo sale el evento de L2 (no se mezclan locales)', jsonb_array_length(v) = 1 and v->0->'payload'->>'motivo' = 'otro local, mismo id de cuenta', v);
  v := pg_temp.ev('L12 otra cuenta de L1', '16c79749-a206-47d9-8d56-fbc7a4a49eb7', 'A09V-EMP', 'A09V-L1', '30000000-0000-0000-0000-0000000009a2');
  perform pg_temp.ok('L13 solo su descuento', jsonb_array_length(v) = 1 and v->0->'payload'->>'motivo' = 'otra cuenta', v);
  v := pg_temp.ev('L14 una cuenta sin descuentos', '16c79749-a206-47d9-8d56-fbc7a4a49eb7', 'A09V-EMP', 'A09V-L1', '30000000-0000-0000-0000-0000000009ff');
  perform pg_temp.ok('L15 devuelve una lista vacía (no nulo ni error)', jsonb_typeof(v) = 'array' and jsonb_array_length(v) = 0, v);
  v := pg_temp.ev('L16 la cuenta con 105 descuentos', '16c79749-a206-47d9-8d56-fbc7a4a49eb7', 'A09V-EMP', 'A09V-L1', '30000000-0000-0000-0000-0000000009a3');
  perform pg_temp.ok('L17 salen como mucho 100', jsonb_array_length(v) = 100);
  perform pg_temp.ok('L18 los 100 más recientes: del 105 al 6, en ese orden',
    (v->0->'payload'->>'n')::int = 105 and (v->99->'payload'->>'n')::int = 6
    and (select bool_and((v->(g-1)->'payload'->>'n')::int = 106 - g) from generate_series(1, 100) g), jsonb_build_object('primero', v->0->'payload', 'ultimo', v->99->'payload'));
  v := pg_temp.leer('16c79749-a206-47d9-8d56-fbc7a4a49eb7', 'A09V-EMP', 'A09V-L1', '30000000-0000-0000-0000-0000000009a1');
  v2 := pg_temp.leer('16c79749-a206-47d9-8d56-fbc7a4a49eb7', 'A09V-EMP', 'A09V-L1', '30000000-0000-0000-0000-0000000009a1');
  perform pg_temp.ok('L19 leer dos veces da lo mismo', v = v2);
  select count(*) into antes from public.abc_eventos;
  perform pg_temp.leer('16c79749-a206-47d9-8d56-fbc7a4a49eb7', 'A09V-EMP', 'A09V-L1', '30000000-0000-0000-0000-0000000009a1');
  select count(*) into despues from public.abc_eventos;
  perform pg_temp.ok('L20 leer no escribe nada (mismo número de eventos)', antes = despues, jsonb_build_object('antes', antes, 'despues', despues));
end $t$;
-- ==== FIN CHUNK ====

-- ==== CHUNK: rechazos ====
select pg_temp.ev('R1 sin sesión', null, 'A09V-EMP', 'A09V-L1', '30000000-0000-0000-0000-0000000009a1', 'descuento_eventos_no_autorizado');
select pg_temp.ev('R2 el Propietario de otra empresa no puede leer esta empresa', '73967f0c-3474-443d-ad83-9f20b94204c3', 'A09V-EMP', 'A09V-L1', '30000000-0000-0000-0000-0000000009a1', 'descuento_eventos_no_autorizado');
select pg_temp.ev('R3 el Encargado con la membresía de L2 desactivada no puede leer L2', '5003adca-2e30-477e-8afd-ffb3037b034e', 'A09V-EMP', 'A09V-L2', '30000000-0000-0000-0000-0000000009a1', 'descuento_eventos_no_autorizado');
select pg_temp.ev('R4 el Cajero/a de L1 es Camarero/a en L2 y puede leer L2 (sin rechazo)', 'eb0bca7b-b366-4d72-80e1-0b02e9bdd666', 'A09V-EMP', 'A09V-L2', '30000000-0000-0000-0000-0000000009a1');
-- Un Propietario de todos los locales de SU empresa no se rechaza por pedir un local que no es de su empresa o que no existe (esa comprobación de
-- pertenencia no es de esta función: la hace la capacidad), pero no ve nada ajeno: los eventos se filtran por empresa Y local, así que sale la lista vacía.
do $t$
declare v jsonb;
begin
  v := pg_temp.ev('R5 el Propietario de la empresa 2 pide el local L1 de la empresa 1', '73967f0c-3474-443d-ad83-9f20b94204c3', 'A09V-EMP2', 'A09V-L1', '30000000-0000-0000-0000-0000000009a1');
  perform pg_temp.ok('R5b y no ve nada de la empresa 1 (lista vacía aunque L1 tiene descuentos de esa cuenta)', jsonb_typeof(v) = 'array' and jsonb_array_length(v) = 0, v);
  v := pg_temp.ev('R6 el Propietario pide un local inexistente de su empresa', '16c79749-a206-47d9-8d56-fbc7a4a49eb7', 'A09V-EMP', 'A09V-NO', '30000000-0000-0000-0000-0000000009a1');
  perform pg_temp.ok('R6b y sale la lista vacía', jsonb_typeof(v) = 'array' and jsonb_array_length(v) = 0, v);
  v := pg_temp.ev('R6c el Propietario de la empresa 1 pide la empresa 2 (no es suya)', '16c79749-a206-47d9-8d56-fbc7a4a49eb7', 'A09V-EMP2', 'A09V-LU', '30000000-0000-0000-0000-0000000009a1', 'descuento_eventos_no_autorizado');
end $t$;
select pg_temp.ev('R7 empresa y local nulos', '16c79749-a206-47d9-8d56-fbc7a4a49eb7', null, null, '30000000-0000-0000-0000-0000000009a1', 'descuento_eventos_no_autorizado');
select pg_temp.paso('R8 sin cuenta', '16c79749-a206-47d9-8d56-fbc7a4a49eb7', $q$select public.abc_listar_eventos_descuento_cuenta('A09V-EMP','A09V-L1',null::uuid)$q$, 'descuento_eventos_parametros_invalidos');
select pg_temp.ev('R9 el rol anon no puede ejecutarla', null, 'A09V-EMP', 'A09V-L1', '30000000-0000-0000-0000-0000000009a1', 'permission denied', 'anon');
select pg_temp.ev('R10 el rol service_role no puede ejecutarla', null, 'A09V-EMP', 'A09V-L1', '30000000-0000-0000-0000-0000000009a1', 'permission denied', 'service_role');
select pg_temp.paso('R11 el navegador sigue sin poder leer la tabla directamente', '16c79749-a206-47d9-8d56-fbc7a4a49eb7', $q$select count(*)::text::jsonb from public.abc_eventos$q$, 'permission denied for table abc_eventos');
-- ==== FIN CHUNK ====
