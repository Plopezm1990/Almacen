-- Capa de configuración, PIEZA 2 · contrato vivo del tratamiento de la diferencia de caja (D15 / D19):
-- umbral por local, motivo obligatorio, aprobación o rechazo del propietario y guarda del cierre definitivo.
--
-- Se ejecuta DESPUÉS de las migraciones 20261002190000 (pieza 1) y 20261002210000 (pieza 2) y de las de cierre
-- de caja de C04, dentro de una transacción que termina en ROLLBACK:
--
--   begin; <este archivo>; select <resumen de la.log>; rollback;
--
-- No depende de los datos de QA: crea su propia empresa de prueba (CFG-EMP-T) y locales (CFG-L1…) dentro de la
-- transacción. Solo necesita que existan en auth.users cuatro identificadores de usuario (en QA ya existen; en
-- la réplica local los crea tests/cfg/local-fixture.sql). Los actores se suplantan a nivel de base de datos
-- (set local role + claims JWT). Todo se revierte con el ROLLBACK.
--
-- Estructura (para poder partirlo en trozos cuando la herramienta corta a los 60 s):
--   -- ==== HELPERS ====   funciones auxiliares
--   -- ==== FIXTURE ====   empresa, locales y membresías
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

-- Ejecuta un SQL como el dueño de la base (sin suplantar a nadie) y exige que falle con el texto dado.
create function pg_temp.falla(p_nombre text, p_sql text, p_espera text) returns void language plpgsql as $f$
declare v_msg text;
begin
  begin
    execute p_sql;
    perform pg_temp.log(p_nombre, 'NEGATIVA_NO_RECHAZADA', null);
  exception when others then
    get stacked diagnostics v_msg = message_text;
    perform pg_temp.log(p_nombre, case when v_msg like '%' || p_espera || '%' then 'NEGATIVA_OK' else 'NEGATIVA_OTRO_ERROR' end, to_jsonb(v_msg));
  end;
end $f$;

-- abc_configurar_ajuste(operation_id, empresa, local, clave, valor, motivo)
create function pg_temp.cfg_aj(p_nombre text, p_uid text, p_op text, p_local text, p_clave text, p_valor jsonb, p_motivo text, p_espera text default null, p_rol text default 'authenticated') returns jsonb language plpgsql as $f$
begin
  return pg_temp.paso(p_nombre, p_uid,
    format('select public.abc_configurar_ajuste(%L,%L,%L,%L,%L::jsonb,%L)', p_op, 'CFG-EMP-T', p_local, p_clave, p_valor::text, p_motivo),
    p_espera, p_rol);
end $f$;

create function pg_temp.cfg_ajustes(p_nombre text, p_uid text, p_local text, p_espera text default null) returns jsonb language plpgsql as $f$
begin
  return pg_temp.paso(p_nombre, p_uid, format('select public.abc_obtener_ajustes(%L,%L)', 'CFG-EMP-T', p_local), p_espera);
end $f$;

-- Cierre de caja: abc_iniciar_cierre_sesion_caja / abc_confirmar_cierre_provisional / abc_finalizar_cierre_sesion_caja
create function pg_temp.f_ini(p_nombre text, p_uid text, p_op text, p_local text, p_sesion uuid, p_term uuid, p_espera text default null) returns jsonb language plpgsql as $f$
begin
  return pg_temp.paso(p_nombre, p_uid,
    format('select public.abc_iniciar_cierre_sesion_caja(%L,%L,%L,%L::uuid,%L::uuid,%L::date)', p_op, 'CFG-EMP-T', p_local, p_sesion, p_term, current_date), p_espera);
end $f$;

create function pg_temp.f_prov(p_nombre text, p_uid text, p_op text, p_local text, p_sesion uuid, p_term uuid, p_contado numeric, p_espera text default null) returns jsonb language plpgsql as $f$
begin
  return pg_temp.paso(p_nombre, p_uid,
    format('select public.abc_confirmar_cierre_provisional(%L,%L,%L,%L::uuid,%L::uuid,%L,%L::numeric,%L::date)', p_op, 'CFG-EMP-T', p_local, p_sesion, p_term, 'EUR', p_contado, current_date), p_espera);
end $f$;

-- Todo el contrato corre en una sola transacción y now() no avanza: las restricciones «hasta > desde» y
-- «cerrada_at > abierta_at» del cierre real se cumplirían con transacciones separadas. Aquí se adelanta el
-- reloj de la sesión: se retrasa una hora lo que se guardó al abrirla.
create function pg_temp.envejecer(p_sesion uuid) returns void language plpgsql as $f$
begin
  update public.caja_sesion_terminales set desde = desde - interval '1 hour' where session_id = p_sesion;
  update public.caja_sesion_responsables set desde = desde - interval '1 hour' where session_id = p_sesion;
  update public.caja_sesiones set abierta_at = abierta_at - interval '1 hour' where id = p_sesion;
end $f$;

create function pg_temp.f_fin(p_nombre text, p_uid text, p_op text, p_local text, p_sesion uuid, p_term uuid, p_espera text default null) returns jsonb language plpgsql as $f$
begin
  perform pg_temp.envejecer(p_sesion);
  return pg_temp.paso(p_nombre, p_uid,
    format('select public.abc_finalizar_cierre_sesion_caja(%L,%L,%L,%L::uuid,%L::uuid,%L,%L::date)', p_op, 'CFG-EMP-T', p_local, p_sesion, p_term, 'EUR', current_date), p_espera);
end $f$;

create function pg_temp.f_reabrir(p_nombre text, p_uid text, p_op text, p_local text, p_sesion uuid, p_term uuid, p_motivo text, p_espera text default null) returns jsonb language plpgsql as $f$
begin
  return pg_temp.paso(p_nombre, p_uid,
    format('select public.abc_reabrir_cierre_provisional(%L,%L,%L,%L::uuid,%L::uuid,%L,%L::date)', p_op, 'CFG-EMP-T', p_local, p_sesion, p_term, p_motivo, current_date), p_espera);
end $f$;

-- Funciones de la pieza 2
create function pg_temp.f_reg(p_nombre text, p_uid text, p_op text, p_local text, p_sesion uuid, p_motivo text, p_espera text default null, p_rol text default 'authenticated') returns jsonb language plpgsql as $f$
begin
  return pg_temp.paso(p_nombre, p_uid,
    format('select public.abc_registrar_diferencia_caja(%L,%L,%L,%L::uuid,%L)', p_op, 'CFG-EMP-T', p_local, p_sesion, p_motivo), p_espera, p_rol);
end $f$;

create function pg_temp.f_dec(p_nombre text, p_uid text, p_op text, p_local text, p_sesion uuid, p_decision text, p_motivo text, p_espera text default null, p_rol text default 'authenticated') returns jsonb language plpgsql as $f$
begin
  return pg_temp.paso(p_nombre, p_uid,
    format('select public.abc_decidir_diferencia_caja(%L,%L,%L,%L::uuid,%L,%L)', p_op, 'CFG-EMP-T', p_local, p_sesion, p_decision, p_motivo), p_espera, p_rol);
end $f$;

create function pg_temp.f_obt(p_nombre text, p_uid text, p_local text, p_sesion uuid, p_espera text default null) returns jsonb language plpgsql as $f$
begin
  return pg_temp.paso(p_nombre, p_uid,
    format('select public.abc_obtener_diferencia_caja(%L,%L,%L::uuid)', 'CFG-EMP-T', p_local, p_sesion), p_espera);
end $f$;

-- Crea una caja y un terminal propios, abre la sesión (con fondo), inicia el cierre y confirma el provisional.
-- Devuelve {s: sesión, t: terminal, c: caja, prov: resultado del provisional}.
create function pg_temp.sesion_prov(p_pref text, p_uid text, p_local text, p_fondo numeric, p_contado numeric) returns jsonb language plpgsql as $f$
declare v_caja uuid; v_term uuid; v_s uuid:=gen_random_uuid(); v_prov jsonb;
begin
  insert into public.cajas_fisicas(empresa_id, local_id, nombre) values ('CFG-EMP-T', p_local, 'C-' || p_pref) returning id into v_caja;
  insert into public.terminales_tpv(empresa_id, local_id, nombre) values ('CFG-EMP-T', p_local, 'T-' || p_pref) returning id into v_term;
  perform pg_temp.paso(p_pref || ' abre la sesión (fondo ' || p_fondo || ')', p_uid,
    format('select public.abc_abrir_sesion_caja(%L,%L,%L,%L::uuid,%L::uuid,%L::uuid,%L::uuid,%L,%L::numeric,%L::date)',
      p_pref || '-abrir', 'CFG-EMP-T', p_local, v_s, v_caja, '16c79749-a206-47d9-8d56-fbc7a4a49eb7', v_term, 'EUR', p_fondo, current_date));
  perform pg_temp.f_ini(p_pref || ' inicia el cierre', p_uid, p_pref || '-inicio', p_local, v_s, v_term);
  v_prov := pg_temp.f_prov(p_pref || ' confirma el cierre provisional (contado ' || p_contado || ')', p_uid, p_pref || '-prov', p_local, v_s, v_term, p_contado);
  return jsonb_build_object('s', v_s, 't', v_term, 'c', v_caja, 'prov', v_prov);
end $f$;

-- ==== FIXTURE ====
do $t$
declare
  k_e    constant text := 'CFG-EMP-T';
  k_eu   constant text := 'CFG-EMP-U';
  k_prop constant text := '16c79749-a206-47d9-8d56-fbc7a4a49eb7';  -- Propietario de la empresa de prueba (todos los locales)
  k_enc  constant text := '5003adca-2e30-477e-8afd-ffb3037b034e';  -- Encargado (locales L1…L6)
  k_caj  constant text := 'eb0bca7b-b366-4d72-80e1-0b02e9bdd666';  -- Cajero/a (locales L1…L6)
  k_otro constant text := '73967f0c-3474-443d-ad83-9f20b94204c3';  -- Propietario de OTRA empresa
  l text;
begin
  insert into public.empresas(id, nombre, activo) values (k_e, 'Empresa prueba capa de configuración', true), (k_eu, 'Otra empresa prueba', true);
  insert into public.membresias_usuario(user_id, empresa_id, local_id, todos_locales, rol, activo) values
    (k_prop::uuid, k_e, null, true, 'Propietario', true),
    (k_otro::uuid, k_eu, null, true, 'Propietario', true);
  foreach l in array array['CFG-LS', 'CFG-L1', 'CFG-L2', 'CFG-L3', 'CFG-L4', 'CFG-L5', 'CFG-L6'] loop
    insert into public.locales(id, empresa_id, nombre, activo) values (l, k_e, l, true);
    insert into public.membresias_usuario(user_id, empresa_id, local_id, todos_locales, rol, activo) values
      (k_enc::uuid, k_e, l, false, 'Encargado', true),
      (k_caj::uuid, k_e, l, false, 'Cajero/a', true);
  end loop;
  insert into public.locales(id, empresa_id, nombre, activo) values ('CFG-LU', k_eu, 'LU', true);
end
$t$;

-- ==== CHUNK: ajustes ====
-- A. El umbral de diferencia como ajuste por local.
do $t$
declare
  k_e    constant text := 'CFG-EMP-T';
  k_loc  constant text := 'CFG-LS';
  k_prop constant text := '16c79749-a206-47d9-8d56-fbc7a4a49eb7';
  k_enc  constant text := '5003adca-2e30-477e-8afd-ffb3037b034e';
  k_caj  constant text := 'eb0bca7b-b366-4d72-80e1-0b02e9bdd666';
  k_otro constant text := '73967f0c-3474-443d-ad83-9f20b94204c3';
  v jsonb; v2 jsonb; v_primero jsonb; v_cnt integer;
begin
  v := pg_temp.cfg_ajustes('A1.1 lectura de un local sin configurar', k_prop, k_loc);
  perform pg_temp.ok('A1.2 umbral 0 por defecto (cualquier diferencia exige aprobación) y cajas 10 por defecto',
    (v->'caja_diferencia_umbral'->>'valor')::numeric = 0 and v->'caja_diferencia_umbral'->>'origen' = 'defecto'
    and (v->'caja_diferencia_umbral'->>'version')::int = 0
    and (v->'cajas_abiertas_max'->>'valor')::int = 10 and v->'cajas_abiertas_max'->>'origen' = 'defecto', v);

  perform pg_temp.cfg_aj('A2.1 el Encargado no puede configurar el umbral', k_enc, 'cfg2-um-perm-01', k_loc, 'caja_diferencia_umbral', '5'::jsonb, 'x', 'abc_config_no_autorizado');
  perform pg_temp.cfg_aj('A2.2 el Cajero/a no puede', k_caj, 'cfg2-um-perm-02', k_loc, 'caja_diferencia_umbral', '5'::jsonb, 'x', 'abc_config_no_autorizado');
  perform pg_temp.cfg_aj('A2.3 el Propietario de otra empresa no puede', k_otro, 'cfg2-um-perm-03', k_loc, 'caja_diferencia_umbral', '5'::jsonb, 'x', 'abc_config_no_autorizado');
  perform pg_temp.cfg_aj('A2.4 anon no puede', null, 'cfg2-um-perm-04', k_loc, 'caja_diferencia_umbral', '5'::jsonb, 'x', 'permission denied', 'anon');
  perform pg_temp.cfg_aj('A2.5 service_role no puede', null, 'cfg2-um-perm-05', k_loc, 'caja_diferencia_umbral', '5'::jsonb, 'x', 'permission denied', 'service_role');

  perform pg_temp.cfg_aj('A3.1 umbral negativo', k_prop, 'cfg2-um-val-01', k_loc, 'caja_diferencia_umbral', '-0.01'::jsonb, 'x', 'ajuste_valor_fuera_de_rango');
  perform pg_temp.cfg_aj('A3.2 umbral por encima de 10000', k_prop, 'cfg2-um-val-02', k_loc, 'caja_diferencia_umbral', '10000.01'::jsonb, 'x', 'ajuste_valor_fuera_de_rango');
  perform pg_temp.cfg_aj('A3.3 tres decimales', k_prop, 'cfg2-um-val-03', k_loc, 'caja_diferencia_umbral', '2.345'::jsonb, 'x', 'ajuste_valor_fuera_de_rango');
  perform pg_temp.cfg_aj('A3.4 escrito como texto', k_prop, 'cfg2-um-val-04', k_loc, 'caja_diferencia_umbral', '"5"'::jsonb, 'x', 'ajuste_valor_invalido');
  perform pg_temp.cfg_aj('A3.5 null de JSON', k_prop, 'cfg2-um-val-05', k_loc, 'caja_diferencia_umbral', 'null'::jsonb, 'x', 'ajuste_valor_invalido');
  perform pg_temp.cfg_aj('A3.6 sin motivo', k_prop, 'cfg2-um-val-06', k_loc, 'caja_diferencia_umbral', '5'::jsonb, null, 'ajuste_motivo_requerido');
  perform pg_temp.cfg_aj('A3.7 clave desconocida sigue rechazada', k_prop, 'cfg2-um-val-07', k_loc, 'otra_clave', '5'::jsonb, 'x', 'ajuste_clave_invalida');

  v := pg_temp.cfg_aj('A4.1 el Propietario fija el umbral en 5', k_prop, 'cfg2-um-0001', k_loc, 'caja_diferencia_umbral', '5'::jsonb, 'D15: aprueba el propietario por encima de 5 euros');
  v_primero := v;
  perform pg_temp.ok('A4.2 cambio, versión 1, valor 5, origen local',
    (v->>'cambio')::boolean and (v->>'version')::int = 1 and (v->>'valor')::numeric = 5 and v->>'origen' = 'local' and v->>'clave' = 'caja_diferencia_umbral', v);
  v := pg_temp.cfg_ajustes('A4.3 la lectura refleja el umbral', k_prop, k_loc);
  perform pg_temp.ok('A4.4 umbral 5 origen local; el otro ajuste no se movió',
    (v->'caja_diferencia_umbral'->>'valor')::numeric = 5 and v->'caja_diferencia_umbral'->>'origen' = 'local'
    and (v->'caja_diferencia_umbral'->>'version')::int = 1 and v->'cajas_abiertas_max'->>'origen' = 'defecto', v);
  v := pg_temp.cfg_ajustes('A4.5 el Encargado del local puede leer', k_enc, k_loc);
  perform pg_temp.ok('A4.6 y ve el umbral', (v->'caja_diferencia_umbral'->>'valor')::numeric = 5, v);

  v2 := pg_temp.cfg_aj('A5.1 replay del mismo operation_id', k_prop, 'cfg2-um-0001', k_loc, 'caja_diferencia_umbral', '5'::jsonb, 'D15: aprueba el propietario por encima de 5 euros');
  perform pg_temp.ok('A5.2 el replay devuelve el resultado original', v2 = v_primero, v2);
  perform pg_temp.cfg_aj('A5.3 mismo operation_id con otro contenido: conflicto', k_prop, 'cfg2-um-0001', k_loc, 'caja_diferencia_umbral', '6'::jsonb, 'otro', 'operation_id_conflict');
  v2 := pg_temp.cfg_aj('A5.4 mismo valor con otro operation_id (escrito 5.00)', k_prop, 'cfg2-um-0002', k_loc, 'caja_diferencia_umbral', '5.00'::jsonb, 'repetir');
  perform pg_temp.ok('A5.5 sin cambio: la versión no sube', not (v2->>'cambio')::boolean and (v2->>'version')::int = 1, v2);

  v := pg_temp.cfg_aj('A6.1 sube a 7,5', k_prop, 'cfg2-um-0003', k_loc, 'caja_diferencia_umbral', '7.5'::jsonb, 'subir');
  perform pg_temp.ok('A6.2 versión 2 y valor 7,5', (v->>'version')::int = 2 and (v->>'valor')::numeric = 7.5, v);
  v := pg_temp.cfg_aj('A6.3 baja a 0', k_prop, 'cfg2-um-0004', k_loc, 'caja_diferencia_umbral', '0'::jsonb, 'cualquier diferencia exige aprobación');
  perform pg_temp.ok('A6.4 versión 3 y valor 0 (se permite)', (v->>'version')::int = 3 and (v->>'valor')::numeric = 0, v);
  v := pg_temp.cfg_aj('A6.5 el máximo, 10000, se admite', k_prop, 'cfg2-um-0005', k_loc, 'caja_diferencia_umbral', '10000'::jsonb, 'máximo');
  perform pg_temp.ok('A6.6 versión 4', (v->>'version')::int = 4 and (v->>'valor')::numeric = 10000, v);

  v := pg_temp.cfg_aj('A7.1 el ajuste de la pieza 1 sigue funcionando (cajas 4)', k_prop, 'cfg2-aj-0001', k_loc, 'cajas_abiertas_max', '4'::jsonb, 'prueba');
  perform pg_temp.ok('A7.2 valor entero (JSON 4), versión 1', v->'valor' = '4'::jsonb and (v->>'version')::int = 1 and (v->>'cambio')::boolean, v);
  perform pg_temp.cfg_aj('A7.3 y mantiene su rango (11 sigue siendo inválido)', k_prop, 'cfg2-aj-0002', k_loc, 'cajas_abiertas_max', '11'::jsonb, 'x', 'ajuste_valor_fuera_de_rango');
  perform pg_temp.cfg_aj('A7.4 y que sea entero (2,5 sigue siendo inválido)', k_prop, 'cfg2-aj-0003', k_loc, 'cajas_abiertas_max', '2.5'::jsonb, 'x', 'ajuste_valor_fuera_de_rango');

  select count(*) into v_cnt from public.abc_eventos
   where empresa_id = k_e and local_id = k_loc and event_type = 'AJUSTE_CONFIGURADO' and aggregate_id = 'caja_diferencia_umbral';
  perform pg_temp.ok('A8.1 cuatro cambios reales del umbral dejaron cuatro eventos', v_cnt = 4, to_jsonb(v_cnt));
  perform pg_temp.ok('A8.2 el primero guarda anterior nulo y nuevo 5',
    (select payload->'anterior' from public.abc_eventos where operation_id = 'cfg2-um-0001' and event_type = 'AJUSTE_CONFIGURADO') = 'null'::jsonb
    and (select (payload->>'nuevo')::numeric from public.abc_eventos where operation_id = 'cfg2-um-0001' and event_type = 'AJUSTE_CONFIGURADO') = 5, null);
  perform pg_temp.ok('A8.3 el segundo guarda anterior 5 y nuevo 7,5',
    (select (payload->>'anterior')::numeric from public.abc_eventos where operation_id = 'cfg2-um-0003' and event_type = 'AJUSTE_CONFIGURADO') = 5
    and (select (payload->>'nuevo')::numeric from public.abc_eventos where operation_id = 'cfg2-um-0003' and event_type = 'AJUSTE_CONFIGURADO') = 7.5, null);

  perform pg_temp.falla('A9.1 la tabla rechaza un umbral de 10001', format('insert into public.abc_config_ajustes(empresa_id,local_id,clave,valor,motivo) values (%L,%L,%L,%L::jsonb,%L)', k_e, 'CFG-L1', 'caja_diferencia_umbral', '10001', 'x'), 'abc_config_ajuste_valor');
  perform pg_temp.falla('A9.2 la tabla rechaza tres decimales', format('insert into public.abc_config_ajustes(empresa_id,local_id,clave,valor,motivo) values (%L,%L,%L,%L::jsonb,%L)', k_e, 'CFG-L1', 'caja_diferencia_umbral', '5.555', 'x'), 'abc_config_ajuste_valor');
  perform pg_temp.falla('A9.3 la tabla rechaza una clave desconocida', format('insert into public.abc_config_ajustes(empresa_id,local_id,clave,valor,motivo) values (%L,%L,%L,%L::jsonb,%L)', k_e, 'CFG-L1', 'otra', '5', 'x'), 'abc_config_ajuste_clave');
  perform pg_temp.falla('A9.4 la tabla rechaza un texto como umbral', format('insert into public.abc_config_ajustes(empresa_id,local_id,clave,valor,motivo) values (%L,%L,%L,%L::jsonb,%L)', k_e, 'CFG-L1', 'caja_diferencia_umbral', '"5"', 'x'), 'abc_config_ajuste_valor');

  perform pg_temp.paso('A10.1 la tabla de diferencias no se puede leer directamente', k_prop, 'select to_jsonb(count(*)) from public.caja_cierre_diferencias', 'permission denied');
  perform pg_temp.paso('A10.2 ni escribir directamente', k_prop,
    'with z as (insert into public.caja_cierre_diferencias(empresa_id,local_id,session_id,cierre_id,currency_code,expected_amount,counted_amount,difference,umbral_aplicado,requiere_aprobacion,motivo,motivo_por) values (''x'',''x'',gen_random_uuid(),gen_random_uuid(),''EUR'',1,1,1,0,false,''x'',gen_random_uuid()) returning 1) select to_jsonb(1) from z', 'permission denied');
end
$t$;
-- ==== FIN CHUNK ====

-- ==== CHUNK: flujo_dentro_umbral ====
-- B. Diferencia pequeña (dentro del umbral): basta el motivo; no hace falta aprobación.
do $t$
declare
  k_e    constant text := 'CFG-EMP-T';
  k_loc  constant text := 'CFG-L1';
  k_prop constant text := '16c79749-a206-47d9-8d56-fbc7a4a49eb7';
  k_enc  constant text := '5003adca-2e30-477e-8afd-ffb3037b034e';
  k_caj  constant text := 'eb0bca7b-b366-4d72-80e1-0b02e9bdd666';
  v jsonb; v2 jsonb; v_primero jsonb; v_s uuid; v_t uuid; v_cnt integer; x jsonb;
begin
  perform pg_temp.cfg_aj('B0.1 umbral del local en 5', k_prop, 'cfg2-b-um-0001', k_loc, 'caja_diferencia_umbral', '5'::jsonb, 'prueba');
  x := pg_temp.sesion_prov('cfg2-b1', k_caj, k_loc, 100, 97);
  v_s := (x->>'s')::uuid; v_t := (x->>'t')::uuid;
  perform pg_temp.ok('B0.2 el cierre provisional informa la diferencia de -3 (existente de C04, sin cambios)',
    (x->'prov'->>'difference')::numeric = -3 and (x->'prov'->>'expected_amount')::numeric = 100 and (x->'prov'->>'counted_amount')::numeric = 97 and x->'prov'->>'estado' = 'CIERRE_PROVISIONAL', x->'prov');

  v := pg_temp.f_obt('B1.1 el Cajero/a lee el estado de la diferencia', k_caj, k_loc, v_s);
  perform pg_temp.ok('B1.2 diferencia -3, esperado 100, contado 97, umbral 5, no requiere aprobación, sin registro',
    (v->>'difference')::numeric = -3 and (v->>'expected_amount')::numeric = 100 and (v->>'counted_amount')::numeric = 97
    and (v->>'umbral')::numeric = 5 and not (v->>'requiere_aprobacion')::boolean and v->'registro' = 'null'::jsonb
    and v->>'session_estado' = 'CIERRE_PROVISIONAL' and v->>'currency_code' = 'EUR', v);
  perform pg_temp.ok('B1.3 queda bloqueado por falta de motivo', v->'bloqueos' = '["DIFERENCIA_SIN_MOTIVO"]'::jsonb, v->'bloqueos');

  perform pg_temp.f_reg('B2.1 registrar sin motivo', k_caj, 'cfg2-b1-reg-00', k_loc, v_s, '   ', 'diferencia_caja_motivo_requerido');
  perform pg_temp.f_reg('B2.2 registrar con un motivo de más de 500 caracteres', k_caj, 'cfg2-b1-reg-01', k_loc, v_s, repeat('x', 501), 'diferencia_caja_motivo_invalido');
  perform pg_temp.f_fin('B2.3 finalizar sin registrar el motivo se rechaza', k_caj, 'cfg2-b1-fin-01', k_loc, v_s, v_t, 'DIFERENCIA_SIN_MOTIVO');
  perform pg_temp.ok('B2.4 la sesión sigue en cierre provisional y no hay cierre final',
    (select estado from public.caja_sesiones where id = v_s) = 'CIERRE_PROVISIONAL'
    and not exists (select 1 from public.caja_cierres where session_id = v_s and estado = 'FINAL'), null);
  perform pg_temp.f_fin('B2.5 el mensaje es el de la guarda nueva', k_caj, 'cfg2-b1-fin-02', k_loc, v_s, v_t, 'cierre_definitivo_diferencia_pendiente');

  v := pg_temp.f_reg('B3.1 el Cajero/a registra el motivo', k_caj, 'cfg2-b1-reg-02', k_loc, v_s, 'Faltaron 3 euros en monedas sueltas');
  v_primero := v;
  perform pg_temp.ok('B3.2 REGISTRADA, diferencia -3, no requiere aprobación, versión 1, sin bloqueos',
    v->>'estado' = 'REGISTRADA' and (v->>'difference')::numeric = -3 and not (v->>'requiere_aprobacion')::boolean
    and (v->>'version')::int = 1 and (v->>'umbral')::numeric = 5 and v->'bloqueos' = '[]'::jsonb, v);
  v2 := pg_temp.f_reg('B3.3 replay del mismo operation_id', k_caj, 'cfg2-b1-reg-02', k_loc, v_s, 'Faltaron 3 euros en monedas sueltas');
  perform pg_temp.ok('B3.4 el replay devuelve el resultado original', v2 = v_primero, v2);
  perform pg_temp.f_reg('B3.5 mismo operation_id con otro motivo: conflicto', k_caj, 'cfg2-b1-reg-02', k_loc, v_s, 'otro motivo', 'operation_id_conflict');

  perform pg_temp.f_dec('B4.1 decidir una diferencia dentro del umbral no procede', k_prop, 'cfg2-b1-dec-01', k_loc, v_s, 'APROBAR', 'x', 'diferencia_caja_no_requiere_aprobacion');
  perform pg_temp.f_dec('B4.2 el Cajero/a no puede decidir', k_caj, 'cfg2-b1-dec-02', k_loc, v_s, 'APROBAR', 'x', 'abc_diferencia_caja_no_autorizada');

  v := pg_temp.f_obt('B5.1 el estado ya muestra el registro', k_caj, k_loc, v_s);
  perform pg_temp.ok('B5.2 registro REGISTRADA con su motivo y sin bloqueos',
    v->'registro'->>'estado' = 'REGISTRADA' and v->'registro'->>'motivo' = 'Faltaron 3 euros en monedas sueltas'
    and (v->'registro'->>'motivo_por') = k_caj and v->'bloqueos' = '[]'::jsonb, v);

  v := pg_temp.f_fin('B6.1 ahora el Cajero/a puede finalizar', k_caj, 'cfg2-b1-fin-03', k_loc, v_s, v_t);
  perform pg_temp.ok('B6.2 cerrada definitivamente con diferencia -3', v->>'estado' = 'CERRADA_FINAL' and (v->>'difference')::numeric = -3, v);

  select count(*) into v_cnt from public.abc_eventos where empresa_id = k_e and local_id = k_loc and aggregate_id = v_s::text and event_type = 'CAJA_DIFERENCIA_REGISTRADA';
  perform pg_temp.ok('B7.1 un evento de diferencia registrada', v_cnt = 1, to_jsonb(v_cnt));
  perform pg_temp.ok('B7.2 con diferencia, esperado, contado, umbral, motivo y actor',
    (select (payload->>'difference')::numeric from public.abc_eventos where operation_id = 'cfg2-b1-reg-02' and event_type = 'CAJA_DIFERENCIA_REGISTRADA') = -3
    and (select (payload->>'expected_amount')::numeric from public.abc_eventos where operation_id = 'cfg2-b1-reg-02' and event_type = 'CAJA_DIFERENCIA_REGISTRADA') = 100
    and (select (payload->>'counted_amount')::numeric from public.abc_eventos where operation_id = 'cfg2-b1-reg-02' and event_type = 'CAJA_DIFERENCIA_REGISTRADA') = 97
    and (select (payload->>'umbral')::numeric from public.abc_eventos where operation_id = 'cfg2-b1-reg-02' and event_type = 'CAJA_DIFERENCIA_REGISTRADA') = 5
    and (select payload->>'motivo' from public.abc_eventos where operation_id = 'cfg2-b1-reg-02' and event_type = 'CAJA_DIFERENCIA_REGISTRADA') = 'Faltaron 3 euros en monedas sueltas'
    and (select actor_user_id from public.abc_eventos where operation_id = 'cfg2-b1-reg-02' and event_type = 'CAJA_DIFERENCIA_REGISTRADA') = k_caj::uuid, null);
  perform pg_temp.ok('B7.3 el cierre definitivo también guarda la diferencia (evento de C04)',
    (select (payload->>'difference')::numeric from public.abc_eventos where operation_id = 'cfg2-b1-fin-03' and event_type = 'CAJA_SESION_CERRADA') = -3, null);
  perform pg_temp.ok('B7.4 la fila de la diferencia queda con estado REGISTRADA y apunta al cierre final',
    (select count(*) from public.caja_cierre_diferencias d join public.caja_cierres c on c.id = d.cierre_id
      where d.session_id = v_s and d.estado = 'REGISTRADA' and c.estado = 'FINAL' and d.difference = -3 and d.currency_code = 'EUR') = 1, null);

  perform pg_temp.f_reg('B8.1 una vez cerrada ya no se puede registrar', k_caj, 'cfg2-b1-reg-03', k_loc, v_s, 'tarde', 'cierre_provisional_no_encontrado');
end
$t$;
-- ==== FIN CHUNK ====

-- ==== CHUNK: flujo_aprobacion ====
-- C. Diferencia sobre el umbral: la aprueba el propietario (y solo él).
do $t$
declare
  k_e    constant text := 'CFG-EMP-T';
  k_loc  constant text := 'CFG-L2';
  k_prop constant text := '16c79749-a206-47d9-8d56-fbc7a4a49eb7';
  k_enc  constant text := '5003adca-2e30-477e-8afd-ffb3037b034e';
  k_caj  constant text := 'eb0bca7b-b366-4d72-80e1-0b02e9bdd666';
  k_otro constant text := '73967f0c-3474-443d-ad83-9f20b94204c3';
  v jsonb; v2 jsonb; v_primero jsonb; v_s uuid; v_t uuid; x jsonb;
begin
  perform pg_temp.cfg_aj('C0.1 umbral del local en 5', k_prop, 'cfg2-c-um-0001', k_loc, 'caja_diferencia_umbral', '5'::jsonb, 'prueba');
  x := pg_temp.sesion_prov('cfg2-c1', k_caj, k_loc, 100, 80);
  v_s := (x->>'s')::uuid; v_t := (x->>'t')::uuid;

  v := pg_temp.f_reg('C1.1 el Encargado registra el motivo (también puede)', k_enc, 'cfg2-c1-reg-01', k_loc, v_s, 'Se entregó un cambio de 20 euros de más');
  perform pg_temp.ok('C1.2 REGISTRADA, diferencia -20, requiere aprobación, pendiente',
    v->>'estado' = 'REGISTRADA' and (v->>'difference')::numeric = -20 and (v->>'requiere_aprobacion')::boolean
    and v->'bloqueos' = '["DIFERENCIA_PENDIENTE_APROBACION"]'::jsonb, v);
  perform pg_temp.f_fin('C1.3 finalizar sin la aprobación se rechaza', k_caj, 'cfg2-c1-fin-01', k_loc, v_s, v_t, 'DIFERENCIA_PENDIENTE_APROBACION');

  perform pg_temp.f_dec('C2.1 el Encargado no puede decidir', k_enc, 'cfg2-c1-dec-01', k_loc, v_s, 'APROBAR', 'x', 'abc_diferencia_caja_no_autorizada');
  perform pg_temp.f_dec('C2.2 el Cajero/a no puede decidir', k_caj, 'cfg2-c1-dec-02', k_loc, v_s, 'APROBAR', 'x', 'abc_diferencia_caja_no_autorizada');
  perform pg_temp.f_dec('C2.3 el Propietario de otra empresa no puede decidir', k_otro, 'cfg2-c1-dec-03', k_loc, v_s, 'APROBAR', 'x', 'abc_diferencia_caja_no_autorizada');
  perform pg_temp.f_dec('C2.4 anon no puede ejecutar la RPC', null, 'cfg2-c1-dec-04', k_loc, v_s, 'APROBAR', 'x', 'permission denied', 'anon');
  perform pg_temp.f_dec('C2.5 service_role no puede ejecutar la RPC', null, 'cfg2-c1-dec-05', k_loc, v_s, 'APROBAR', 'x', 'permission denied', 'service_role');
  perform pg_temp.f_dec('C2.6 decisión inválida', k_prop, 'cfg2-c1-dec-06', k_loc, v_s, 'TAL_VEZ', 'x', 'diferencia_caja_decision_invalida');
  perform pg_temp.f_dec('C2.7 sin motivo de la decisión', k_prop, 'cfg2-c1-dec-07', k_loc, v_s, 'APROBAR', '  ', 'diferencia_caja_motivo_requerido');
  perform pg_temp.ok('C2.8 los rechazos no cambiaron nada: sigue REGISTRADA y sin decisión',
    (select estado from public.caja_cierre_diferencias where session_id = v_s) = 'REGISTRADA'
    and (select decidido_por from public.caja_cierre_diferencias where session_id = v_s) is null
    and (select version from public.caja_cierre_diferencias where session_id = v_s) = 1, null);

  v := pg_temp.f_dec('C3.1 el Propietario aprueba con motivo', k_prop, 'cfg2-c1-dec-08', k_loc, v_s, 'aprobar', 'Revisado con el cajero y el ticket');
  v_primero := v;
  perform pg_temp.ok('C3.2 APROBADA, versión 2, sin bloqueos (la decisión admite minúsculas)',
    v->>'estado' = 'APROBADA' and (v->>'version')::int = 2 and (v->>'difference')::numeric = -20 and v->'bloqueos' = '[]'::jsonb, v);
  v2 := pg_temp.f_dec('C3.3 replay del mismo operation_id', k_prop, 'cfg2-c1-dec-08', k_loc, v_s, 'aprobar', 'Revisado con el cajero y el ticket');
  perform pg_temp.ok('C3.4 el replay devuelve el resultado original', v2 = v_primero, v2);
  perform pg_temp.f_dec('C3.5 mismo operation_id con otra decisión: conflicto', k_prop, 'cfg2-c1-dec-08', k_loc, v_s, 'RECHAZAR', 'Revisado con el cajero y el ticket', 'operation_id_conflict');
  perform pg_temp.f_dec('C3.6 no se decide dos veces', k_prop, 'cfg2-c1-dec-09', k_loc, v_s, 'RECHAZAR', 'cambio de opinión', 'diferencia_caja_ya_decidida');
  perform pg_temp.f_reg('C3.7 ni se cambia el motivo después de decidir', k_caj, 'cfg2-c1-reg-02', k_loc, v_s, 'otro motivo', 'diferencia_caja_ya_decidida');
  perform pg_temp.ok('C3.8 la fila guarda quién decidió, cuándo y por qué',
    (select decidido_por from public.caja_cierre_diferencias where session_id = v_s) = k_prop::uuid
    and (select decidido_at from public.caja_cierre_diferencias where session_id = v_s) is not null
    and (select decision_motivo from public.caja_cierre_diferencias where session_id = v_s) = 'Revisado con el cajero y el ticket'
    and (select motivo_por from public.caja_cierre_diferencias where session_id = v_s) = k_enc::uuid, null);

  v := pg_temp.f_fin('C4.1 el Cajero/a finaliza con la diferencia aprobada', k_caj, 'cfg2-c1-fin-02', k_loc, v_s, v_t);
  perform pg_temp.ok('C4.2 cerrada definitivamente con diferencia -20', v->>'estado' = 'CERRADA_FINAL' and (v->>'difference')::numeric = -20, v);

  perform pg_temp.ok('C5.1 cinta de auditoría: registrada (Encargado), aprobada (Propietario) y cerrada, en ese orden',
    (select array_agg(event_type order by id) from public.abc_eventos
      where empresa_id = k_e and local_id = k_loc and aggregate_id = v_s::text
        and event_type in ('CAJA_DIFERENCIA_REGISTRADA', 'CAJA_DIFERENCIA_APROBADA', 'CAJA_SESION_CERRADA'))
      = array['CAJA_DIFERENCIA_REGISTRADA', 'CAJA_DIFERENCIA_APROBADA', 'CAJA_SESION_CERRADA'], null);
  perform pg_temp.ok('C5.2 la aprobación guarda ambos motivos, la diferencia, el umbral y al propietario como actor',
    (select payload->>'motivo_diferencia' from public.abc_eventos where operation_id = 'cfg2-c1-dec-08' and event_type = 'CAJA_DIFERENCIA_APROBADA') = 'Se entregó un cambio de 20 euros de más'
    and (select payload->>'motivo_decision' from public.abc_eventos where operation_id = 'cfg2-c1-dec-08' and event_type = 'CAJA_DIFERENCIA_APROBADA') = 'Revisado con el cajero y el ticket'
    and (select (payload->>'difference')::numeric from public.abc_eventos where operation_id = 'cfg2-c1-dec-08' and event_type = 'CAJA_DIFERENCIA_APROBADA') = -20
    and (select (payload->>'umbral')::numeric from public.abc_eventos where operation_id = 'cfg2-c1-dec-08' and event_type = 'CAJA_DIFERENCIA_APROBADA') = 5
    and (select actor_user_id from public.abc_eventos where operation_id = 'cfg2-c1-dec-08' and event_type = 'CAJA_DIFERENCIA_APROBADA') = k_prop::uuid
    and (select actor_user_id from public.abc_eventos where operation_id = 'cfg2-c1-reg-01' and event_type = 'CAJA_DIFERENCIA_REGISTRADA') = k_enc::uuid, null);
  perform pg_temp.ok('C5.3 los intentos rechazados no dejaron eventos de decisión (solo uno)',
    (select count(*) from public.abc_eventos where aggregate_id = v_s::text and event_type in ('CAJA_DIFERENCIA_APROBADA', 'CAJA_DIFERENCIA_RECHAZADA')) = 1, null);
end
$t$;
-- ==== FIN CHUNK ====

-- ==== CHUNK: rechazo_reapertura ====
-- D. Diferencia rechazada por el propietario: bloquea ese cierre; hay que reabrir y recontar.
do $t$
declare
  k_e    constant text := 'CFG-EMP-T';
  k_loc  constant text := 'CFG-L3';
  k_prop constant text := '16c79749-a206-47d9-8d56-fbc7a4a49eb7';
  k_enc  constant text := '5003adca-2e30-477e-8afd-ffb3037b034e';
  k_caj  constant text := 'eb0bca7b-b366-4d72-80e1-0b02e9bdd666';
  v jsonb; v_s uuid; v_t uuid; x jsonb;
begin
  perform pg_temp.cfg_aj('D0.1 umbral del local en 5', k_prop, 'cfg2-d-um-0001', k_loc, 'caja_diferencia_umbral', '5'::jsonb, 'prueba');
  x := pg_temp.sesion_prov('cfg2-d1', k_caj, k_loc, 100, 70);
  v_s := (x->>'s')::uuid; v_t := (x->>'t')::uuid;

  perform pg_temp.f_reg('D1.1 el Cajero/a registra el motivo', k_caj, 'cfg2-d1-reg-01', k_loc, v_s, 'No sé qué pasó');
  v := pg_temp.f_dec('D1.2 el Propietario rechaza', k_prop, 'cfg2-d1-dec-01', k_loc, v_s, 'RECHAZAR', 'Vuelve a contar la caja');
  perform pg_temp.ok('D1.3 RECHAZADA y bloqueado', v->>'estado' = 'RECHAZADA' and v->'bloqueos' = '["DIFERENCIA_RECHAZADA"]'::jsonb, v);
  perform pg_temp.f_fin('D1.4 no se puede finalizar un cierre rechazado', k_caj, 'cfg2-d1-fin-01', k_loc, v_s, v_t, 'DIFERENCIA_RECHAZADA');
  perform pg_temp.f_reg('D1.5 ni cambiar el motivo para esquivar el rechazo', k_caj, 'cfg2-d1-reg-02', k_loc, v_s, 'ahora sí lo sé', 'diferencia_caja_ya_decidida');
  perform pg_temp.ok('D1.6 evento de rechazo con ambos motivos y el Propietario como actor',
    (select payload->>'motivo_decision' from public.abc_eventos where operation_id = 'cfg2-d1-dec-01' and event_type = 'CAJA_DIFERENCIA_RECHAZADA') = 'Vuelve a contar la caja'
    and (select payload->>'motivo_diferencia' from public.abc_eventos where operation_id = 'cfg2-d1-dec-01' and event_type = 'CAJA_DIFERENCIA_RECHAZADA') = 'No sé qué pasó'
    and (select actor_user_id from public.abc_eventos where operation_id = 'cfg2-d1-dec-01' and event_type = 'CAJA_DIFERENCIA_RECHAZADA') = k_prop::uuid, null);

  v := pg_temp.f_reabrir('D2.1 se reabre el cierre provisional (función de C04)', k_prop, 'cfg2-d1-reab-01', k_loc, v_s, v_t, 'Recontar la caja por el rechazo');
  perform pg_temp.ok('D2.2 la sesión vuelve a ABIERTA', v->>'estado' = 'ABIERTA', v);
  perform pg_temp.f_ini('D2.3 nuevo cierre: inicia', k_caj, 'cfg2-d1-ini-02', k_loc, v_s, v_t);
  v := pg_temp.f_prov('D2.4 nuevo cierre: contado 100 (sin diferencia)', k_caj, 'cfg2-d1-prov-02', k_loc, v_s, v_t, 100);
  perform pg_temp.ok('D2.5 diferencia 0', (v->>'difference')::numeric = 0, v);
  v := pg_temp.f_obt('D2.6 sin diferencia no hay nada que tratar', k_caj, k_loc, v_s);
  perform pg_temp.ok('D2.7 diferencia 0, sin bloqueos y sin registro (el rechazo era del cierre cancelado)',
    (v->>'difference')::numeric = 0 and v->'bloqueos' = '[]'::jsonb and v->'registro' = 'null'::jsonb and not (v->>'requiere_aprobacion')::boolean, v);
  perform pg_temp.f_reg('D2.8 registrar un motivo sin diferencia no procede', k_caj, 'cfg2-d1-reg-03', k_loc, v_s, 'nada', 'diferencia_caja_inexistente');
  v := pg_temp.f_fin('D2.9 finaliza sin motivo ni aprobación', k_caj, 'cfg2-d1-fin-02', k_loc, v_s, v_t);
  perform pg_temp.ok('D2.10 cerrada definitivamente con diferencia 0', v->>'estado' = 'CERRADA_FINAL' and (v->>'difference')::numeric = 0, v);
  perform pg_temp.ok('D2.11 la fila del cierre cancelado se conserva como RECHAZADA (historia) y no hay otra',
    (select count(*) from public.caja_cierre_diferencias where session_id = v_s) = 1
    and (select d.estado from public.caja_cierre_diferencias d where d.session_id = v_s) = 'RECHAZADA'
    and (select c.estado from public.caja_cierres c join public.caja_cierre_diferencias d on d.cierre_id = c.id where d.session_id = v_s) = 'CANCELADO', null);
end
$t$;
-- ==== FIN CHUNK ====

-- ==== CHUNK: umbral_y_cambios ====
-- E. El umbral manda en el momento del cierre; si la diferencia cambia tras registrarla, hay que registrarla de nuevo.
do $t$
declare
  k_e    constant text := 'CFG-EMP-T';
  k_loc  constant text := 'CFG-L4';
  k_prop constant text := '16c79749-a206-47d9-8d56-fbc7a4a49eb7';
  k_enc  constant text := '5003adca-2e30-477e-8afd-ffb3037b034e';
  k_caj  constant text := 'eb0bca7b-b366-4d72-80e1-0b02e9bdd666';
  v jsonb; v_s uuid; v_t uuid; v_c uuid; x jsonb;
begin
  perform pg_temp.cfg_aj('E0.1 umbral del local en 5', k_prop, 'cfg2-e-um-0001', k_loc, 'caja_diferencia_umbral', '5'::jsonb, 'prueba');

  -- Un sobrante también es una diferencia (importe absoluto) y el umbral se evalúa cuando se cierra.
  x := pg_temp.sesion_prov('cfg2-e1', k_caj, k_loc, 100, 110);
  v_s := (x->>'s')::uuid; v_t := (x->>'t')::uuid;
  v := pg_temp.f_reg('E1.1 sobrante de 10: se registra el motivo', k_caj, 'cfg2-e1-reg-01', k_loc, v_s, 'Un cliente dejó propina en la caja');
  perform pg_temp.ok('E1.2 diferencia +10, requiere aprobación (sobre 5)',
    (v->>'difference')::numeric = 10 and (v->>'requiere_aprobacion')::boolean and v->'bloqueos' = '["DIFERENCIA_PENDIENTE_APROBACION"]'::jsonb, v);
  perform pg_temp.cfg_aj('E1.3 el propietario sube el umbral a 20', k_prop, 'cfg2-e-um-0002', k_loc, 'caja_diferencia_umbral', '20'::jsonb, 'subir');
  v := pg_temp.f_obt('E1.4 el estado se reevalúa con el umbral nuevo', k_caj, k_loc, v_s);
  perform pg_temp.ok('E1.5 ya no requiere aprobación y no hay bloqueos', not (v->>'requiere_aprobacion')::boolean and (v->>'umbral')::numeric = 20 and v->'bloqueos' = '[]'::jsonb, v);
  perform pg_temp.f_dec('E1.6 decidir ahora ya no procede', k_prop, 'cfg2-e1-dec-01', k_loc, v_s, 'APROBAR', 'x', 'diferencia_caja_no_requiere_aprobacion');
  v := pg_temp.f_fin('E1.7 se puede finalizar con el umbral nuevo', k_caj, 'cfg2-e1-fin-01', k_loc, v_s, v_t);
  perform pg_temp.ok('E1.8 cerrada con diferencia +10', v->>'estado' = 'CERRADA_FINAL' and (v->>'difference')::numeric = 10, v);

  -- Una diferencia que cambia después de registrarla (defensa: lo normal es que no se pueda mover caja en el provisional).
  perform pg_temp.cfg_aj('E2.1 el umbral vuelve a 5', k_prop, 'cfg2-e-um-0003', k_loc, 'caja_diferencia_umbral', '5'::jsonb, 'bajar');
  x := pg_temp.sesion_prov('cfg2-e2', k_caj, k_loc, 100, 90);
  v_s := (x->>'s')::uuid; v_t := (x->>'t')::uuid; v_c := (x->>'c')::uuid;
  v := pg_temp.f_reg('E2.2 registra el motivo de -10', k_caj, 'cfg2-e2-reg-01', k_loc, v_s, 'Error al dar el cambio');
  perform pg_temp.ok('E2.3 pendiente de aprobación', v->'bloqueos' = '["DIFERENCIA_PENDIENTE_APROBACION"]'::jsonb and (v->>'difference')::numeric = -10, v);
  insert into public.caja_operaciones(
    operation_id,tipo,empresa_id,local_id,fecha,importe,efecto_efectivo,medio_pago,concepto,origen_tipo,origen_id,payload,
    actor_user_id,abc_command_id,caja_id,session_id,terminal_id,currency_code,operating_day,occurred_at,categoria)
  values (
    'cfg2.e2.extra','ENTRADA',k_e,k_loc,current_date,5,5,'EFECTIVO','Movimiento de prueba tras el provisional','CFG2_PRUEBA',v_s::text,
    '{}'::jsonb,k_prop::uuid,null,v_c,v_s,v_t,'EUR',current_date,now(),'INGRESO_MANUAL');
  v := pg_temp.f_obt('E2.4 el estado recalcula: el esperado pasa a 105 y la diferencia a -15', k_caj, k_loc, v_s);
  perform pg_temp.ok('E2.5 bloqueo DIFERENCIA_CAMBIADA', (v->>'difference')::numeric = -15 and (v->>'expected_amount')::numeric = 105 and v->'bloqueos' = '["DIFERENCIA_CAMBIADA"]'::jsonb, v);
  perform pg_temp.f_fin('E2.6 finalizar se rechaza', k_caj, 'cfg2-e2-fin-01', k_loc, v_s, v_t, 'DIFERENCIA_CAMBIADA');
  perform pg_temp.f_dec('E2.7 el propietario no puede aprobar una diferencia que ya cambió', k_prop, 'cfg2-e2-dec-01', k_loc, v_s, 'APROBAR', 'x', 'diferencia_caja_cambiada');
  v := pg_temp.f_reg('E2.8 se registra de nuevo con la diferencia actual', k_caj, 'cfg2-e2-reg-02', k_loc, v_s, 'Error al dar el cambio y un ingreso posterior');
  perform pg_temp.ok('E2.9 versión 2, diferencia -15, de nuevo pendiente', (v->>'version')::int = 2 and (v->>'difference')::numeric = -15 and v->'bloqueos' = '["DIFERENCIA_PENDIENTE_APROBACION"]'::jsonb, v);
  v := pg_temp.f_dec('E2.10 el propietario aprueba', k_prop, 'cfg2-e2-dec-02', k_loc, v_s, 'APROBAR', 'Conforme');
  v := pg_temp.f_fin('E2.11 y se puede finalizar', k_caj, 'cfg2-e2-fin-02', k_loc, v_s, v_t);
  perform pg_temp.ok('E2.12 cerrada con diferencia -15', v->>'estado' = 'CERRADA_FINAL' and (v->>'difference')::numeric = -15, v);
  perform pg_temp.ok('E2.13 dos eventos de registro (uno por cada versión del motivo)',
    (select count(*) from public.abc_eventos where aggregate_id = v_s::text and event_type = 'CAJA_DIFERENCIA_REGISTRADA') = 2, null);

  -- Solo lo que SUPERA el umbral exige aprobación: justo en el umbral no; un céntimo por encima, sí; con umbral 0, cualquiera.
  x := pg_temp.sesion_prov('cfg2-e3', k_caj, k_loc, 100, 95);
  v_s := (x->>'s')::uuid; v_t := (x->>'t')::uuid;
  v := pg_temp.f_reg('E3.1 diferencia de -5 con umbral 5 (justo en el umbral)', k_caj, 'cfg2-e3-reg-01', k_loc, v_s, 'Cinco euros de menos');
  perform pg_temp.ok('E3.2 no requiere aprobación y no hay bloqueos', not (v->>'requiere_aprobacion')::boolean and (v->>'difference')::numeric = -5 and v->'bloqueos' = '[]'::jsonb, v);
  v := pg_temp.f_fin('E3.3 se puede finalizar', k_caj, 'cfg2-e3-fin-01', k_loc, v_s, v_t);
  perform pg_temp.ok('E3.4 cerrada con diferencia -5', v->>'estado' = 'CERRADA_FINAL', v);

  x := pg_temp.sesion_prov('cfg2-e4', k_caj, k_loc, 100, 94.99);
  v_s := (x->>'s')::uuid; v_t := (x->>'t')::uuid;
  v := pg_temp.f_reg('E4.1 diferencia de -5,01 con umbral 5 (un céntimo por encima)', k_caj, 'cfg2-e4-reg-01', k_loc, v_s, 'Cinco euros y un céntimo');
  perform pg_temp.ok('E4.2 requiere aprobación y queda pendiente', (v->>'requiere_aprobacion')::boolean and (v->>'difference')::numeric = -5.01 and v->'bloqueos' = '["DIFERENCIA_PENDIENTE_APROBACION"]'::jsonb, v);
  perform pg_temp.f_fin('E4.3 no se puede finalizar', k_caj, 'cfg2-e4-fin-01', k_loc, v_s, v_t, 'DIFERENCIA_PENDIENTE_APROBACION');

  perform pg_temp.cfg_aj('E5.1 umbral 0 (el valor por defecto): cualquier diferencia exige aprobación', k_prop, 'cfg2-e-um-0004', k_loc, 'caja_diferencia_umbral', '0'::jsonb, 'estricto');
  x := pg_temp.sesion_prov('cfg2-e5', k_caj, k_loc, 100, 99.99);
  v_s := (x->>'s')::uuid;
  v := pg_temp.f_reg('E5.2 diferencia de -0,01', k_caj, 'cfg2-e5-reg-01', k_loc, v_s, 'Un céntimo');
  perform pg_temp.ok('E5.3 requiere aprobación', (v->>'requiere_aprobacion')::boolean and (v->>'difference')::numeric = -0.01 and v->'bloqueos' = '["DIFERENCIA_PENDIENTE_APROBACION"]'::jsonb, v);
end
$t$;
-- ==== FIN CHUNK ====

-- ==== CHUNK: guarda_y_aislamiento ====
-- F. La guarda vale para cualquier camino; permisos de lectura y aislamiento entre locales y empresas.
do $t$
declare
  k_e    constant text := 'CFG-EMP-T';
  k_loc  constant text := 'CFG-L5';
  k_loc2 constant text := 'CFG-L6';
  k_prop constant text := '16c79749-a206-47d9-8d56-fbc7a4a49eb7';
  k_enc  constant text := '5003adca-2e30-477e-8afd-ffb3037b034e';
  k_caj  constant text := 'eb0bca7b-b366-4d72-80e1-0b02e9bdd666';
  k_otro constant text := '73967f0c-3474-443d-ad83-9f20b94204c3';
  v jsonb; v_s uuid; v_t uuid; v_s2 uuid; v_cierre uuid; x jsonb; y jsonb;
begin
  perform pg_temp.cfg_aj('F0.1 umbral del local en 5', k_prop, 'cfg2-f-um-0001', k_loc, 'caja_diferencia_umbral', '5'::jsonb, 'prueba');
  x := pg_temp.sesion_prov('cfg2-f1', k_caj, k_loc, 100, 60);
  v_s := (x->>'s')::uuid; v_t := (x->>'t')::uuid;

  perform pg_temp.falla('F1.1 el paso directo a CERRADA_FINAL con diferencia sin motivo se rechaza (cualquier camino)',
    format('update public.caja_sesiones set estado = %L, cerrada_at = now() where id = %L', 'CERRADA_FINAL', v_s), 'cierre_definitivo_diferencia_pendiente');
  perform pg_temp.ok('F1.2 la sesión no cambió', (select estado from public.caja_sesiones where id = v_s) = 'CIERRE_PROVISIONAL', null);
  perform pg_temp.f_reg('F1.3 se registra el motivo', k_caj, 'cfg2-f1-reg-01', k_loc, v_s, 'Diferencia grande');
  perform pg_temp.falla('F1.4 con el motivo pero sin aprobación, el paso directo se rechaza (pendiente de aprobación)',
    format('update public.caja_sesiones set estado = %L, cerrada_at = now() where id = %L', 'CERRADA_FINAL', v_s), 'DIFERENCIA_PENDIENTE_APROBACION');
  perform pg_temp.f_dec('F1.5 el propietario aprueba', k_prop, 'cfg2-f1-dec-01', k_loc, v_s, 'APROBAR', 'Conforme');
  perform pg_temp.f_fin('F1.6 y finaliza el cajero', k_caj, 'cfg2-f1-fin-01', k_loc, v_s, v_t);

  -- La guarda de C04 sigue mandando sobre las demás transiciones.
  y := pg_temp.sesion_prov('cfg2-f2', k_caj, k_loc, 50, 50);
  v_s2 := (y->>'s')::uuid;
  perform pg_temp.f_reabrir('F2.1 se reabre para probar la guarda de C04', k_prop, 'cfg2-f2-reab-01', k_loc, v_s2, (y->>'t')::uuid, 'prueba');
  perform pg_temp.falla('F2.2 de ABIERTA no se pasa a CERRADA_FINAL (guarda de C04)',
    format('update public.caja_sesiones set estado = %L, cerrada_at = now() where id = %L', 'CERRADA_FINAL', v_s2), 'cierre_definitivo_requiere_provisional');

  -- Lectura: solo quien opera la caja del local.
  y := pg_temp.sesion_prov('cfg2-f3', k_caj, k_loc2, 100, 90);
  v := pg_temp.f_obt('F3.1 el Encargado del local lee', k_enc, k_loc2, (y->>'s')::uuid);
  perform pg_temp.ok('F3.1b sin umbral configurado rige el valor por defecto 0: una diferencia de -10 exige aprobación',
    (v->>'umbral')::numeric = 0 and (v->>'difference')::numeric = -10 and (v->>'requiere_aprobacion')::boolean, v);
  perform pg_temp.f_obt('F3.2 el Propietario lee', k_prop, k_loc2, (y->>'s')::uuid);
  perform pg_temp.f_obt('F3.3 el Propietario de otra empresa no puede leer', k_otro, k_loc2, (y->>'s')::uuid, 'abc_caja_no_autorizado');
  perform pg_temp.paso('F3.4 anon no puede ejecutar la lectura', null, format('select public.abc_obtener_diferencia_caja(%L,%L,%L::uuid)', k_e, k_loc2, (y->>'s')), 'permission denied', 'anon');
  perform pg_temp.paso('F3.5 service_role no puede ejecutar la lectura', null, format('select public.abc_obtener_diferencia_caja(%L,%L,%L::uuid)', k_e, k_loc2, (y->>'s')), 'permission denied', 'service_role');
  v := pg_temp.f_obt('F3.6 una sesión de otro local, pedida con el local del usuario, no devuelve nada del otro', k_enc, k_loc, (y->>'s')::uuid);
  perform pg_temp.ok('F3.7 sin cierre ni diferencia ni estado de sesión', v->'cierre_id' = 'null'::jsonb and v->'session_estado' = 'null'::jsonb, v);

  -- Aislamiento: sin membresía activa en ese local, el Encargado no actúa en él.
  update public.membresias_usuario set activo = false where user_id = k_enc::uuid and local_id = k_loc2;
  perform pg_temp.f_reg('F4.1 el Encargado sin acceso a ese local no puede registrar', k_enc, 'cfg2-f3-reg-01', k_loc2, (y->>'s')::uuid, 'x', 'abc_caja_no_autorizado');
  perform pg_temp.f_obt('F4.2 ni leer', k_enc, k_loc2, (y->>'s')::uuid, 'abc_caja_no_autorizado');
  perform pg_temp.f_reg('F4.3 registrar sobre una sesión que no existe', k_caj, 'cfg2-f3-reg-02', k_loc2, gen_random_uuid(), 'x', 'cierre_provisional_no_encontrado');
  perform pg_temp.f_reg('F4.4 registrar sin sesión', k_caj, 'cfg2-f3-reg-03', k_loc2, null, 'x', 'diferencia_caja_parametros_requeridos');
  perform pg_temp.f_dec('F4.5 decidir sobre una sesión sin registro', k_prop, 'cfg2-f3-dec-01', k_loc2, (y->>'s')::uuid, 'APROBAR', 'x', 'diferencia_caja_sin_registro');

  -- Cada diferencia es de su cierre: el mismo propietario ve solo las de su empresa.
  perform pg_temp.ok('F5.1 las filas de diferencia pertenecen a la empresa de la prueba',
    (select count(*) from public.caja_cierre_diferencias where empresa_id <> k_e) = 0, null);
end
$t$;
-- ==== FIN CHUNK ====
