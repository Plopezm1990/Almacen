-- Capa de configuración, PIEZA 1 · contrato vivo del corte del día operativo, los ajustes por local y el
-- límite de cajas abiertas.
--
-- Se ejecuta DESPUÉS de la migración 20261002190000_abc_config_pieza1_dia_cajas.sql (o junto con ella en un
-- ensayo en seco), dentro de una transacción que termina en ROLLBACK:
--
--   begin; [migración]; <este archivo>; select <resumen de la.log>; rollback;
--
-- No depende de los datos de QA: crea su propia empresa de prueba (CFG-EMP-T) y locales (CFG-L1…) dentro de
-- la transacción. Solo necesita que existan en auth.users cuatro identificadores de usuario (en QA ya
-- existen; en la réplica local los crea tests/cfg/local-fixture.sql). Los actores se suplantan a nivel de base
-- de datos (set local role + claims JWT). Todo se revierte con el ROLLBACK.

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

-- abc_configurar_dia_operativo(operation_id, empresa, local, zona, corte, vigente_desde, motivo)
create function pg_temp.cfg_dia(p_nombre text, p_uid text, p_op text, p_local text, p_tz text, p_corte text, p_desde timestamptz, p_motivo text, p_espera text default null, p_rol text default 'authenticated') returns jsonb language plpgsql as $f$
begin
  return pg_temp.paso(p_nombre, p_uid,
    format('select public.abc_configurar_dia_operativo(%L,%L,%L,%L,%L::time,%L::timestamptz,%L)', p_op, 'CFG-EMP-T', p_local, p_tz, p_corte, p_desde::text, p_motivo),
    p_espera, p_rol);
end $f$;

-- abc_configurar_ajuste(operation_id, empresa, local, clave, valor, motivo)
create function pg_temp.cfg_aj(p_nombre text, p_uid text, p_op text, p_local text, p_clave text, p_valor jsonb, p_motivo text, p_espera text default null, p_rol text default 'authenticated') returns jsonb language plpgsql as $f$
begin
  return pg_temp.paso(p_nombre, p_uid,
    format('select public.abc_configurar_ajuste(%L,%L,%L,%L,%L::jsonb,%L)', p_op, 'CFG-EMP-T', p_local, p_clave, p_valor::text, p_motivo),
    p_espera, p_rol);
end $f$;

-- abc_abrir_sesion_caja(...): el responsable es siempre el propietario de la empresa de prueba.
create function pg_temp.cfg_abrir(p_nombre text, p_uid text, p_op text, p_local text, p_sesion uuid, p_caja uuid, p_term uuid, p_espera text default null, p_rol text default 'authenticated') returns jsonb language plpgsql as $f$
begin
  return pg_temp.paso(p_nombre, p_uid,
    format('select public.abc_abrir_sesion_caja(%L,%L,%L,%L::uuid,%L::uuid,%L::uuid,%L::uuid,%L,%L::numeric,%L::date)',
      p_op, 'CFG-EMP-T', p_local, p_sesion, p_caja, '16c79749-a206-47d9-8d56-fbc7a4a49eb7', p_term, 'EUR', 0, current_date),
    p_espera, p_rol);
end $f$;

create function pg_temp.reglas_ajenas() returns text language sql as $f$
  select md5(coalesce(string_agg(id::text || ':' || cutoff_time::text || ':' || coalesce(vigente_hasta::text, ''), ',' order by id), ''))
    from private.abc_operating_day_reglas where empresa_id not in ('CFG-EMP-T', 'CFG-EMP-U')
$f$;

create function pg_temp.activas(p_local text) returns integer language sql as $f$
  select count(*)::integer from public.caja_sesiones
   where empresa_id = 'CFG-EMP-T' and local_id = p_local
     and estado in ('PREPARANDO_APERTURA', 'ABIERTA', 'EN_CIERRE', 'CIERRE_PROVISIONAL')
$f$;

do $t$
declare
  k_e    constant text := 'CFG-EMP-T';
  k_eu   constant text := 'CFG-EMP-U';
  k_l1   constant text := 'CFG-L1';
  k_l2   constant text := 'CFG-L2';
  k_l3   constant text := 'CFG-L3';
  k_lc   constant text := 'CFG-LC';
  k_prop constant text := '16c79749-a206-47d9-8d56-fbc7a4a49eb7';  -- Propietario de la empresa de prueba (todos los locales)
  k_enc  constant text := '5003adca-2e30-477e-8afd-ffb3037b034e';  -- Encargado del local L1 (en esta prueba)
  k_caj  constant text := 'eb0bca7b-b366-4d72-80e1-0b02e9bdd666';  -- Cajero/a del local L1 (en esta prueba)
  k_otro constant text := '73967f0c-3474-443d-ad83-9f20b94204c3';  -- Propietario de OTRA empresa
  v jsonb; v2 jsonb; v_primero jsonb; v_desde timestamptz; x1 timestamptz; x2 timestamptz; v_cnt integer; v_txt text;
  v_ajenas text;
  cajas uuid[]; terms uuid[]; ses uuid[] := array[]::uuid[]; s uuid; i integer; v_sesion uuid;
begin
  -- ====================================================================================================
  -- 0. Datos de la prueba (propios, dentro de la transacción).
  -- ====================================================================================================
  insert into public.empresas(id, nombre, activo) values (k_e, 'Empresa prueba capa de configuración', true), (k_eu, 'Otra empresa prueba', true);
  insert into public.locales(id, empresa_id, nombre, activo) values
    (k_l1, k_e, 'L1', true), (k_l2, k_e, 'L2', true), (k_l3, k_e, 'L3 sin regla', true), (k_lc, k_e, 'LC cajas', true),
    ('CFG-LU', k_eu, 'LU', true);
  insert into public.membresias_usuario(user_id, empresa_id, local_id, todos_locales, rol, activo) values
    (k_prop::uuid, k_e, null, true, 'Propietario', true),
    (k_enc::uuid, k_e, k_l1, false, 'Encargado', true),
    (k_caj::uuid, k_e, k_l1, false, 'Cajero/a', true),
    (k_otro::uuid, k_eu, null, true, 'Propietario', true);
  insert into private.abc_operating_day_reglas(empresa_id, local_id, version, timezone_name, cutoff_time, vigente_desde, vigente_hasta, motivo) values
    (k_e, k_l1, 1, 'Europe/Madrid', time '04:00', timestamptz '2026-09-01 00:00:00+00', null, 'base del contrato'),
    (k_e, k_l2, 1, 'Europe/Madrid', time '04:00', timestamptz '2026-09-01 00:00:00+00', null, 'base del contrato');
  v_ajenas := pg_temp.reglas_ajenas();

  -- ====================================================================================================
  -- A. Corte del día operativo.
  -- ====================================================================================================
  perform pg_temp.cfg_dia('A1.1 el Encargado del local no puede', k_enc, 'cfg1-dia-perm-01', k_l1, null, '00:00', null, 'x', 'abc_config_no_autorizado');
  perform pg_temp.cfg_dia('A1.2 el Cajero/a del local no puede', k_caj, 'cfg1-dia-perm-02', k_l1, null, '00:00', null, 'x', 'abc_config_no_autorizado');
  perform pg_temp.cfg_dia('A1.3 el Propietario de otra empresa no puede', k_otro, 'cfg1-dia-perm-03', k_l1, null, '00:00', null, 'x', 'abc_config_no_autorizado');
  perform pg_temp.cfg_dia('A1.4 anon no puede ejecutar la RPC', null, 'cfg1-dia-perm-04', k_l1, null, '00:00', null, 'x', 'permission denied', 'anon');
  perform pg_temp.cfg_dia('A1.5 service_role no puede ejecutar la RPC', null, 'cfg1-dia-perm-05', k_l1, null, '00:00', null, 'x', 'permission denied', 'service_role');
  select count(*) into v_cnt from private.abc_operating_day_reglas where empresa_id = k_e and local_id = k_l1;
  perform pg_temp.ok('A1.6 los rechazos no cambiaron nada (una regla de 04:00)', v_cnt = 1 and (select cutoff_time from private.abc_operating_day_reglas where empresa_id = k_e and local_id = k_l1) = time '04:00', to_jsonb(v_cnt));

  perform pg_temp.cfg_dia('A2.1 sin motivo', k_prop, 'cfg1-dia-val-01', k_l1, null, '00:00', null, null, 'dia_operativo_motivo_requerido');
  perform pg_temp.cfg_dia('A2.2 zona horaria inexistente', k_prop, 'cfg1-dia-val-02', k_l1, 'Marte/Fobos', '00:00', null, 'x', 'dia_operativo_timezone_invalida');
  perform pg_temp.cfg_dia('A2.3 corte a las 13:00 (fuera de 00:00-12:00)', k_prop, 'cfg1-dia-val-03', k_l1, null, '13:00', null, 'x', 'dia_operativo_corte_fuera_de_rango');
  perform pg_temp.cfg_dia('A2.4 local inexistente', k_prop, 'cfg1-dia-val-04', 'CFG-NO-EXISTE', null, '00:00', null, 'x', 'dia_operativo_local_no_disponible');

  v := pg_temp.cfg_dia('A3.1 el Propietario cambia el corte de 04:00 a 00:00', k_prop, 'cfg1-dia-0001', k_l1, null, '00:00', null, 'D06: corte 00:00 por defecto');
  v_desde := (v->>'vigente_desde')::timestamptz;
  perform pg_temp.ok('A3.2 resultado: cambio, versión 2, 00:00 en Europe/Madrid, rige en el futuro',
    (v->>'cambio')::boolean and (v->>'version')::int = 2 and v->>'cutoff_time' = '00:00:00' and v->>'timezone_name' = 'Europe/Madrid' and v_desde > now(), v);
  perform pg_temp.ok('A3.3 el cambio rige desde una medianoche local',
    (v_desde at time zone 'Europe/Madrid')::time = time '00:00', to_jsonb(v_desde::text));
  select count(*) into v_cnt from private.abc_operating_day_reglas where empresa_id = k_e and local_id = k_l1;
  perform pg_temp.ok('A3.4 dos reglas: la antigua se cierra donde empieza la nueva y solo hay una vigente',
    v_cnt = 2
    and (select vigente_hasta from private.abc_operating_day_reglas where empresa_id = k_e and local_id = k_l1 and version = 1) = v_desde
    and (select count(*) from private.abc_operating_day_reglas where empresa_id = k_e and local_id = k_l1 and vigente_hasta is null) = 1
    and (select cutoff_time from private.abc_operating_day_reglas where empresa_id = k_e and local_id = k_l1 and vigente_hasta is null) = time '00:00'
    and (select created_by from private.abc_operating_day_reglas where empresa_id = k_e and local_id = k_l1 and version = 2) = k_prop::uuid, to_jsonb(v_cnt));

  x1 := v_desde - interval '23 hours';
  x2 := v_desde + interval '1 hour';
  perform pg_temp.ok('A4.1 antes del cambio sigue mandando la regla de 04:00 (la 01:00 local pertenece al día anterior)',
    private.abc_resolver_operating_day_contexto(k_e, k_l1, x1)->>'operating_day' = ((x1 at time zone 'Europe/Madrid')::date - 1)::text
    and private.abc_resolver_operating_day_contexto(k_e, k_l1, x1)->>'cutoff_rule_version' = '1', private.abc_resolver_operating_day_contexto(k_e, k_l1, x1));
  perform pg_temp.ok('A4.2 después del cambio manda la regla de 00:00 (la 01:00 local ya es del día natural)',
    private.abc_resolver_operating_day_contexto(k_e, k_l1, x2)->>'operating_day' = (x2 at time zone 'Europe/Madrid')::date::text
    and private.abc_resolver_operating_day_contexto(k_e, k_l1, x2)->>'cutoff_rule_version' = '2', private.abc_resolver_operating_day_contexto(k_e, k_l1, x2));

  v2 := pg_temp.cfg_dia('A5.1 replay del mismo operation_id', k_prop, 'cfg1-dia-0001', k_l1, null, '00:00', null, 'D06: corte 00:00 por defecto');
  perform pg_temp.ok('A5.2 el replay devuelve el resultado original', v2 = v, v2);
  perform pg_temp.cfg_dia('A5.3 mismo operation_id con otro contenido: conflicto', k_prop, 'cfg1-dia-0001', k_l1, null, '03:00', null, 'otro', 'operation_id_conflict');
  v2 := pg_temp.cfg_dia('A5.4 otro operation_id con los mismos valores', k_prop, 'cfg1-dia-0002', k_l1, null, '00:00', null, 'repetir');
  select count(*) into v_cnt from private.abc_operating_day_reglas where empresa_id = k_e and local_id = k_l1;
  perform pg_temp.ok('A5.5 sin cambio: no se crea otra versión', not (v2->>'cambio')::boolean and (v2->>'version')::int = 2 and v_cnt = 2, v2);

  perform pg_temp.cfg_dia('A6.1 vigencia en el pasado', k_prop, 'cfg1-dia-0003', k_l1, null, '03:00', now() - interval '1 hour', 'x', 'dia_operativo_vigencia_pasada');
  perform pg_temp.cfg_dia('A6.2 vigencia anterior o igual a la de la regla vigente', k_prop, 'cfg1-dia-0004', k_l1, null, '02:00', v_desde, 'x', 'dia_operativo_vigencia_incoherente');

  select count(*) into v_cnt from public.abc_eventos
   where empresa_id = k_e and local_id = k_l1 and operation_id = 'cfg1-dia-0001' and event_type = 'DIA_OPERATIVO_REGLA_CAMBIADA' and actor_user_id = k_prop::uuid;
  perform pg_temp.ok('A7.1 queda un evento de auditoría con el cambio',
    v_cnt = 1 and (select payload->'nueva'->>'cutoff_time' from public.abc_eventos where operation_id = 'cfg1-dia-0001' and event_type = 'DIA_OPERATIVO_REGLA_CAMBIADA') = '00:00:00'
    and (select payload->'anterior'->>'cutoff_time' from public.abc_eventos where operation_id = 'cfg1-dia-0001' and event_type = 'DIA_OPERATIVO_REGLA_CAMBIADA') = '04:00:00', to_jsonb(v_cnt));

  perform pg_temp.ok('A8.1 otro local de la misma empresa y las reglas de otras empresas no cambian',
    (select cutoff_time from private.abc_operating_day_reglas where empresa_id = k_e and local_id = k_l2) = time '04:00'
    and (select count(*) from private.abc_operating_day_reglas where empresa_id = k_e and local_id = k_l2) = 1
    and pg_temp.reglas_ajenas() = v_ajenas, null);

  v := pg_temp.cfg_dia('A9.1 primera regla de un local sin regla, todo por defecto', k_prop, 'cfg1-dia-0010', k_l3, null, null, null, 'alta del local');
  perform pg_temp.ok('A9.2 versión 1, Europe/Madrid, 00:00, rige desde 2000-01-01',
    (v->>'version')::int = 1 and v->>'timezone_name' = 'Europe/Madrid' and v->>'cutoff_time' = '00:00:00'
    and (v->>'vigente_desde')::timestamptz = timestamptz '2000-01-01 00:00:00+00', v);
  perform pg_temp.ok('A9.3 el local ya puede resolver su día operativo',
    private.abc_resolver_operating_day_contexto(k_e, k_l3, now())->>'cutoff_time' = '00:00:00', private.abc_resolver_operating_day_contexto(k_e, k_l3, now()));
  begin
    perform private.abc_resolver_operating_day_contexto(k_e, 'CFG-LC', now());
    perform pg_temp.ok('A9.4 un local sin regla sigue fallando de forma explícita (A11)', false, null);
  exception when others then
    perform pg_temp.ok('A9.4 un local sin regla sigue fallando de forma explícita (A11)', sqlerrm like '%operating_day_configuracion_ausente%', to_jsonb(sqlerrm));
  end;

  -- ====================================================================================================
  -- B. Ajustes por local y límite de cajas abiertas.
  -- ====================================================================================================
  v := pg_temp.paso('B0.1 el Propietario lee los ajustes de un local sin configurar', k_prop,
    format('select public.abc_obtener_ajustes(%L,%L)', k_e, k_lc));
  perform pg_temp.ok('B0.2 cajas_abiertas_max = 10 por defecto, sin regla de día',
    (v->'cajas_abiertas_max'->>'valor')::int = 10 and v->'cajas_abiertas_max'->>'origen' = 'defecto' and v->'dia_operativo' = 'null'::jsonb, v);
  v := pg_temp.paso('B0.3 el Encargado del local L1 puede leer', k_enc, format('select public.abc_obtener_ajustes(%L,%L)', k_e, k_l1));
  perform pg_temp.ok('B0.4 y ve la regla del día vigente de su local', v->'dia_operativo'->>'cutoff_time' = '00:00:00', v);
  perform pg_temp.paso('B0.5 el Propietario de otra empresa no puede leer', k_otro, format('select public.abc_obtener_ajustes(%L,%L)', k_e, k_l1), 'abc_config_no_autorizado');

  perform pg_temp.cfg_aj('B1.1 el Encargado no puede configurar', k_enc, 'cfg1-aj-perm-01', k_l1, 'cajas_abiertas_max', '5'::jsonb, 'x', 'abc_config_no_autorizado');
  perform pg_temp.cfg_aj('B1.2 el Cajero/a no puede configurar', k_caj, 'cfg1-aj-perm-02', k_l1, 'cajas_abiertas_max', '5'::jsonb, 'x', 'abc_config_no_autorizado');
  perform pg_temp.cfg_aj('B1.3 el Propietario de otra empresa no puede', k_otro, 'cfg1-aj-perm-03', k_l1, 'cajas_abiertas_max', '5'::jsonb, 'x', 'abc_config_no_autorizado');
  perform pg_temp.cfg_aj('B1.4 anon no puede', null, 'cfg1-aj-perm-04', k_l1, 'cajas_abiertas_max', '5'::jsonb, 'x', 'permission denied', 'anon');
  perform pg_temp.cfg_aj('B1.5 service_role no puede', null, 'cfg1-aj-perm-05', k_l1, 'cajas_abiertas_max', '5'::jsonb, 'x', 'permission denied', 'service_role');

  perform pg_temp.cfg_aj('B2.1 valor 0', k_prop, 'cfg1-aj-val-01', k_lc, 'cajas_abiertas_max', '0'::jsonb, 'x', 'ajuste_valor_fuera_de_rango');
  perform pg_temp.cfg_aj('B2.2 valor 11 (el máximo del producto es 10)', k_prop, 'cfg1-aj-val-02', k_lc, 'cajas_abiertas_max', '11'::jsonb, 'x', 'ajuste_valor_fuera_de_rango');
  perform pg_temp.cfg_aj('B2.3 valor 2,5', k_prop, 'cfg1-aj-val-03', k_lc, 'cajas_abiertas_max', '2.5'::jsonb, 'x', 'ajuste_valor_fuera_de_rango');
  perform pg_temp.cfg_aj('B2.4 valor escrito como texto', k_prop, 'cfg1-aj-val-04', k_lc, 'cajas_abiertas_max', '"5"'::jsonb, 'x', 'ajuste_valor_invalido');
  perform pg_temp.cfg_aj('B2.5 clave desconocida', k_prop, 'cfg1-aj-val-05', k_lc, 'otra_clave', '5'::jsonb, 'x', 'ajuste_clave_invalida');
  perform pg_temp.cfg_aj('B2.6 sin motivo', k_prop, 'cfg1-aj-val-06', k_lc, 'cajas_abiertas_max', '5'::jsonb, null, 'ajuste_motivo_requerido');

  v := pg_temp.cfg_aj('B3.1 el Propietario fija 2 cajas en el local LC', k_prop, 'cfg1-aj-0001', k_lc, 'cajas_abiertas_max', '2'::jsonb, 'prueba del límite');
  v_primero := v;
  perform pg_temp.ok('B3.2 cambio, versión 1, origen local', (v->>'cambio')::boolean and (v->>'version')::int = 1 and (v->>'valor')::int = 2 and v->>'origen' = 'local', v);
  v := pg_temp.paso('B3.3 la lectura refleja el valor', k_prop, format('select public.abc_obtener_ajustes(%L,%L)', k_e, k_lc));
  perform pg_temp.ok('B3.4 cajas_abiertas_max = 2, origen local', (v->'cajas_abiertas_max'->>'valor')::int = 2 and v->'cajas_abiertas_max'->>'origen' = 'local', v);
  perform pg_temp.paso('B3.5 la tabla no se puede leer directamente', k_prop, 'select to_jsonb(count(*)) from public.abc_config_ajustes', 'permission denied');
  perform pg_temp.paso('B3.6 ni escribir directamente', k_prop,
    format('with z as (insert into public.abc_config_ajustes(empresa_id,local_id,clave,valor,motivo) values (%L,%L,%L,%L::jsonb,%L) returning 1) select to_jsonb(1) from z', k_e, k_l1, 'cajas_abiertas_max', '1', 'x'), 'permission denied');
  v2 := pg_temp.cfg_aj('B3.7 replay del mismo operation_id', k_prop, 'cfg1-aj-0001', k_lc, 'cajas_abiertas_max', '2'::jsonb, 'prueba del límite');
  perform pg_temp.ok('B3.8 el replay devuelve el resultado original', v2 = v_primero, v2);
  perform pg_temp.cfg_aj('B3.9 mismo operation_id con otro contenido: conflicto', k_prop, 'cfg1-aj-0001', k_lc, 'cajas_abiertas_max', '3'::jsonb, 'otro', 'operation_id_conflict');
  v2 := pg_temp.cfg_aj('B3.10 mismo valor con otro operation_id', k_prop, 'cfg1-aj-0002', k_lc, 'cajas_abiertas_max', '2'::jsonb, 'repetir');
  perform pg_temp.ok('B3.11 sin cambio: la versión no sube', not (v2->>'cambio')::boolean and (v2->>'version')::int = 1, v2);

  -- Cajas y terminales de la prueba (los crea la propia transacción).
  insert into public.cajas_fisicas(empresa_id, local_id, nombre) select k_e, k_lc, 'C' || lpad(g::text, 2, '0') from generate_series(1, 25) g;
  insert into public.terminales_tpv(empresa_id, local_id, nombre) select k_e, k_lc, 'T' || lpad(g::text, 2, '0') from generate_series(1, 25) g;
  select array_agg(id order by nombre) into cajas from public.cajas_fisicas where empresa_id = k_e and local_id = k_lc;
  select array_agg(id order by nombre) into terms from public.terminales_tpv where empresa_id = k_e and local_id = k_lc;

  -- Límite 2: caben 2 sesiones, la tercera se rechaza.
  v_sesion := gen_random_uuid(); ses := array_append(ses, v_sesion);
  v := pg_temp.cfg_abrir('B4.1 abre la sesión 1 (límite 2)', k_prop, 'cfg1-ab-0001', k_lc, v_sesion, cajas[1], terms[1]);
  perform pg_temp.ok('B4.2 sesión 1 abierta', v->>'estado' = 'ABIERTA', v);
  v_sesion := gen_random_uuid(); ses := array_append(ses, v_sesion);
  v := pg_temp.cfg_abrir('B4.3 abre la sesión 2', k_prop, 'cfg1-ab-0002', k_lc, v_sesion, cajas[2], terms[2]);
  perform pg_temp.ok('B4.4 sesión 2 abierta', v->>'estado' = 'ABIERTA' and pg_temp.activas(k_lc) = 2, v);
  perform pg_temp.cfg_abrir('B4.5 la sesión 3 supera el límite', k_prop, 'cfg1-ab-0003', k_lc, gen_random_uuid(), cajas[3], terms[3], 'caja_limite_sesiones_alcanzado');
  perform pg_temp.ok('B4.6 la sesión rechazada no deja nada', pg_temp.activas(k_lc) = 2, to_jsonb(pg_temp.activas(k_lc)));
  perform pg_temp.cfg_abrir('B4.7 una caja ocupada sigue dando su error de siempre (antes que el límite)', k_prop, 'cfg1-ab-0004', k_lc, gen_random_uuid(), cajas[1], terms[3], 'caja_con_sesion_activa');
  perform pg_temp.cfg_abrir('B4.8 anon no puede abrir caja', null, 'cfg1-ab-0005', k_lc, gen_random_uuid(), cajas[3], terms[3], 'permission denied', 'anon');

  -- Subir el límite a 3 deja abrir la tercera; la cuarta se rechaza.
  v := pg_temp.cfg_aj('B5.1 el Propietario sube el límite a 3', k_prop, 'cfg1-aj-0003', k_lc, 'cajas_abiertas_max', '3'::jsonb, 'subir');
  perform pg_temp.ok('B5.1b cada cambio real sube la versión (2)', (v->>'version')::int = 2 and (v->>'valor')::int = 3, v);
  v_sesion := gen_random_uuid(); ses := array_append(ses, v_sesion);
  v := pg_temp.cfg_abrir('B5.2 ahora cabe la sesión 3', k_prop, 'cfg1-ab-0006', k_lc, v_sesion, cajas[3], terms[3]);
  perform pg_temp.cfg_abrir('B5.3 y la 4 se rechaza', k_prop, 'cfg1-ab-0007', k_lc, gen_random_uuid(), cajas[4], terms[4], 'caja_limite_sesiones_alcanzado');
  perform pg_temp.ok('B5.4 tres sesiones activas', pg_temp.activas(k_lc) = 3, to_jsonb(pg_temp.activas(k_lc)));

  -- Bajar el límite no cierra lo que ya está abierto: solo bloquea aperturas nuevas.
  v := pg_temp.cfg_aj('B6.1 el Propietario baja el límite a 1 con 3 abiertas', k_prop, 'cfg1-aj-0004', k_lc, 'cajas_abiertas_max', '1'::jsonb, 'bajar');
  perform pg_temp.ok('B6.2 se permite (versión 3) y las sesiones abiertas siguen', (v->>'cambio')::boolean and (v->>'version')::int = 3 and pg_temp.activas(k_lc) = 3, v);
  perform pg_temp.cfg_abrir('B6.3 pero no se abre ninguna más', k_prop, 'cfg1-ab-0008', k_lc, gen_random_uuid(), cajas[4], terms[4], 'caja_limite_sesiones_alcanzado');
  -- Cada situación de «caja ocupada» cuenta por sí sola (las mismas que el índice «una sesión activa por caja»):
  -- con el límite en 1 y una única sesión en ese estado, no se abre otra.
  -- Se «cierran» pasándolas a APERTURA_CANCELADA (estado cerrado, sin cupo): el cierre definitivo real pasa por
  -- un guarda (C04: exige cierre provisional y sin bloqueos) que este contrato no necesita recorrer.
  update public.caja_sesiones set estado = 'APERTURA_CANCELADA', abierta_at = null, cerrada_at = now() where id in (ses[2], ses[3]);
  foreach v_txt in array array['EN_CIERRE', 'CIERRE_PROVISIONAL', 'PREPARANDO_APERTURA', 'ABIERTA'] loop
    update public.caja_sesiones
       set estado = v_txt,
           abierta_at = case when v_txt = 'PREPARANDO_APERTURA' then null else coalesce(abierta_at, now()) end,
           cerrada_at = null
     where id = ses[1];
    perform pg_temp.cfg_abrir('B6.4 con una sola sesión en ' || v_txt || ' no se abre otra (límite 1)', k_prop, 'cfg1-ab-e-' || v_txt, k_lc, gen_random_uuid(), cajas[4], terms[4], 'caja_limite_sesiones_alcanzado');
  end loop;
  perform pg_temp.ok('B6.5 queda una sola sesión activa (ABIERTA)', pg_temp.activas(k_lc) = 1, to_jsonb(pg_temp.activas(k_lc)));

  -- Cerrar sesiones libera cupo: dos sesiones ya cerradas, queda 1 activa.
  perform pg_temp.ok('B7.1 cerradas dos sesiones quedan 1 activa', pg_temp.activas(k_lc) = 1, to_jsonb(pg_temp.activas(k_lc)));
  v := pg_temp.cfg_aj('B7.2 límite 3 otra vez', k_prop, 'cfg1-aj-0005', k_lc, 'cajas_abiertas_max', '3'::jsonb, 'volver a 3');
  perform pg_temp.ok('B7.2b versión 4', (v->>'version')::int = 4 and (v->>'valor')::int = 3, v);
  v_sesion := gen_random_uuid(); ses := array_append(ses, v_sesion);
  perform pg_temp.cfg_abrir('B7.3 con cupo libre se abre otra (4.ª sesión creada, 2.ª activa)', k_prop, 'cfg1-ab-0009', k_lc, v_sesion, cajas[4], terms[4]);
  v_sesion := gen_random_uuid(); ses := array_append(ses, v_sesion);
  perform pg_temp.cfg_abrir('B7.4 y otra más (3.ª activa)', k_prop, 'cfg1-ab-0010', k_lc, v_sesion, cajas[5], terms[5]);
  perform pg_temp.cfg_abrir('B7.5 la siguiente ya no cabe', k_prop, 'cfg1-ab-0011', k_lc, gen_random_uuid(), cajas[6], terms[6], 'caja_limite_sesiones_alcanzado');

  -- Sin ajuste, el límite es 10: se cierran todas y se abren 10; la 11 se rechaza.
  update public.caja_sesiones set estado = 'APERTURA_CANCELADA', abierta_at = null, cerrada_at = now()
   where empresa_id = k_e and local_id = k_lc and estado in ('ABIERTA', 'PREPARANDO_APERTURA', 'EN_CIERRE', 'CIERRE_PROVISIONAL');
  delete from public.abc_config_ajustes where empresa_id = k_e and local_id = k_lc;
  v := pg_temp.paso('B8.1 sin ajuste el valor efectivo es 10', k_prop, format('select public.abc_obtener_ajustes(%L,%L)', k_e, k_lc));
  perform pg_temp.ok('B8.2 origen defecto', (v->'cajas_abiertas_max'->>'valor')::int = 10 and v->'cajas_abiertas_max'->>'origen' = 'defecto', v);
  for i in 6..15 loop
    v := pg_temp.cfg_abrir('B8.3 abre la sesión ' || (i - 5) || ' de 10 (límite por defecto)', k_prop, 'cfg1-ab-d' || lpad(i::text, 3, '0'), k_lc, gen_random_uuid(), cajas[i], terms[i]);
  end loop;
  perform pg_temp.ok('B8.4 diez sesiones activas', pg_temp.activas(k_lc) = 10, to_jsonb(pg_temp.activas(k_lc)));
  perform pg_temp.cfg_abrir('B8.5 la undécima se rechaza', k_prop, 'cfg1-ab-d016', k_lc, gen_random_uuid(), cajas[16], terms[16], 'caja_limite_sesiones_alcanzado');
  perform pg_temp.ok('B8.6 sigue habiendo diez', pg_temp.activas(k_lc) = 10, to_jsonb(pg_temp.activas(k_lc)));

  -- Aislamiento y auditoría.
  v := pg_temp.paso('B9.1 otro local de la empresa sigue con el valor por defecto', k_prop, format('select public.abc_obtener_ajustes(%L,%L)', k_e, k_l1));
  perform pg_temp.ok('B9.2 L1 sin ajuste propio', (v->'cajas_abiertas_max'->>'valor')::int = 10 and v->'cajas_abiertas_max'->>'origen' = 'defecto', v);
  select count(*) into v_cnt from public.abc_eventos where empresa_id = k_e and local_id = k_lc and event_type = 'AJUSTE_CONFIGURADO';
  perform pg_temp.ok('B9.3 cuatro cambios reales dejaron cuatro eventos (los repetidos y los rechazados no)', v_cnt = 4, to_jsonb(v_cnt));
  perform pg_temp.ok('B9.4 el evento guarda valor anterior, nuevo y motivo',
    (select payload->>'motivo' from public.abc_eventos where operation_id = 'cfg1-aj-0003' and event_type = 'AJUSTE_CONFIGURADO') = 'subir'
    and (select (payload->>'anterior')::int from public.abc_eventos where operation_id = 'cfg1-aj-0003' and event_type = 'AJUSTE_CONFIGURADO') = 2
    and (select (payload->>'nuevo')::int from public.abc_eventos where operation_id = 'cfg1-aj-0003' and event_type = 'AJUSTE_CONFIGURADO') = 3, null);
end
$t$;
