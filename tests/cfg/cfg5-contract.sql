-- Capa de configuración, PIEZA 5 · contrato vivo de permisos configurables, reabrir cierre (D14) y retirada de roles.
--
-- Se ejecuta DESPUÉS de las migraciones de las piezas 1 y 5 y de D13 (20261002190000, 20261002240000 y 20261003100000; D13 cambia
-- el techo de ABC_REEMBOLSO_SOLICITAR a «Cajero/a», por eso las comprobaciones de techo usan ABC_REEMBOLSO_CONFIRMAR), dentro de una
-- transacción que termina en ROLLBACK:
--
--   begin; <este archivo>; select <resumen de la.log>; rollback;
--
-- No depende de los datos de QA: crea su propia empresa de prueba (CFG-EMP-T), locales (CFG-L…) y terminal dentro
-- de la transacción. Solo necesita que existan en auth.users cuatro identificadores de usuario (en QA ya existen; en
-- la réplica local los crea tests/cfg/local-fixture.sql). Los actores se suplantan con claims JWT (y, cuando se
-- llama a una función pública, también con `set local role`). Todo se revierte con el ROLLBACK.
--
-- Estructura (para poder partirlo en trozos si la herramienta corta a los 60 s):
--   -- ==== HELPERS ====   funciones auxiliares
--   -- ==== FIXTURE ====   empresas, locales, membresías y terminal
--   -- ==== CHUNK: nombre ==== ... -- ==== FIN CHUNK ====   cada bloque usa sus propios locales; el bloque `config`
--                        deja sus decisiones de empresa en «heredar» al terminar; `retirados` va el último
--
-- Los bloques `config`, `reabrir` y `retirados` se pueden ejecutar solos con HELPERS y FIXTURE. El bloque `retirados`
-- desactiva el trigger de roles retirados (dentro de la transacción) para fabricar datos antiguos.

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

-- ¿Tiene el usuario la capacidad en el local? (llama a la función privada como dueño, con los claims del usuario)
create function pg_temp.cap(p_uid text, p_local text, p_cap text, p_fam text default 'GENERAL') returns boolean language plpgsql as $f$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', p_uid, true);
  return case p_fam when 'COMANDA' then private.abc_a10_tiene_capacidad('CFG-EMP-T', p_local, p_cap)
                    else private.abc_tiene_capacidad('CFG-EMP-T', p_local, p_cap) end;
end $f$;

-- abc_configurar_capacidad_rol(operation_id, empresa, local, ambito, rol, capacidad, permitido, motivo)
create function pg_temp.c_cfg(p_nombre text, p_uid text, p_op text, p_local text, p_ambito text, p_rol text, p_cap text, p_perm boolean, p_motivo text, p_espera text default null, p_rol_db text default 'authenticated') returns jsonb language plpgsql as $f$
begin
  return pg_temp.paso(p_nombre, p_uid,
    format('select public.abc_configurar_capacidad_rol(%L,%L,%L,%L,%L,%L,%L::boolean,%L)',
      p_op, 'CFG-EMP-T', p_local, p_ambito, p_rol, p_cap, p_perm, p_motivo),
    p_espera, p_rol_db);
end $f$;

create function pg_temp.c_obt(p_nombre text, p_uid text, p_local text, p_espera text default null, p_rol_db text default 'authenticated') returns jsonb language plpgsql as $f$
begin
  return pg_temp.paso(p_nombre, p_uid, format('select public.abc_obtener_capacidades_rol(%L,%L)', 'CFG-EMP-T', p_local), p_espera, p_rol_db);
end $f$;

create function pg_temp.c_ret(p_nombre text, p_uid text, p_local text, p_espera text default null) returns jsonb language plpgsql as $f$
begin
  return pg_temp.paso(p_nombre, p_uid, format('select public.abc_listar_roles_retirados(%L,%L)', 'CFG-EMP-T', p_local), p_espera);
end $f$;

-- ==== FIXTURE ====
do $t$
declare
  k_e    constant text := 'CFG-EMP-T';
  k_eu   constant text := 'CFG-EMP-U';
  k_prop constant text := '16c79749-a206-47d9-8d56-fbc7a4a49eb7';  -- Propietario de la empresa de prueba (todos los locales)
  k_enc  constant text := '5003adca-2e30-477e-8afd-ffb3037b034e';  -- Encargado / Cajero/a / Camarero/a según el local
  k_caj  constant text := 'eb0bca7b-b366-4d72-80e1-0b02e9bdd666';  -- Cajero/a; Propietario SOLO del local CFG-LP
  k_otro constant text := '73967f0c-3474-443d-ad83-9f20b94204c3';  -- Propietario de OTRA empresa
  l text;
begin
  insert into public.empresas(id, nombre, activo) values (k_e, 'Empresa prueba capa de configuración', true), (k_eu, 'Otra empresa prueba', true);
  insert into public.membresias_usuario(user_id, empresa_id, local_id, todos_locales, rol, activo) values
    (k_prop::uuid, k_e, null, true, 'Propietario', true),
    (k_otro::uuid, k_eu, null, true, 'Propietario', true);
  foreach l in array array['CFG-LA', 'CFG-LA2', 'CFG-LD', 'CFG-LR'] loop
    insert into public.locales(id, empresa_id, nombre, activo) values (l, k_e, l, true);
    insert into public.membresias_usuario(user_id, empresa_id, local_id, todos_locales, rol, activo) values
      (k_enc::uuid, k_e, l, false, 'Encargado', true),
      (k_caj::uuid, k_e, l, false, 'Cajero/a', true);
  end loop;
  insert into public.locales(id, empresa_id, nombre, activo) values ('CFG-LP', k_e, 'LP', true);
  insert into public.membresias_usuario(user_id, empresa_id, local_id, todos_locales, rol, activo) values
    (k_caj::uuid, k_e, 'CFG-LP', false, 'Propietario', true);
  insert into public.locales(id, empresa_id, nombre, activo) values ('CFG-LM1', k_e, 'LM1', true), ('CFG-LM2', k_e, 'LM2', true), ('CFG-LM3', k_e, 'LM3', true);
  insert into public.membresias_usuario(user_id, empresa_id, local_id, todos_locales, rol, activo) values
    (k_enc::uuid, k_e, 'CFG-LM1', false, 'Encargado', true),
    (k_enc::uuid, k_e, 'CFG-LM2', false, 'Cajero/a', true),
    (k_enc::uuid, k_e, 'CFG-LM3', false, 'Camarero/a', true);
  insert into public.locales(id, empresa_id, nombre, activo) values ('CFG-LR2', k_e, 'LR2', true);
  insert into public.locales(id, empresa_id, nombre, activo) values ('CFG-LU', k_eu, 'LU', true);
  insert into public.locales(id, empresa_id, nombre, activo) values ('CFG-LOFF', k_e, 'LOFF', false);
  insert into public.terminales_tpv(empresa_id, local_id, nombre) values (k_e, 'CFG-LD', 'Terminal CFG-LD');
end
$t$;

-- ==== CHUNK: matriz ====
-- La plantilla por defecto es EXACTAMENTE lo que hacían abc_tiene_capacidad y abc_a10_tiene_capacidad antes de la
-- pieza 5 (la tabla de abajo se copió a mano del texto original, aparte del catálogo), más la capacidad nueva
-- ABC_CIERRE_REABRIR (solo Propietario) y la retirada de Churrero/a, Básico y Estándar.
do $t$
declare
  k_e    constant text := 'CFG-EMP-T';
  k_prop constant text := '16c79749-a206-47d9-8d56-fbc7a4a49eb7';
  k_enc  constant text := '5003adca-2e30-477e-8afd-ffb3037b034e';
  k_caj  constant text := 'eb0bca7b-b366-4d72-80e1-0b02e9bdd666';
  k_otro constant text := '73967f0c-3474-443d-ad83-9f20b94204c3';
  v_mal jsonb := '[]'::jsonb;
  v_n integer := 0;
  r record;
  v_rol text; v_uid text; v_loc text; v_cod text; v_esp boolean; v_got boolean; v_dup integer;
begin
  -- P = Propietario, E = Encargado, C = Cajero/a, M = Camarero/a. Roles retirados (Churrero/a…) en la última columna, solo informativo.
  for r in
    select * from (values
      ('ABC_CUENTA_OPERAR','GENERAL','PECM'), ('ABC_CUENTA_REASIGNAR','GENERAL','PE'), ('ABC_COBRO_INICIAR','GENERAL','PECM'),
      ('ABC_COBRO_EFECTIVO','GENERAL','PEC'), ('ABC_COBRO_RESOLVER_INCIERTO','GENERAL','PE'), ('ABC_REEMBOLSO_SOLICITAR','GENERAL','PE'),
      ('ABC_REEMBOLSO_CONFIRMAR','GENERAL','PE'), ('ABC_CAJA_OPERAR','GENERAL','PEC'), ('ABC_EMISOR_CAMBIAR','GENERAL','PE'),
      ('ABC_PEDIDO_ENVIAR','GENERAL','PECM'), ('ABC_PREPARACION_INICIAR','GENERAL','PEM'), ('ABC_PREPARACION_COMPLETAR','GENERAL','PEM'),
      ('ABC_PEDIDO_SERVIR','GENERAL','PECM'), ('ABC_LINEA_CANCELAR','GENERAL','PECM'), ('ABC_CANCELACION_SENSIBLE','GENERAL','PE'),
      ('ABC_PEDIDO_CANCELAR','GENERAL','PE'), ('ABC_PEDIDO_CERRAR','GENERAL','PEC'), ('ABC_SALA_VER','GENERAL','PECM'),
      ('ABC_SALA_CONFIGURAR','GENERAL','PE'), ('ABC_MESA_ASIGNAR','GENERAL','PECM'), ('ABC_MESA_RESERVAR','GENERAL','PE'),
      ('ABC_MESA_BLOQUEAR','GENERAL','PE'), ('ABC_CUENTA_REPARTIR','GENERAL','PECM'), ('ABC_CUENTA_UNIR','GENERAL','PECM'),
      ('ABC_REPARTO_REVERTIR','GENERAL','PE'),
      ('ABC_CIERRE_REABRIR','GENERAL','P'),
      ('ABC_COMANDA_VER','COMANDA','PECM'), ('ABC_COMANDA_CONFIGURAR','COMANDA','PE'), ('ABC_COMANDA_CAMBIAR','COMANDA','PEM'),
      ('ABC_COMANDA_REIMPRIMIR','COMANDA','PECM'), ('ABC_COMANDA_MERMA_DECIDIR','COMANDA','PE')
    ) as t(capacidad, familia, roles)
  loop
    v_n := v_n + 1;
    foreach v_cod in array array['P','E','C','M'] loop
      v_uid := case v_cod when 'P' then k_prop else k_enc end;
      v_loc := case v_cod when 'P' then 'CFG-LM1' when 'E' then 'CFG-LM1' when 'C' then 'CFG-LM2' else 'CFG-LM3' end;
      v_esp := position(v_cod in r.roles) > 0;
      v_got := pg_temp.cap(v_uid, v_loc, r.capacidad, r.familia);
      if v_got is distinct from v_esp then
        v_mal := v_mal || jsonb_build_array(jsonb_build_object('cap', r.capacidad, 'rol', v_cod, 'esperado', v_esp, 'obtenido', v_got));
      end if;
    end loop;
  end loop;
  perform pg_temp.ok('M1.1 las 31 capacidades de la matriz (30 de hoy + ABC_CIERRE_REABRIR) por los 4 roles coinciden con la plantilla', v_mal = '[]'::jsonb and v_n = 31, jsonb_build_object('capacidades', v_n, 'discrepancias', v_mal));

  perform pg_temp.ok('M1.2 el catálogo tiene exactamente 31 capacidades, sin repetir',
    (select count(*) from private.abc_cap_catalogo()) = 31 and (select count(distinct capacidad) from private.abc_cap_catalogo()) = 31, null);
  perform pg_temp.ok('M1.3 la plantilla nunca supera el techo de ninguna capacidad',
    not exists (select 1 from private.abc_cap_catalogo() c
                 where (c.encargado and not private.abc_cap_techo_permite(c.techo, 'Encargado'))
                    or (c.cajero and not private.abc_cap_techo_permite(c.techo, 'Cajero/a'))
                    or (c.camarero and not private.abc_cap_techo_permite(c.techo, 'Camarero/a'))
                    or not c.propietario), null);
  perform pg_temp.ok('M1.4 lo delicado (dinero, documentos fiscales, reabrir) tiene techo en Encargado (salvo solicitar devoluciones: techo Cajero/a desde D13)',
    (select array_agg(capacidad order by capacidad) from private.abc_cap_catalogo() where techo = 'ENCARGADO')
      = array['ABC_CANCELACION_SENSIBLE','ABC_CIERRE_REABRIR','ABC_COBRO_RESOLVER_INCIERTO','ABC_EMISOR_CAMBIAR','ABC_REEMBOLSO_CONFIRMAR']
    and (select array_agg(capacidad order by capacidad) from private.abc_cap_catalogo() where techo = 'CAJERO') = array['ABC_REEMBOLSO_SOLICITAR']
    and not exists (select 1 from private.abc_cap_catalogo() where techo not in ('TODOS', 'ENCARGADO', 'CAJERO')), null);

  -- La función general no reconoce las capacidades de cocina y la de cocina no reconoce las demás (como antes).
  perform pg_temp.ok('M2.1 abc_tiene_capacidad no reconoce una capacidad de cocina', not pg_temp.cap(k_prop, 'CFG-LM1', 'ABC_COMANDA_VER', 'GENERAL'), null);
  perform pg_temp.ok('M2.2 abc_a10_tiene_capacidad no reconoce una capacidad general', not pg_temp.cap(k_prop, 'CFG-LM1', 'ABC_CAJA_OPERAR', 'COMANDA'), null);
  perform pg_temp.ok('M2.3 una capacidad inventada, vacía o con minúsculas distinta de la plantilla',
    not pg_temp.cap(k_prop, 'CFG-LM1', 'ABC_INVENTADA') and not pg_temp.cap(k_prop, 'CFG-LM1', '') and pg_temp.cap(k_prop, 'CFG-LM1', '  abc_caja_operar  '), null);
  perform pg_temp.ok('M2.4 quien no es de la empresa no tiene nada', not pg_temp.cap(k_otro, 'CFG-LM1', 'ABC_SALA_VER'), null);
  perform pg_temp.ok('M2.5 un local sin membresía propia tampoco', not pg_temp.cap(k_enc, 'CFG-LU', 'ABC_SALA_VER'), null);
  perform set_config('request.jwt.claims', json_build_object('role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', '', true);
  perform pg_temp.ok('M2.6 sin sesión no hay ninguna capacidad', not private.abc_tiene_capacidad('CFG-EMP-T', 'CFG-LM1', 'ABC_SALA_VER'), null);

  -- Roles retirados: ninguna capacidad, ni general ni de cocina (llamando directamente a la resolución).
  select count(*) into v_dup
    from private.abc_cap_catalogo() c
    cross join unnest(array['Churrero/a','Básico','Estándar','Gerente','propietario','']) as ro(rol)
   where private.abc_cap_efectiva('CFG-EMP-T', 'CFG-LM1', ro.rol, c.capacidad, c.familia);
  perform pg_temp.ok('M3.1 Churrero/a, Básico, Estándar y roles desconocidos no tienen ninguna capacidad', v_dup = 0, to_jsonb(v_dup));
  perform pg_temp.ok('M3.2 el Propietario tiene las 31', (select count(*) from private.abc_cap_catalogo() c where private.abc_cap_efectiva('CFG-EMP-T', 'CFG-LM1', 'Propietario', c.capacidad, c.familia)) = 31, null);
  perform pg_temp.ok('M3.3 los roles retirados son exactamente tres', private.abc_cap_rol_retirado('Churrero/a') and private.abc_cap_rol_retirado('Básico') and private.abc_cap_rol_retirado('Estándar')
    and not private.abc_cap_rol_retirado('Cajero/a') and not private.abc_cap_rol_retirado('Propietario') and not private.abc_cap_rol_retirado(null), null);
  perform pg_temp.ok('M3.4 solo se configuran tres roles', private.abc_cap_rol_configurable('Encargado') and private.abc_cap_rol_configurable('Cajero/a') and private.abc_cap_rol_configurable('Camarero/a')
    and not private.abc_cap_rol_configurable('Propietario') and not private.abc_cap_rol_configurable('Churrero/a') and not private.abc_cap_rol_configurable(null), null);
end
$t$;
-- ==== FIN CHUNK ====

-- ==== CHUNK: config ====
do $t$
declare
  k_e    constant text := 'CFG-EMP-T';
  k_prop constant text := '16c79749-a206-47d9-8d56-fbc7a4a49eb7';
  k_enc  constant text := '5003adca-2e30-477e-8afd-ffb3037b034e';
  k_caj  constant text := 'eb0bca7b-b366-4d72-80e1-0b02e9bdd666';
  k_otro constant text := '73967f0c-3474-443d-ad83-9f20b94204c3';
  v jsonb; v2 jsonb; v_primero jsonb; v_cnt integer; v_ev jsonb; v_cap jsonb;
begin
  -- C1: quién puede decidir
  perform pg_temp.c_cfg('C1.1 el Encargado no puede decidir', k_enc, 'cfg5-perm-01', 'CFG-LA', 'LOCAL', 'Cajero/a', 'ABC_PEDIDO_CANCELAR', true, 'x', 'abc_config_no_autorizado');
  perform pg_temp.c_cfg('C1.2 el Cajero/a no puede', k_caj, 'cfg5-perm-02', 'CFG-LA', 'LOCAL', 'Cajero/a', 'ABC_PEDIDO_CANCELAR', true, 'x', 'abc_config_no_autorizado');
  perform pg_temp.c_cfg('C1.3 el Propietario de otra empresa no puede', k_otro, 'cfg5-perm-03', 'CFG-LA', 'LOCAL', 'Cajero/a', 'ABC_PEDIDO_CANCELAR', true, 'x', 'abc_config_no_autorizado');
  perform pg_temp.c_cfg('C1.4 anon no puede', null, 'cfg5-perm-04', 'CFG-LA', 'LOCAL', 'Cajero/a', 'ABC_PEDIDO_CANCELAR', true, 'x', 'permission denied', 'anon');
  perform pg_temp.c_cfg('C1.5 service_role no puede', null, 'cfg5-perm-05', 'CFG-LA', 'LOCAL', 'Cajero/a', 'ABC_PEDIDO_CANCELAR', true, 'x', 'permission denied', 'service_role');
  perform pg_temp.c_cfg('C1.6 el Propietario de un solo local no puede decidir para toda la empresa', k_caj, 'cfg5-perm-06', 'CFG-LP', 'EMPRESA', 'Cajero/a', 'ABC_PEDIDO_CANCELAR', true, 'x', 'abc_config_no_autorizado');
  perform pg_temp.c_cfg('C1.7 el Encargado tampoco para la empresa', k_enc, 'cfg5-perm-07', 'CFG-LA', 'EMPRESA', 'Cajero/a', 'ABC_PEDIDO_CANCELAR', true, 'x', 'abc_config_no_autorizado');

  -- C2: validaciones (ninguna deja rastro)
  perform pg_temp.c_cfg('C2.1 ámbito inexistente', k_prop, 'cfg5-val-01', 'CFG-LA', 'REGION', 'Cajero/a', 'ABC_PEDIDO_CANCELAR', true, 'x', 'capacidad_ambito_invalido');
  perform pg_temp.c_cfg('C2.2 el Propietario no se configura', k_prop, 'cfg5-val-02', 'CFG-LA', 'LOCAL', 'Propietario', 'ABC_PEDIDO_CANCELAR', false, 'x', 'capacidad_rol_invalido');
  perform pg_temp.c_cfg('C2.3 un rol retirado no se configura', k_prop, 'cfg5-val-03', 'CFG-LA', 'LOCAL', 'Churrero/a', 'ABC_PEDIDO_CANCELAR', true, 'x', 'capacidad_rol_invalido');
  perform pg_temp.c_cfg('C2.4 un rol inexistente', k_prop, 'cfg5-val-04', 'CFG-LA', 'LOCAL', 'Gerente', 'ABC_PEDIDO_CANCELAR', true, 'x', 'capacidad_rol_invalido');
  perform pg_temp.c_cfg('C2.5 una capacidad inventada', k_prop, 'cfg5-val-05', 'CFG-LA', 'LOCAL', 'Cajero/a', 'ABC_INVENTADA', true, 'x', 'capacidad_invalida');
  perform pg_temp.c_cfg('C2.6 el cajero no puede confirmar devoluciones (techo)', k_prop, 'cfg5-val-06', 'CFG-LA', 'LOCAL', 'Cajero/a', 'ABC_REEMBOLSO_CONFIRMAR', true, 'x', 'capacidad_fuera_de_techo');
  perform pg_temp.c_cfg('C2.7 el camarero no puede cambiar el emisor (techo)', k_prop, 'cfg5-val-07', 'CFG-LA', 'LOCAL', 'Camarero/a', 'ABC_EMISOR_CAMBIAR', true, 'x', 'capacidad_fuera_de_techo');
  perform pg_temp.c_cfg('C2.8 el cajero no puede reabrir cierres (techo)', k_prop, 'cfg5-val-08', 'CFG-LA', 'LOCAL', 'Cajero/a', 'ABC_CIERRE_REABRIR', true, 'x', 'capacidad_fuera_de_techo');
  perform pg_temp.c_cfg('C2.9 sin motivo', k_prop, 'cfg5-val-09', 'CFG-LA', 'LOCAL', 'Cajero/a', 'ABC_PEDIDO_CANCELAR', true, '  ', 'capacidad_motivo_requerido');
  perform pg_temp.c_cfg('C2.10 local inexistente', k_prop, 'cfg5-val-10', 'CFG-NO-EXISTE', 'LOCAL', 'Cajero/a', 'ABC_PEDIDO_CANCELAR', true, 'x', 'capacidad_local_no_disponible');
  perform pg_temp.c_cfg('C2.11 local desactivado', k_prop, 'cfg5-val-11', 'CFG-LOFF', 'LOCAL', 'Cajero/a', 'ABC_PEDIDO_CANCELAR', true, 'x', 'capacidad_local_no_disponible');
  perform pg_temp.ok('C2.12 los rechazos no dejaron decisiones ni operaciones',
    (select count(*) from public.abc_capacidades_rol where empresa_id = k_e) = 0
    and (select count(*) from public.abc_operaciones where operation_id like 'cfg5-%') = 0, null);

  -- C3: una decisión de local
  perform pg_temp.ok('C3.0 por defecto el Cajero/a no cancela pedidos', not pg_temp.cap(k_caj, 'CFG-LA', 'ABC_PEDIDO_CANCELAR'), null);
  v := pg_temp.c_cfg('C3.1 el Propietario permite al Cajero/a cancelar pedidos en CFG-LA', k_prop, 'cfg5-0100', 'CFG-LA', 'LOCAL', 'Cajero/a', 'ABC_PEDIDO_CANCELAR', true, 'Prueba de confianza');
  v_primero := v;
  perform pg_temp.ok('C3.2 cambio, versión 1, ámbito local y efectivo en ese local',
    (v->>'cambio')::boolean and (v->>'version')::int = 1 and v->>'ambito' = 'LOCAL' and v->>'local_id' = 'CFG-LA' and (v->>'permitido')::boolean
    and (v->>'efectivo_en_local')::boolean and v->>'rol' = 'Cajero/a' and v->>'capacidad' = 'ABC_PEDIDO_CANCELAR', v);
  perform pg_temp.ok('C3.3 el Cajero/a de CFG-LA ya puede', pg_temp.cap(k_caj, 'CFG-LA', 'ABC_PEDIDO_CANCELAR'), null);
  perform pg_temp.ok('C3.4 en otro local (CFG-LA2) sigue sin poder', not pg_temp.cap(k_caj, 'CFG-LA2', 'ABC_PEDIDO_CANCELAR'), null);
  perform pg_temp.ok('C3.4b el Encargado de CFG-LA conserva lo suyo y el Propietario todo',
    pg_temp.cap(k_enc, 'CFG-LA', 'ABC_PEDIDO_CANCELAR') and pg_temp.cap(k_prop, 'CFG-LA', 'ABC_PEDIDO_CANCELAR'), null);

  -- lectura de lo decidido
  v_cap := pg_temp.c_obt('C3.5 el Propietario lee los permisos de CFG-LA', k_prop, 'CFG-LA');
  perform pg_temp.ok('C3.6 31 capacidades, 3 roles configurables y 3 retirados',
    jsonb_array_length(v_cap->'capacidades') = 31 and jsonb_array_length(v_cap->'roles_configurables') = 3 and jsonb_array_length(v_cap->'roles_retirados') = 3, jsonb_build_object('n', jsonb_array_length(v_cap->'capacidades')));
  select x into v_ev from jsonb_array_elements(v_cap->'capacidades') x where x->>'capacidad' = 'ABC_PEDIDO_CANCELAR';
  perform pg_temp.ok('C3.7 el Cajero/a: efectivo sí, plantilla no, decisión de local, origen local',
    (select (r->>'efectivo')::boolean and not (r->>'plantilla')::boolean and (r->>'decision_local')::boolean and r->>'origen' = 'local' and (r->>'puede_dar')::boolean
       from jsonb_array_elements(v_ev->'roles') r where r->>'rol' = 'Cajero/a'), v_ev);
  perform pg_temp.ok('C3.8 el Encargado viene de la plantilla y el Propietario es fijo',
    (select r->>'origen' = 'plantilla' and (r->>'efectivo')::boolean from jsonb_array_elements(v_ev->'roles') r where r->>'rol' = 'Encargado')
    and (select r->>'origen' = 'fijo' and not (r->>'puede_dar')::boolean from jsonb_array_elements(v_ev->'roles') r where r->>'rol' = 'Propietario'), v_ev);
  select x into v_ev from jsonb_array_elements(v_cap->'capacidades') x where x->>'capacidad' = 'ABC_COBRO_RESOLVER_INCIERTO';
  perform pg_temp.ok('C3.9 lo delicado: el Encargado se puede tocar, el Cajero/a y el Camarero/a no (techo)',
    (select (r->>'puede_dar')::boolean from jsonb_array_elements(v_ev->'roles') r where r->>'rol' = 'Encargado')
    and not (select (r->>'puede_dar')::boolean from jsonb_array_elements(v_ev->'roles') r where r->>'rol' = 'Cajero/a')
    and not (select (r->>'puede_dar')::boolean from jsonb_array_elements(v_ev->'roles') r where r->>'rol' = 'Camarero/a'), v_ev);
  perform pg_temp.ok('C3.10 el Propietario puede decidir (local y empresa); la lectura lo indica',
    (v_cap->>'puede_configurar_local')::boolean and (v_cap->>'puede_configurar_empresa')::boolean, null);
  v2 := pg_temp.c_obt('C3.11 el Encargado puede leer pero no decidir', k_enc, 'CFG-LA');
  perform pg_temp.ok('C3.12 indicadores del Encargado', not (v2->>'puede_configurar_local')::boolean and not (v2->>'puede_configurar_empresa')::boolean and jsonb_array_length(v2->'capacidades') = 31, null);
  v2 := pg_temp.c_obt('C3.13 el Propietario de un solo local decide en su local, no en la empresa', k_caj, 'CFG-LP');
  perform pg_temp.ok('C3.14 indicadores del Propietario de un solo local', (v2->>'puede_configurar_local')::boolean and not (v2->>'puede_configurar_empresa')::boolean, null);
  perform pg_temp.c_obt('C3.15 el Propietario de otra empresa no lee', k_otro, 'CFG-LA', 'abc_config_no_autorizado');
  perform pg_temp.c_obt('C3.16 anon no lee', null, 'CFG-LA', 'permission denied', 'anon');
  perform pg_temp.c_obt('C3.17 service_role no lee', null, 'CFG-LA', 'permission denied', 'service_role');

  -- idempotencia y versiones
  v2 := pg_temp.c_cfg('C3.18 replay del mismo operation_id', k_prop, 'cfg5-0100', 'CFG-LA', 'LOCAL', 'Cajero/a', 'ABC_PEDIDO_CANCELAR', true, 'Prueba de confianza');
  perform pg_temp.ok('C3.19 el replay devuelve el resultado original', v2 = v_primero, v2);
  perform pg_temp.c_cfg('C3.20 mismo operation_id con otro contenido: conflicto', k_prop, 'cfg5-0100', 'CFG-LA', 'LOCAL', 'Cajero/a', 'ABC_PEDIDO_CANCELAR', false, 'Prueba de confianza', 'operation_id_conflict');
  v2 := pg_temp.c_cfg('C3.21 la misma decisión con otro operation_id', k_prop, 'cfg5-0101', 'CFG-LA', 'LOCAL', 'Cajero/a', 'ABC_PEDIDO_CANCELAR', true, 'repetir');
  perform pg_temp.ok('C3.22 sin cambio: la versión no sube', not (v2->>'cambio')::boolean and (v2->>'version')::int = 1, v2);
  v2 := pg_temp.c_cfg('C3.23 se quita el permiso', k_prop, 'cfg5-0102', 'CFG-LA', 'LOCAL', 'Cajero/a', 'ABC_PEDIDO_CANCELAR', false, 'Ya no');
  perform pg_temp.ok('C3.24 versión 2, cambio y efectivo no', (v2->>'cambio')::boolean and (v2->>'version')::int = 2 and not (v2->>'efectivo_en_local')::boolean, v2);
  perform pg_temp.ok('C3.25 el Cajero/a vuelve a no poder', not pg_temp.cap(k_caj, 'CFG-LA', 'ABC_PEDIDO_CANCELAR'), null);
  v2 := pg_temp.c_cfg('C3.26 heredar (volver a la plantilla)', k_prop, 'cfg5-0103', 'CFG-LA', 'LOCAL', 'Cajero/a', 'ABC_PEDIDO_CANCELAR', null, 'Volver a lo normal');
  perform pg_temp.ok('C3.27 versión 3, cambio, decisión nula', (v2->>'cambio')::boolean and (v2->>'version')::int = 3 and v2->'permitido' = 'null'::jsonb, v2);
  v2 := pg_temp.c_cfg('C3.28 heredar otra vez no cambia nada', k_prop, 'cfg5-0104', 'CFG-LA', 'LOCAL', 'Cajero/a', 'ABC_PEDIDO_CANCELAR', null, 'otra vez');
  perform pg_temp.ok('C3.29 sin cambio, versión 3', not (v2->>'cambio')::boolean and (v2->>'version')::int = 3, v2);
  v2 := pg_temp.c_cfg('C3.30 heredar sin decisión previa no crea nada', k_prop, 'cfg5-0105', 'CFG-LA2', 'LOCAL', 'Camarero/a', 'ABC_SALA_VER', null, 'nada');
  perform pg_temp.ok('C3.31 versión 0 y sin cambio', not (v2->>'cambio')::boolean and (v2->>'version')::int = 0, v2);

  -- C4: decisiones de empresa, y el local manda
  perform pg_temp.ok('C4.0 por defecto el Cajero/a no reserva mesas', not pg_temp.cap(k_caj, 'CFG-LA2', 'ABC_MESA_RESERVAR') and not pg_temp.cap(k_caj, 'CFG-LD', 'ABC_MESA_RESERVAR'), null);
  v := pg_temp.c_cfg('C4.1 el Propietario permite a todos los Cajero/a de la empresa reservar mesas', k_prop, 'cfg5-0200', 'CFG-LA', 'EMPRESA', 'Cajero/a', 'ABC_MESA_RESERVAR', true, 'Política de empresa');
  perform pg_temp.ok('C4.2 ámbito empresa, sin local de destino, versión 1', (v->>'cambio')::boolean and v->>'ambito' = 'EMPRESA' and v->'local_id' = 'null'::jsonb and (v->>'version')::int = 1, v);
  perform pg_temp.ok('C4.3 vale en todos los locales de la empresa', pg_temp.cap(k_caj, 'CFG-LA2', 'ABC_MESA_RESERVAR') and pg_temp.cap(k_caj, 'CFG-LD', 'ABC_MESA_RESERVAR'), null);
  v2 := pg_temp.c_cfg('C4.4 una decisión de local pisa la de empresa', k_prop, 'cfg5-0201', 'CFG-LA2', 'LOCAL', 'Cajero/a', 'ABC_MESA_RESERVAR', false, 'Aquí no');
  perform pg_temp.ok('C4.5 en CFG-LA2 no, en CFG-LD sí', not pg_temp.cap(k_caj, 'CFG-LA2', 'ABC_MESA_RESERVAR') and pg_temp.cap(k_caj, 'CFG-LD', 'ABC_MESA_RESERVAR'), null);
  v_cap := pg_temp.c_obt('C4.6 lectura en CFG-LA2', k_prop, 'CFG-LA2');
  select x into v_ev from jsonb_array_elements(v_cap->'capacidades') x where x->>'capacidad' = 'ABC_MESA_RESERVAR';
  perform pg_temp.ok('C4.7 origen local, con las dos decisiones visibles',
    (select r->>'origen' = 'local' and not (r->>'decision_local')::boolean and (r->>'decision_empresa')::boolean and not (r->>'efectivo')::boolean from jsonb_array_elements(v_ev->'roles') r where r->>'rol' = 'Cajero/a'), v_ev);
  v_cap := pg_temp.c_obt('C4.8 lectura en CFG-LD', k_prop, 'CFG-LD');
  select x into v_ev from jsonb_array_elements(v_cap->'capacidades') x where x->>'capacidad' = 'ABC_MESA_RESERVAR';
  perform pg_temp.ok('C4.9 origen empresa', (select r->>'origen' = 'empresa' and (r->>'efectivo')::boolean from jsonb_array_elements(v_ev->'roles') r where r->>'rol' = 'Cajero/a'), v_ev);
  v2 := pg_temp.c_cfg('C4.10 el local hereda otra vez', k_prop, 'cfg5-0202', 'CFG-LA2', 'LOCAL', 'Cajero/a', 'ABC_MESA_RESERVAR', null, 'Como la empresa');
  perform pg_temp.ok('C4.11 CFG-LA2 vuelve a seguir a la empresa', pg_temp.cap(k_caj, 'CFG-LA2', 'ABC_MESA_RESERVAR'), null);
  v2 := pg_temp.c_cfg('C4.12 un Camarero/a: decisión de empresa y decisión contraria de local', k_prop, 'cfg5-0203', 'CFG-LA', 'EMPRESA', 'Camarero/a', 'ABC_COBRO_EFECTIVO', true, 'Camareros cobran');
  perform pg_temp.ok('C4.13 el Camarero/a de CFG-LM3 cobra en efectivo', pg_temp.cap(k_enc, 'CFG-LM3', 'ABC_COBRO_EFECTIVO'), null);
  perform pg_temp.ok('C4.14 y la capacidad de otro rol no se ve afectada (el mismo usuario como Cajero/a ya la tenía; como Encargado también)', pg_temp.cap(k_enc, 'CFG-LM2', 'ABC_COBRO_EFECTIVO') and pg_temp.cap(k_enc, 'CFG-LM1', 'ABC_COBRO_EFECTIVO'), null);
  v2 := pg_temp.c_cfg('C4.15 la empresa vuelve a heredar la plantilla (Cajero/a)', k_prop, 'cfg5-0204', 'CFG-LA', 'EMPRESA', 'Cajero/a', 'ABC_MESA_RESERVAR', null, 'Fin de la política');
  v2 := pg_temp.c_cfg('C4.16 y el Camarero/a también', k_prop, 'cfg5-0205', 'CFG-LA', 'EMPRESA', 'Camarero/a', 'ABC_COBRO_EFECTIVO', null, 'Fin de la política');
  perform pg_temp.ok('C4.17 todo vuelve a la plantilla', not pg_temp.cap(k_caj, 'CFG-LA2', 'ABC_MESA_RESERVAR') and not pg_temp.cap(k_caj, 'CFG-LD', 'ABC_MESA_RESERVAR') and not pg_temp.cap(k_enc, 'CFG-LM3', 'ABC_COBRO_EFECTIVO'), null);

  -- C5: quitar un permiso a un Encargado (también en lo delicado)
  v2 := pg_temp.c_cfg('C5.1 se quita al Encargado operar caja en CFG-LA2', k_prop, 'cfg5-0300', 'CFG-LA2', 'LOCAL', 'Encargado', 'ABC_CAJA_OPERAR', false, 'Solo cajeros');
  perform pg_temp.ok('C5.2 el Encargado de CFG-LA2 no, el de CFG-LA sí, el Propietario siempre',
    not pg_temp.cap(k_enc, 'CFG-LA2', 'ABC_CAJA_OPERAR') and pg_temp.cap(k_enc, 'CFG-LA', 'ABC_CAJA_OPERAR') and pg_temp.cap(k_prop, 'CFG-LA2', 'ABC_CAJA_OPERAR'), null);
  v2 := pg_temp.c_cfg('C5.3 y también una capacidad delicada', k_prop, 'cfg5-0301', 'CFG-LA2', 'LOCAL', 'Encargado', 'ABC_REEMBOLSO_CONFIRMAR', false, 'Solo el propietario confirma');
  perform pg_temp.ok('C5.4 el Encargado ya no confirma devoluciones en CFG-LA2', not pg_temp.cap(k_enc, 'CFG-LA2', 'ABC_REEMBOLSO_CONFIRMAR') and pg_temp.cap(k_prop, 'CFG-LA2', 'ABC_REEMBOLSO_CONFIRMAR'), null);
  v2 := pg_temp.c_cfg('C5.5 una capacidad de cocina también se configura', k_prop, 'cfg5-0302', 'CFG-LA', 'LOCAL', 'Cajero/a', 'ABC_COMANDA_CAMBIAR', true, 'Cajero cambia comandas');
  perform pg_temp.ok('C5.6 vale para la función de cocina, no para la general', pg_temp.cap(k_caj, 'CFG-LA', 'ABC_COMANDA_CAMBIAR', 'COMANDA') and not pg_temp.cap(k_caj, 'CFG-LA', 'ABC_COMANDA_CAMBIAR', 'GENERAL'), null);
  v2 := pg_temp.c_cfg('C5.7 se deja como estaba', k_prop, 'cfg5-0303', 'CFG-LA2', 'LOCAL', 'Encargado', 'ABC_CAJA_OPERAR', null, 'Fin');
  v2 := pg_temp.c_cfg('C5.8 se deja como estaba (2)', k_prop, 'cfg5-0304', 'CFG-LA2', 'LOCAL', 'Encargado', 'ABC_REEMBOLSO_CONFIRMAR', null, 'Fin');
  perform pg_temp.ok('C5.9 el Encargado de CFG-LA2 vuelve a lo normal', pg_temp.cap(k_enc, 'CFG-LA2', 'ABC_CAJA_OPERAR') and pg_temp.cap(k_enc, 'CFG-LA2', 'ABC_REEMBOLSO_CONFIRMAR'), null);
  v2 := pg_temp.c_cfg('C5.10 quitar siempre se puede, también a un rol que está por encima del techo (el Cajero/a no confirma devoluciones)', k_prop, 'cfg5-0305', 'CFG-LA2', 'LOCAL', 'Cajero/a', 'ABC_REEMBOLSO_CONFIRMAR', false, 'Dejarlo explícito');
  perform pg_temp.ok('C5.11 queda anotado y el Cajero/a sigue sin poder', (v2->>'cambio')::boolean and not pg_temp.cap(k_caj, 'CFG-LA2', 'ABC_REEMBOLSO_CONFIRMAR'), v2);
  v2 := pg_temp.c_cfg('C5.12 y se puede volver a heredar', k_prop, 'cfg5-0306', 'CFG-LA2', 'LOCAL', 'Cajero/a', 'ABC_REEMBOLSO_CONFIRMAR', null, 'Fin');

  -- C6: defensa en la lectura: una fila que supera el techo (escrita a mano) no concede nada
  perform pg_temp.directo('C6.1 se fuerza una fila por encima del techo (solo posible escribiendo directamente en la tabla)',
    format('insert into public.abc_capacidades_rol(empresa_id,local_id,rol,capacidad,permitido,motivo) values (%L,%L,%L,%L,true,%L)', k_e, 'CFG-LA', 'Cajero/a', 'ABC_REEMBOLSO_CONFIRMAR', 'forzado'));
  perform pg_temp.ok('C6.2 aun así el Cajero/a no puede confirmar devoluciones', not pg_temp.cap(k_caj, 'CFG-LA', 'ABC_REEMBOLSO_CONFIRMAR'), null);

  -- C7: auditoría
  select count(*) into v_cnt from public.abc_eventos where empresa_id = k_e and event_type = 'CAPACIDAD_ROL_CONFIGURADA' and operation_id like 'cfg5-%';
  perform pg_temp.ok('C7.1 dieciséis cambios reales dejaron dieciséis eventos (rechazos, replays y repeticiones no)', v_cnt = 16, to_jsonb(v_cnt));
  select payload into v_ev from public.abc_eventos where operation_id = 'cfg5-0102' and event_type = 'CAPACIDAD_ROL_CONFIGURADA';
  perform pg_temp.ok('C7.2 el evento de quitar guarda el valor anterior, el nuevo, el efecto y el motivo',
    v_ev->>'ambito' = 'LOCAL' and (v_ev->>'anterior')::boolean and not (v_ev->>'nuevo')::boolean and (v_ev->>'efectivo_antes')::boolean and not (v_ev->>'efectivo_despues')::boolean
    and v_ev->>'motivo' = 'Ya no' and (v_ev->>'version')::int = 2 and v_ev->>'rol' = 'Cajero/a' and v_ev->>'capacidad' = 'ABC_PEDIDO_CANCELAR' and v_ev->>'local_destino' = 'CFG-LA', v_ev);
  select payload, local_id into v_ev, v_primero from (select payload, to_jsonb(local_id) as local_id from public.abc_eventos where operation_id = 'cfg5-0200' and event_type = 'CAPACIDAD_ROL_CONFIGURADA') q;
  perform pg_temp.ok('C7.3 el evento de empresa queda en el local desde el que se hizo, con ámbito EMPRESA y sin local de destino',
    v_ev->>'ambito' = 'EMPRESA' and v_ev->'local_destino' = 'null'::jsonb and v_primero = to_jsonb('CFG-LA'::text) and v_ev->'anterior' = 'null'::jsonb, v_ev);
  perform pg_temp.ok('C7.4 todos los eventos son del actor que decidió y llevan día operativo',
    not exists (select 1 from public.abc_eventos where operation_id like 'cfg5-%' and event_type = 'CAPACIDAD_ROL_CONFIGURADA' and (actor_user_id <> k_prop::uuid or operating_day is null)), null);

  -- C8: la tabla no se toca directamente
  perform pg_temp.paso('C8.1 la tabla no se puede leer directamente', k_prop, 'select to_jsonb(count(*)) from public.abc_capacidades_rol', 'permission denied');
  perform pg_temp.paso('C8.2 ni escribir directamente', k_prop,
    format('with z as (insert into public.abc_capacidades_rol(empresa_id,local_id,rol,capacidad,permitido,motivo) values (%L,%L,%L,%L,true,%L) returning 1) select to_jsonb(1) from z', k_e, 'CFG-LA', 'Cajero/a', 'ABC_SALA_VER', 'x'), 'permission denied');
  perform pg_temp.ok('C8.3 la tabla tiene activada la seguridad por filas', (select relrowsecurity from pg_class where oid = 'public.abc_capacidades_rol'::regclass), null);
  perform pg_temp.directo('C8.4 la tabla rechaza al Propietario como rol',
    format('insert into public.abc_capacidades_rol(empresa_id,local_id,rol,capacidad,permitido,motivo) values (%L,%L,%L,%L,true,%L)', k_e, 'CFG-LA2', 'Propietario', 'ABC_SALA_VER', 'x'), 'abc_cap_rol_rol');
  perform pg_temp.directo('C8.5 la tabla rechaza un nombre de capacidad con forma rara',
    format('insert into public.abc_capacidades_rol(empresa_id,local_id,rol,capacidad,permitido,motivo) values (%L,%L,%L,%L,true,%L)', k_e, 'CFG-LA2', 'Cajero/a', 'abc_sala_ver', 'x'), 'abc_cap_rol_capacidad');
  perform pg_temp.directo('C8.6 la tabla rechaza un motivo vacío',
    format('insert into public.abc_capacidades_rol(empresa_id,local_id,rol,capacidad,permitido,motivo) values (%L,%L,%L,%L,true,%L)', k_e, 'CFG-LA2', 'Cajero/a', 'ABC_SALA_VER', '  '), 'abc_cap_rol_motivo');
  perform pg_temp.directo('C8.7 la tabla rechaza una decisión de local repetida',
    format('insert into public.abc_capacidades_rol(empresa_id,local_id,rol,capacidad,permitido,motivo) values (%L,%L,%L,%L,true,%L)', k_e, 'CFG-LA', 'Cajero/a', 'ABC_PEDIDO_CANCELAR', 'x'), 'abc_cap_rol_uq');
  perform pg_temp.directo('C8.8 la tabla rechaza una decisión de empresa repetida (local nulo)',
    format('insert into public.abc_capacidades_rol(empresa_id,local_id,rol,capacidad,permitido,motivo) values (%L,null,%L,%L,true,%L)', k_e, 'Cajero/a', 'ABC_MESA_RESERVAR', 'x'), 'abc_cap_rol_uq');
  perform pg_temp.directo('C8.9 la tabla rechaza un local que no existe',
    format('insert into public.abc_capacidades_rol(empresa_id,local_id,rol,capacidad,permitido,motivo) values (%L,%L,%L,%L,true,%L)', k_e, 'CFG-NO-EXISTE', 'Cajero/a', 'ABC_SALA_VER', 'x'), 'abc_cap_rol_local_fk');
  perform pg_temp.directo('C8.10 la tabla rechaza una empresa que no existe',
    format('insert into public.abc_capacidades_rol(empresa_id,local_id,rol,capacidad,permitido,motivo) values (%L,null,%L,%L,true,%L)', 'CFG-EMP-NO', 'Cajero/a', 'ABC_SALA_VER', 'x'), 'abc_cap_rol_empresa_fk');
end
$t$;
-- ==== FIN CHUNK ====

-- ==== CHUNK: reabrir ====
-- D14: reabrir un cierre provisional pasa a exigir ABC_CIERRE_REABRIR (por defecto solo el Propietario).
do $t$
declare
  k_e    constant text := 'CFG-EMP-T';
  k_loc  constant text := 'CFG-LD';
  k_prop constant text := '16c79749-a206-47d9-8d56-fbc7a4a49eb7';
  k_enc  constant text := '5003adca-2e30-477e-8afd-ffb3037b034e';
  k_caj  constant text := 'eb0bca7b-b366-4d72-80e1-0b02e9bdd666';
  v_term uuid;
  v_sql text;
begin
  select id into v_term from public.terminales_tpv where empresa_id = k_e and local_id = k_loc;
  v_sql := format('select public.abc_reabrir_cierre_provisional(%L,%L,%L,gen_random_uuid(),%L::uuid,%L,current_date)', 'cfg5-reab-xx', k_e, k_loc, v_term, 'Revisión');

  perform pg_temp.ok('D1.1 por defecto solo el Propietario puede reabrir', pg_temp.cap(k_prop, k_loc, 'ABC_CIERRE_REABRIR') and not pg_temp.cap(k_enc, k_loc, 'ABC_CIERRE_REABRIR') and not pg_temp.cap(k_caj, k_loc, 'ABC_CIERRE_REABRIR'), null);
  perform pg_temp.ok('D1.2 el Encargado y el Cajero/a siguen operando caja', pg_temp.cap(k_enc, k_loc, 'ABC_CAJA_OPERAR') and pg_temp.cap(k_caj, k_loc, 'ABC_CAJA_OPERAR'), null);

  perform pg_temp.paso('D2.1 el Cajero/a no puede reabrir (antes sí)', k_caj, replace(v_sql, 'cfg5-reab-xx', 'cfg5-reab-01'), 'abc_caja_no_autorizado');
  perform pg_temp.paso('D2.2 el Encargado tampoco, aunque opere caja', k_enc, replace(v_sql, 'cfg5-reab-xx', 'cfg5-reab-02'), 'abc_caja_no_autorizado');
  perform pg_temp.paso('D2.3 el Propietario supera el permiso (después falla porque no hay cierre)', k_prop, replace(v_sql, 'cfg5-reab-xx', 'cfg5-reab-03'), 'cierre_provisional_no_encontrado');
  perform pg_temp.paso('D2.4 sin motivo ni sesión sigue pidiéndose', k_prop,
    format('select public.abc_reabrir_cierre_provisional(%L,%L,%L,null::uuid,%L::uuid,%L,current_date)', 'cfg5-reab-04', k_e, k_loc, v_term, 'x'), 'reapertura_motivo_requerido');

  perform pg_temp.c_cfg('D3.1 el cajero no se puede habilitar (techo)', k_prop, 'cfg5-reab-10', k_loc, 'LOCAL', 'Cajero/a', 'ABC_CIERRE_REABRIR', true, 'x', 'capacidad_fuera_de_techo');
  perform pg_temp.c_cfg('D3.2 el Propietario habilita al Encargado en este local', k_prop, 'cfg5-reab-11', k_loc, 'LOCAL', 'Encargado', 'ABC_CIERRE_REABRIR', true, 'El encargado reabre cierres aquí');
  perform pg_temp.paso('D3.3 ahora el Encargado supera el permiso', k_enc, replace(v_sql, 'cfg5-reab-xx', 'cfg5-reab-05'), 'cierre_provisional_no_encontrado');
  perform pg_temp.paso('D3.4 el Cajero/a sigue sin poder', k_caj, replace(v_sql, 'cfg5-reab-xx', 'cfg5-reab-06'), 'abc_caja_no_autorizado');
  perform pg_temp.c_cfg('D3.5 el Propietario se lo quita (heredar)', k_prop, 'cfg5-reab-12', k_loc, 'LOCAL', 'Encargado', 'ABC_CIERRE_REABRIR', null, 'Vuelve a solo propietario');
  perform pg_temp.paso('D3.6 el Encargado ya no puede', k_enc, replace(v_sql, 'cfg5-reab-xx', 'cfg5-reab-07'), 'abc_caja_no_autorizado');
  perform pg_temp.c_cfg('D3.7 quitar al Encargado, con decisión explícita, también impide', k_prop, 'cfg5-reab-13', k_loc, 'LOCAL', 'Encargado', 'ABC_CIERRE_REABRIR', false, 'Explícito');
  perform pg_temp.paso('D3.8 sigue sin poder', k_enc, replace(v_sql, 'cfg5-reab-xx', 'cfg5-reab-08'), 'abc_caja_no_autorizado');
  perform pg_temp.paso('D3.9 el Propietario nunca lo pierde', k_prop, replace(v_sql, 'cfg5-reab-xx', 'cfg5-reab-09'), 'cierre_provisional_no_encontrado');
end
$t$;
-- ==== FIN CHUNK ====

-- ==== CHUNK: retirados ====
-- Retirada de Churrero/a, Básico y Estándar. Va el último: desactiva el trigger (dentro de la transacción) para fabricar
-- datos antiguos, y lo vuelve a activar antes de terminar.
do $t$
declare
  k_e    constant text := 'CFG-EMP-T';
  k_prop constant text := '16c79749-a206-47d9-8d56-fbc7a4a49eb7';
  k_enc  constant text := '5003adca-2e30-477e-8afd-ffb3037b034e';
  k_caj  constant text := 'eb0bca7b-b366-4d72-80e1-0b02e9bdd666';
  k_otro constant text := '73967f0c-3474-443d-ad83-9f20b94204c3';
  v jsonb; v_n integer; v_id bigint;
begin
  perform pg_temp.ok('R1.0 el trigger de roles retirados existe y está activo',
    (select t.tgenabled = 'O' from pg_trigger t where t.tgrelid = 'public.membresias_usuario'::regclass and t.tgname = 'abc_f6_cfg5_guard_rol_retirado'), null);
  perform pg_temp.directo('R1.1 no se puede dar de alta a nadie como Churrero/a',
    format('insert into public.membresias_usuario(user_id,empresa_id,local_id,todos_locales,rol,activo) values (%L::uuid,%L,%L,false,%L,true)', k_caj, k_e, 'CFG-LR', 'Churrero/a'), 'rol_retirado:Churrero/a');
  perform pg_temp.directo('R1.2 ni como Básico (aunque quede inactivo)',
    format('insert into public.membresias_usuario(user_id,empresa_id,local_id,todos_locales,rol,activo) values (%L::uuid,%L,%L,false,%L,false)', k_caj, k_e, 'CFG-LR2', 'Básico'), 'rol_retirado:Básico');
  perform pg_temp.directo('R1.3 ni como Estándar',
    format('insert into public.membresias_usuario(user_id,empresa_id,local_id,todos_locales,rol,activo) values (%L::uuid,%L,null,true,%L,true)', k_caj, k_e, 'Estándar'), 'rol_retirado:Estándar');
  perform pg_temp.directo('R1.4 no se puede cambiar el rol de una persona a Churrero/a',
    format('update public.membresias_usuario set rol = %L where user_id = %L::uuid and empresa_id = %L and local_id = %L', 'Churrero/a', k_caj, k_e, 'CFG-LR'), 'rol_retirado:Churrero/a');
  perform pg_temp.directo('R1.5 los demás cambios de rol siguen funcionando (Cajero/a a Camarero/a)',
    format('update public.membresias_usuario set rol = %L where user_id = %L::uuid and empresa_id = %L and local_id = %L', 'Camarero/a', k_caj, k_e, 'CFG-LR'));
  perform pg_temp.directo('R1.6 y desactivar y reactivar a quien tiene un rol normal también',
    format('update public.membresias_usuario set activo = false where user_id = %L::uuid and empresa_id = %L and local_id = %L', k_caj, k_e, 'CFG-LR'));
  perform pg_temp.directo('R1.7 reactivar',
    format('update public.membresias_usuario set activo = true where user_id = %L::uuid and empresa_id = %L and local_id = %L', k_caj, k_e, 'CFG-LR'));
  perform pg_temp.ok('R1.8 ninguna alta con rol retirado quedó guardada',
    not exists (select 1 from public.membresias_usuario where empresa_id = k_e and rol in ('Churrero/a', 'Básico', 'Estándar')), null);

  v := pg_temp.c_ret('R2.1 el Propietario lista las personas con rol retirado: ninguna', k_prop, 'CFG-LR');
  perform pg_temp.ok('R2.2 lista vacía y los tres roles nombrados', v->'personas' = '[]'::jsonb and jsonb_array_length(v->'roles_retirados') = 3, v);
  perform pg_temp.c_ret('R2.3 el Encargado no puede', k_enc, 'CFG-LR', 'abc_config_no_autorizado');
  perform pg_temp.c_ret('R2.4 el Propietario de otra empresa no puede', k_otro, 'CFG-LR', 'abc_config_no_autorizado');
  perform pg_temp.paso('R2.5 anon no puede', null, format('select public.abc_listar_roles_retirados(%L,%L)', k_e, 'CFG-LR'), 'permission denied', 'anon');

  -- Datos antiguos: se desactiva el trigger solo para fabricarlos.
  alter table public.membresias_usuario disable trigger abc_f6_cfg5_guard_rol_retirado;
  insert into public.membresias_usuario(user_id, empresa_id, local_id, todos_locales, rol, activo) values
    (k_enc::uuid, k_e, 'CFG-LR2', false, 'Churrero/a', true),
    (k_caj::uuid, k_e, 'CFG-LR2', false, 'Básico', false),
    (k_enc::uuid, k_e, null, true, 'Estándar', true);
  update public.perfiles set nombre = 'Persona con rol antiguo' where user_id = k_enc::uuid;
  alter table public.membresias_usuario enable trigger abc_f6_cfg5_guard_rol_retirado;

  v := pg_temp.c_ret('R3.1 el Propietario ve ahora a las tres personas', k_prop, 'CFG-LR2');
  perform pg_temp.ok('R3.2 tres personas, ordenadas por rol, con su nombre, estado y alcance',
    jsonb_array_length(v->'personas') = 3
    and v->'personas'->0->>'rol' = 'Básico' and not (v->'personas'->0->>'activo')::boolean and v->'personas'->0->>'local_id' = 'CFG-LR2'
    and v->'personas'->1->>'rol' = 'Churrero/a' and (v->'personas'->1->>'activo')::boolean and v->'personas'->1->>'nombre' = 'Persona con rol antiguo'
    and v->'personas'->2->>'rol' = 'Estándar' and (v->'personas'->2->>'todos_locales')::boolean and v->'personas'->2->'local_id' = 'null'::jsonb, v);
  v := pg_temp.c_ret('R3.3 en otro local solo aparece quien lo es de todos los locales', k_prop, 'CFG-LR');
  perform pg_temp.ok('R3.4 una persona (Estándar de todos los locales)', jsonb_array_length(v->'personas') = 1 and v->'personas'->0->>'rol' = 'Estándar', v);
  perform pg_temp.ok('R3.5 quien aún tiene Churrero/a no tiene ninguna capacidad ABC (ni general ni de cocina)',
    (select count(*) from private.abc_cap_catalogo() c where pg_temp.cap(k_enc, 'CFG-LR2', c.capacidad, c.familia)) = 0, null);
  perform pg_temp.directo('R3.6 no se puede reactivar un rol retirado',
    format('update public.membresias_usuario set activo = true where user_id = %L::uuid and empresa_id = %L and local_id = %L and rol = %L', k_caj, k_e, 'CFG-LR2', 'Básico'), 'rol_retirado:Básico');
  perform pg_temp.directo('R3.7 no se puede pasar de un rol retirado a otro',
    format('update public.membresias_usuario set rol = %L where user_id = %L::uuid and empresa_id = %L and local_id = %L', 'Churrero/a', k_caj, k_e, 'CFG-LR2'), 'rol_retirado:Churrero/a');
  perform pg_temp.directo('R3.8 sí se puede reasignar a un rol normal (Básico a Camarero/a)',
    format('update public.membresias_usuario set rol = %L where user_id = %L::uuid and empresa_id = %L and local_id = %L and rol = %L', 'Camarero/a', k_caj, k_e, 'CFG-LR2', 'Básico'));
  perform pg_temp.directo('R3.9 y desactivar a quien tiene un rol retirado',
    format('update public.membresias_usuario set activo = false where user_id = %L::uuid and empresa_id = %L and local_id = %L and rol = %L', k_enc, k_e, 'CFG-LR2', 'Churrero/a'));
  perform pg_temp.directo('R3.10 y cambios que no tocan el rol ni la activación en una persona con rol retirado',
    format('update public.membresias_usuario set updated_at = now() where user_id = %L::uuid and empresa_id = %L and rol = %L', k_enc, k_e, 'Estándar'));
  v := pg_temp.c_ret('R3.11 la lista queda con dos personas (la reasignada ya no sale)', k_prop, 'CFG-LR2');
  perform pg_temp.ok('R3.12 Churrero/a y Estándar', jsonb_array_length(v->'personas') = 2 and v->'personas'->0->>'rol' = 'Churrero/a' and v->'personas'->1->>'rol' = 'Estándar', v);
  perform pg_temp.ok('R3.13 el trigger quedó activo otra vez', (select t.tgenabled = 'O' from pg_trigger t where t.tgrelid = 'public.membresias_usuario'::regclass and t.tgname = 'abc_f6_cfg5_guard_rol_retirado'), null);
end
$t$;
-- ==== FIN CHUNK ====
