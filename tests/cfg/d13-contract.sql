-- D13 · devoluciones: nada sale sin aprobación. Contrato vivo de `abc_solicitar_reembolso`, `abc_aprobar_reembolso`,
-- `abc_cancelar_reembolso` (rechazar) y `abc_confirmar_reembolso_efectivo` tras la migración 20261003100000.
--
-- Se ejecuta DESPUÉS de las migraciones de la pieza 5 (20261002240000) y de D13 (20261003100000), dentro de una transacción que
-- termina en ROLLBACK:
--
--   begin; <este archivo>; select <resumen de la.log>; rollback;
--
-- No depende de los datos de QA: crea su propia empresa (D13-EMP), local, usuarios (membresías), entidad fiscal, ventas, caja y
-- cobros dentro de la transacción. Solo necesita que existan en auth.users cuatro identificadores de usuario (en QA ya existen; en la
-- réplica local los crea tests/cfg/local-fixture.sql). Los actores se suplantan a nivel de base de datos (set local role + claims JWT).
-- Todo se revierte con el ROLLBACK.
--
-- Estructura (para poder partirlo en trozos si la herramienta corta a los 60 s):
--   -- ==== HELPERS ====   funciones auxiliares
--   -- ==== FIXTURE ====   empresa, local, membresías, entidad fiscal, ventas, caja y los dos cobros (tarjeta 20 € y efectivo 10 €)
--   -- ==== CHUNK: nombre ==== ... -- ==== FIN CHUNK ====   bloques de pruebas (se ejecutan en orden: comparten los reembolsos)

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

-- abc_solicitar_reembolso(op, empresa, local, reembolso, pago, importe, motivo, terminal, día)
create function pg_temp.sol(p_nombre text, p_uid text, p_op text, p_reembolso text, p_pago text, p_importe numeric, p_motivo text default 'prueba D13', p_espera text default null) returns jsonb language plpgsql as $f$
begin
  return pg_temp.paso(p_nombre, p_uid,
    format('select public.abc_solicitar_reembolso(%L,%L,%L,%L::uuid,%L::uuid,%L::numeric,%L,%L::uuid,%L::date)',
      p_op, 'D13-EMP', 'D13-L1', p_reembolso, p_pago, p_importe, p_motivo, '90000000-0000-0000-0000-0000000000d1', '2026-09-23'),
    p_espera);
end $f$;

-- abc_aprobar_reembolso(op, empresa, local, reembolso, terminal, día)
create function pg_temp.apr(p_nombre text, p_uid text, p_op text, p_reembolso text, p_espera text default null, p_empresa text default 'D13-EMP', p_local text default 'D13-L1') returns jsonb language plpgsql as $f$
begin
  return pg_temp.paso(p_nombre, p_uid,
    format('select public.abc_aprobar_reembolso(%L,%L,%L,%L::uuid,%L::uuid,%L::date)',
      p_op, p_empresa, p_local, p_reembolso, '90000000-0000-0000-0000-0000000000d1', '2026-09-23'),
    p_espera);
end $f$;

-- abc_cancelar_reembolso(op, empresa, local, reembolso, motivo, terminal, día)  (= rechazar)
create function pg_temp.can(p_nombre text, p_uid text, p_op text, p_reembolso text, p_espera text default null) returns jsonb language plpgsql as $f$
begin
  return pg_temp.paso(p_nombre, p_uid,
    format('select public.abc_cancelar_reembolso(%L,%L,%L,%L::uuid,%L,%L::uuid,%L::date)',
      p_op, 'D13-EMP', 'D13-L1', p_reembolso, 'no procede', '90000000-0000-0000-0000-0000000000d1', '2026-09-23'),
    p_espera);
end $f$;

-- abc_confirmar_reembolso_efectivo(op, empresa, local, reembolso, caja, sesión, terminal, día)
create function pg_temp.efe(p_nombre text, p_uid text, p_op text, p_reembolso text, p_espera text default null) returns jsonb language plpgsql as $f$
begin
  return pg_temp.paso(p_nombre, p_uid,
    format('select public.abc_confirmar_reembolso_efectivo(%L,%L,%L,%L::uuid,%L::uuid,%L::uuid,%L::uuid,%L::date)',
      p_op, 'D13-EMP', 'D13-L1', p_reembolso, '91000000-0000-0000-0000-0000000000d1', '92000000-0000-0000-0000-0000000000d1',
      '90000000-0000-0000-0000-0000000000d1', '2026-09-23'),
    p_espera);
end $f$;

-- abc_configurar_capacidad_rol(operation_id, empresa, local, ambito, rol, capacidad, permitido, motivo)
create function pg_temp.cap(p_nombre text, p_uid text, p_op text, p_rol text, p_cap text, p_permitido boolean, p_espera text default null) returns jsonb language plpgsql as $f$
begin
  return pg_temp.paso(p_nombre, p_uid,
    format('select public.abc_configurar_capacidad_rol(%L,%L,%L,%L,%L,%L,%L::boolean,%L)', p_op, 'D13-EMP', 'D13-L1', 'LOCAL', p_rol, p_cap, p_permitido, 'prueba D13'),
    p_espera);
end $f$;

create function pg_temp.n_efectos(p_reembolso text) returns integer language sql as $f$
  select count(*)::integer from public.efectos_pendientes where empresa_id='D13-EMP' and dedupe_key='reembolso:'||p_reembolso
$f$;
create function pg_temp.n_eventos(p_reembolso text, p_tipo text) returns integer language sql as $f$
  select count(*)::integer from public.abc_eventos where empresa_id='D13-EMP' and aggregate_type='REEMBOLSO' and aggregate_id=p_reembolso and event_type=p_tipo
$f$;
create function pg_temp.reemb(p_reembolso text) returns public.reembolsos language sql as $f$
  select r.* from public.reembolsos r where r.id=p_reembolso::uuid
$f$;
create function pg_temp.disp_pago(p_pago text) returns numeric language sql as $f$
  select coalesce(sum(least(private.abc_max_reembolsable_pago('D13-EMP','D13-L1',a.id), private.abc_max_reembolsable_venta('D13-EMP','D13-L1',a.id))),0)
    from public.pago_aplicaciones a where a.pago_id=p_pago::uuid
$f$;

-- ==== FIXTURE ====
do $t$
declare
  k_e    constant text := 'D13-EMP';
  k_eu   constant text := 'D13-EMP2';
  k_prop constant text := '16c79749-a206-47d9-8d56-fbc7a4a49eb7';  -- Propietario de la empresa de prueba (todos los locales)
  k_enc  constant text := '5003adca-2e30-477e-8afd-ffb3037b034e';  -- Encargado de D13-L1
  k_caj  constant text := 'eb0bca7b-b366-4d72-80e1-0b02e9bdd666';  -- Cajero/a de D13-L1
  k_otro constant text := '73967f0c-3474-443d-ad83-9f20b94204c3';  -- Propietario de OTRA empresa
begin
  insert into public.empresas(id, nombre, activo) values (k_e, 'Empresa prueba D13', true), (k_eu, 'Otra empresa prueba D13', true);
  insert into public.locales(id, empresa_id, nombre, activo) values ('D13-L1', k_e, 'D13-L1', true), ('D13-L2', k_e, 'D13-L2', true), ('D13-LU', k_eu, 'D13-LU', true);
  insert into public.membresias_usuario(user_id, empresa_id, local_id, todos_locales, rol, activo) values
    (k_prop::uuid, k_e, null, true, 'Propietario', true),
    (k_enc::uuid, k_e, 'D13-L1', false, 'Encargado', true),
    (k_caj::uuid, k_e, 'D13-L1', false, 'Cajero/a', true),
    (k_otro::uuid, k_eu, null, true, 'Propietario', true);

  insert into public.entidades_fiscales(id, empresa_id, nombre_legal, identificador_fiscal, country_code, simulada)
    values ('10000000-0000-0000-0000-0000000000d1', k_e, 'Entidad Fiscal D13', 'SIM-D13', 'ES', true);
  insert into public.entidad_fiscal_monedas(empresa_id, entidad_fiscal_id, currency_code, es_principal, activa)
    values (k_e, '10000000-0000-0000-0000-0000000000d1', 'EUR', true, true);
  insert into public.entidad_fiscal_locales(empresa_id, local_id, entidad_fiscal_id, activa)
    values (k_e, 'D13-L1', '10000000-0000-0000-0000-0000000000d1', true);
  insert into public.entidad_fiscal_local_monedas(empresa_id, local_id, entidad_fiscal_id, currency_code, activa)
    values (k_e, 'D13-L1', '10000000-0000-0000-0000-0000000000d1', 'EUR', true);

  insert into public.cuentas_comerciales(id, empresa_id, local_id, currency_code, modalidad, estado, version, created_by, opened_operating_day) values
    ('30000000-0000-0000-0000-0000000000d1', k_e, 'D13-L1', 'EUR', 'MESA', 'ABIERTA', 1, k_prop::uuid, '2026-09-23'),
    ('30000000-0000-0000-0000-0000000000d2', k_e, 'D13-L1', 'EUR', 'MESA', 'ABIERTA', 1, k_prop::uuid, '2026-09-23');
  insert into public.ventas_fiscales(id, empresa_id, local_id, cuenta_id, entidad_fiscal_id, currency_code, estado, version,
      subtotal, descuento_total, impuestos_total, total, snapshot_calculo, created_by, created_operating_day) values
    ('70000000-0000-0000-0000-0000000000d1', k_e, 'D13-L1', '30000000-0000-0000-0000-0000000000d1', '10000000-0000-0000-0000-0000000000d1', 'EUR', 'ABIERTA', 1, 20, 0, 0, 20, '{}', k_prop::uuid, '2026-09-23'),
    ('70000000-0000-0000-0000-0000000000d2', k_e, 'D13-L1', '30000000-0000-0000-0000-0000000000d2', '10000000-0000-0000-0000-0000000000d1', 'EUR', 'ABIERTA', 1, 10, 0, 0, 10, '{}', k_prop::uuid, '2026-09-23');

  insert into public.terminales_tpv(id, empresa_id, local_id, nombre, activo) values ('90000000-0000-0000-0000-0000000000d1', k_e, 'D13-L1', 'TPV D13', true);
  insert into public.cajas_fisicas(id, empresa_id, local_id, nombre, activo) values ('91000000-0000-0000-0000-0000000000d1', k_e, 'D13-L1', 'Caja D13', true);
  insert into public.caja_sesiones(id, empresa_id, local_id, caja_id, estado, version, abierta_at, abierta_por)
    values ('92000000-0000-0000-0000-0000000000d1', k_e, 'D13-L1', '91000000-0000-0000-0000-0000000000d1', 'ABIERTA', 1, now(), k_prop::uuid);
  insert into public.caja_sesion_terminales(id, empresa_id, local_id, session_id, terminal_id, desde)
    values ('93000000-0000-0000-0000-0000000000d1', k_e, 'D13-L1', '92000000-0000-0000-0000-0000000000d1', '90000000-0000-0000-0000-0000000000d1', now());
end $t$;

-- Cobro A: tarjeta 20 € (confirmado por el sistema) y cobro B: efectivo 10 €. Los hace el Propietario.
select pg_temp.paso('fix: checkout A', '16c79749-a206-47d9-8d56-fbc7a4a49eb7',
  $q$select public.abc_abrir_checkout('D13:checkout:A','D13-EMP','D13-L1','40000000-0000-0000-0000-0000000000d1'::uuid,'30000000-0000-0000-0000-0000000000d1'::uuid,array['70000000-0000-0000-0000-0000000000d1'::uuid],'2026-09-23'::date)$q$);
select pg_temp.paso('fix: cobro A tarjeta', '16c79749-a206-47d9-8d56-fbc7a4a49eb7',
  $q$select public.abc_iniciar_cobro('D13:pay:A','D13-EMP','D13-L1','40000000-0000-0000-0000-0000000000d1'::uuid,'50000000-0000-0000-0000-0000000000d1'::uuid,'60000000-0000-0000-0000-0000000000d1'::uuid,'TARJETA',20,'EUR','90000000-0000-0000-0000-0000000000d1'::uuid,null,null)$q$);
select pg_temp.paso('fix: confirmar tarjeta A (sistema)', null,
  $q$select public.abc_resolver_intento('D13:pay:A:confirm','D13-EMP','D13-L1','60000000-0000-0000-0000-0000000000d1'::uuid,'CONFIRMADO','SIM','SIM-PAY-D13-A',20,20,null,'{"source":"fixture"}'::jsonb)$q$, null, 'service_role');
select pg_temp.paso('fix: checkout B', '16c79749-a206-47d9-8d56-fbc7a4a49eb7',
  $q$select public.abc_abrir_checkout('D13:checkout:B','D13-EMP','D13-L1','40000000-0000-0000-0000-0000000000d2'::uuid,'30000000-0000-0000-0000-0000000000d2'::uuid,array['70000000-0000-0000-0000-0000000000d2'::uuid],'2026-09-23'::date)$q$);
select pg_temp.paso('fix: cobro B efectivo', '16c79749-a206-47d9-8d56-fbc7a4a49eb7',
  $q$select public.abc_iniciar_cobro('D13:pay:B','D13-EMP','D13-L1','40000000-0000-0000-0000-0000000000d2'::uuid,'50000000-0000-0000-0000-0000000000d2'::uuid,'60000000-0000-0000-0000-0000000000d2'::uuid,'EFECTIVO',10,'EUR','90000000-0000-0000-0000-0000000000d1'::uuid,20,10)$q$);
select pg_temp.paso('fix: confirmar efectivo B', '16c79749-a206-47d9-8d56-fbc7a4a49eb7',
  $q$select public.abc_confirmar_efectivo('D13:pay:B:confirm','D13-EMP','D13-L1','60000000-0000-0000-0000-0000000000d2'::uuid,'91000000-0000-0000-0000-0000000000d1'::uuid,'92000000-0000-0000-0000-0000000000d1'::uuid,'90000000-0000-0000-0000-0000000000d1'::uuid,'2026-09-23'::date)$q$);

do $t$ begin
  perform pg_temp.ok('fix: el cobro A (tarjeta) está CONFIRMADO y el B (efectivo) también',
    (select count(*) from public.pagos where id in ('50000000-0000-0000-0000-0000000000d1','50000000-0000-0000-0000-0000000000d2') and estado='CONFIRMADO') = 2);
  perform pg_temp.ok('fix: saldo reembolsable inicial: 20 € en la tarjeta y 10 € en el efectivo',
    pg_temp.disp_pago('50000000-0000-0000-0000-0000000000d1') = 20 and pg_temp.disp_pago('50000000-0000-0000-0000-0000000000d2') = 10,
    jsonb_build_object('a', pg_temp.disp_pago('50000000-0000-0000-0000-0000000000d1'), 'b', pg_temp.disp_pago('50000000-0000-0000-0000-0000000000d2')));
end $t$;

-- ==== CHUNK: catalogo ====
do $t$
declare r record;
begin
  select * into r from private.abc_cap_catalogo() where capacidad='ABC_REEMBOLSO_SOLICITAR';
  perform pg_temp.ok('C1 SOLICITAR: plantilla Propietario sí, Encargado sí, Cajero/a no, Camarero/a no; techo CAJERO',
    r.propietario and r.encargado and not r.cajero and not r.camarero and r.techo = 'CAJERO', to_jsonb(r));
  select * into r from private.abc_cap_catalogo() where capacidad='ABC_REEMBOLSO_CONFIRMAR';
  perform pg_temp.ok('C2 CONFIRMAR: plantilla Propietario sí, Encargado sí, Cajero/a no; techo ENCARGADO (sin cambios)',
    r.propietario and r.encargado and not r.cajero and not r.camarero and r.techo = 'ENCARGADO', to_jsonb(r));
  perform pg_temp.ok('C3 el techo CAJERO permite Propietario, Encargado y Cajero/a y no Camarero/a',
    private.abc_cap_techo_permite('CAJERO','Propietario') and private.abc_cap_techo_permite('CAJERO','Encargado')
    and private.abc_cap_techo_permite('CAJERO','Cajero/a') and not private.abc_cap_techo_permite('CAJERO','Camarero/a'));
  perform pg_temp.ok('C4 los techos de siempre no cambian (TODOS, ENCARGADO, PROPIETARIO, desconocido)',
    private.abc_cap_techo_permite('TODOS','Camarero/a') and not private.abc_cap_techo_permite('ENCARGADO','Cajero/a')
    and private.abc_cap_techo_permite('ENCARGADO','Encargado') and not private.abc_cap_techo_permite('PROPIETARIO','Encargado')
    and not private.abc_cap_techo_permite('LO_QUE_SEA','Propietario'));
  perform pg_temp.ok('C5 el resto del catálogo no cambia: 31 capacidades y solo SOLICITAR tiene techo CAJERO',
    (select count(*) from private.abc_cap_catalogo()) = 31 and (select count(*) from private.abc_cap_catalogo() where techo='CAJERO') = 1);
  perform pg_temp.ok('C6 la capacidad efectiva por defecto del Cajero/a para SOLICITAR y CONFIRMAR es no',
    not private.abc_cap_efectiva('D13-EMP','D13-L1','Cajero/a','ABC_REEMBOLSO_SOLICITAR','GENERAL')
    and not private.abc_cap_efectiva('D13-EMP','D13-L1','Cajero/a','ABC_REEMBOLSO_CONFIRMAR','GENERAL'));
end $t$;
-- ==== FIN CHUNK ====

-- ==== CHUNK: permisos ====
select pg_temp.sol('P1 el Cajero/a sin el permiso no puede solicitar (por defecto)', 'eb0bca7b-b366-4d72-80e1-0b02e9bdd666', 'D13:req:caj0', '8d000000-0000-0000-0000-000000000900', '50000000-0000-0000-0000-0000000000d1', 1, 'prueba', 'abc_reembolso_no_autorizado');
select pg_temp.cap('P2 el Propietario NO puede dar CONFIRMAR al Cajero/a (techo Encargado)', '16c79749-a206-47d9-8d56-fbc7a4a49eb7', 'D13:cap:caj-conf', 'Cajero/a', 'ABC_REEMBOLSO_CONFIRMAR', true, 'capacidad_fuera_de_techo');
select pg_temp.cap('P3 el Propietario NO puede dar SOLICITAR al Camarero/a (techo Cajero/a)', '16c79749-a206-47d9-8d56-fbc7a4a49eb7', 'D13:cap:cam-sol', 'Camarero/a', 'ABC_REEMBOLSO_SOLICITAR', true, 'capacidad_fuera_de_techo');
select pg_temp.cap('P4 un Encargado NO puede dar permisos (solo el Propietario)', '5003adca-2e30-477e-8afd-ffb3037b034e', 'D13:cap:enc', 'Cajero/a', 'ABC_REEMBOLSO_SOLICITAR', true, 'no_autorizado');
select pg_temp.cap('P5 el Propietario SÍ puede dar SOLICITAR al Cajero/a en D13-L1', '16c79749-a206-47d9-8d56-fbc7a4a49eb7', 'D13:cap:caj-sol', 'Cajero/a', 'ABC_REEMBOLSO_SOLICITAR', true);
do $t$ begin
  perform pg_temp.ok('P6 ahora el Cajero/a tiene SOLICITAR y sigue sin CONFIRMAR',
    private.abc_cap_efectiva('D13-EMP','D13-L1','Cajero/a','ABC_REEMBOLSO_SOLICITAR','GENERAL') and not private.abc_cap_efectiva('D13-EMP','D13-L1','Cajero/a','ABC_REEMBOLSO_CONFIRMAR','GENERAL'));
end $t$;
-- ==== FIN CHUNK ====

-- ==== CHUNK: auto ====
-- Encargado y Propietario: se aprueba en el acto y, como hasta ahora, el envío del pago con tarjeta se encola en el acto.
do $t$
declare v jsonb; r public.reembolsos;
begin
  v := pg_temp.sol('A1 el Encargado solicita 5 € de la tarjeta', '5003adca-2e30-477e-8afd-ffb3037b034e', 'D13:req:enc1', '8d000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-0000000000d1', 5);
  r := pg_temp.reemb('8d000000-0000-0000-0000-000000000001');
  perform pg_temp.ok('A2 queda PENDIENTE y aprobada por él mismo en el acto', r.estado = 'PENDIENTE' and r.aprobado_por = '5003adca-2e30-477e-8afd-ffb3037b034e'::uuid and r.aprobado_at is not null, to_jsonb(r));
  perform pg_temp.ok('A3 el resultado dice requiere_aprobacion=false y aprobado=true', (v->>'requiere_aprobacion') = 'false' and (v->>'aprobado') = 'true' and v->>'estado' = 'PENDIENTE', v);
  perform pg_temp.ok('A4 se encola UN envío al proveedor (como siempre)', pg_temp.n_efectos('8d000000-0000-0000-0000-000000000001') = 1);
  perform pg_temp.ok('A5 hay un evento SOLICITADO (requiere_aprobacion=false) y uno APROBADO (automatica=true)',
    pg_temp.n_eventos('8d000000-0000-0000-0000-000000000001','REEMBOLSO_SOLICITADO') = 1 and pg_temp.n_eventos('8d000000-0000-0000-0000-000000000001','REEMBOLSO_APROBADO') = 1
    and (select (payload->>'requiere_aprobacion') from public.abc_eventos where aggregate_id='8d000000-0000-0000-0000-000000000001' and event_type='REEMBOLSO_SOLICITADO') = 'false'
    and (select (payload->>'automatica') from public.abc_eventos where aggregate_id='8d000000-0000-0000-0000-000000000001' and event_type='REEMBOLSO_APROBADO') = 'true');
  perform pg_temp.ok('A6 el efecto lleva el reembolso, el pago, el importe, la moneda, el motivo, el terminal y el día',
    (select payload ?& array['reembolso_id','pago_id','importe','currency_code','motivo','terminal_id','operating_day'] and payload->>'reembolso_id' = '8d000000-0000-0000-0000-000000000001' and (payload->>'importe')::numeric = 5
       from public.efectos_pendientes where empresa_id='D13-EMP' and dedupe_key='reembolso:8d000000-0000-0000-0000-000000000001'));
  v := pg_temp.sol('A7 repetir la misma solicitud (misma operación) no duplica nada', '5003adca-2e30-477e-8afd-ffb3037b034e', 'D13:req:enc1', '8d000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-0000000000d1', 5);
  perform pg_temp.ok('A8 sigue habiendo un reembolso, un envío y un evento de cada', (select count(*) from public.reembolsos where id='8d000000-0000-0000-0000-000000000001') = 1
    and pg_temp.n_efectos('8d000000-0000-0000-0000-000000000001') = 1 and pg_temp.n_eventos('8d000000-0000-0000-0000-000000000001','REEMBOLSO_APROBADO') = 1);
  v := pg_temp.sol('A9 el Propietario solicita 3 € de la tarjeta', '16c79749-a206-47d9-8d56-fbc7a4a49eb7', 'D13:req:prop1', '8d000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-0000000000d1', 3);
  r := pg_temp.reemb('8d000000-0000-0000-0000-000000000002');
  perform pg_temp.ok('A10 también se aprueba en el acto y se encola el envío', r.aprobado_por = '16c79749-a206-47d9-8d56-fbc7a4a49eb7'::uuid and r.aprobado_at is not null and pg_temp.n_efectos('8d000000-0000-0000-0000-000000000002') = 1);
  perform pg_temp.ok('A11 el saldo de la tarjeta baja a 12 € (20 − 5 − 3 reservados)', pg_temp.disp_pago('50000000-0000-0000-0000-0000000000d1') = 12, jsonb_build_object('disp', pg_temp.disp_pago('50000000-0000-0000-0000-0000000000d1')));
end $t$;
-- ==== FIN CHUNK ====

-- ==== CHUNK: cajero ====
-- El Cajero/a solicita: queda pendiente de aprobación y NO sale nada.
do $t$
declare v jsonb; r public.reembolsos;
begin
  v := pg_temp.sol('K1 el Cajero/a (con el permiso) solicita 4 € de la tarjeta', 'eb0bca7b-b366-4d72-80e1-0b02e9bdd666', 'D13:req:caj1', '8d000000-0000-0000-0000-000000000003', '50000000-0000-0000-0000-0000000000d1', 4);
  r := pg_temp.reemb('8d000000-0000-0000-0000-000000000003');
  perform pg_temp.ok('K2 queda PENDIENTE y SIN aprobar', r.estado = 'PENDIENTE' and r.aprobado_por is null and r.aprobado_at is null and r.created_by = 'eb0bca7b-b366-4d72-80e1-0b02e9bdd666'::uuid, to_jsonb(r));
  perform pg_temp.ok('K3 el resultado dice requiere_aprobacion=true y aprobado=false', (v->>'requiere_aprobacion') = 'true' and (v->>'aprobado') = 'false', v);
  perform pg_temp.ok('K4 NO se encola ningún envío al proveedor', pg_temp.n_efectos('8d000000-0000-0000-0000-000000000003') = 0);
  perform pg_temp.ok('K5 hay evento SOLICITADO con requiere_aprobacion=true y NO hay evento APROBADO',
    pg_temp.n_eventos('8d000000-0000-0000-0000-000000000003','REEMBOLSO_SOLICITADO') = 1 and pg_temp.n_eventos('8d000000-0000-0000-0000-000000000003','REEMBOLSO_APROBADO') = 0
    and (select (payload->>'requiere_aprobacion') from public.abc_eventos where aggregate_id='8d000000-0000-0000-0000-000000000003' and event_type='REEMBOLSO_SOLICITADO') = 'true');
  perform pg_temp.ok('K6 el saldo ya está reservado: baja a 8 € (12 − 4)', pg_temp.disp_pago('50000000-0000-0000-0000-0000000000d1') = 8, jsonb_build_object('disp', pg_temp.disp_pago('50000000-0000-0000-0000-0000000000d1')));
  v := pg_temp.sol('K7 repetir la solicitud del Cajero/a no duplica nada', 'eb0bca7b-b366-4d72-80e1-0b02e9bdd666', 'D13:req:caj1', '8d000000-0000-0000-0000-000000000003', '50000000-0000-0000-0000-0000000000d1', 4);
  perform pg_temp.ok('K8 sigue sin aprobar y sin envío', (pg_temp.reemb('8d000000-0000-0000-0000-000000000003')).aprobado_at is null and pg_temp.n_efectos('8d000000-0000-0000-0000-000000000003') = 0
    and (select count(*) from public.reembolsos where id='8d000000-0000-0000-0000-000000000003') = 1);
end $t$;
select pg_temp.apr('K9 el Cajero/a no puede aprobar (ni la suya ni ninguna: no tiene el permiso)', 'eb0bca7b-b366-4d72-80e1-0b02e9bdd666', 'D13:apr:caj1', '8d000000-0000-0000-0000-000000000003', 'abc_aprobar_reembolso_no_autorizado');
select pg_temp.can('K10 el Cajero/a no puede rechazar (cancelar) tampoco', 'eb0bca7b-b366-4d72-80e1-0b02e9bdd666', 'D13:can:caj1', '8d000000-0000-0000-0000-000000000003', 'abc_cancelar_reembolso_no_autorizado');
select pg_temp.efe('K11 el Cajero/a no puede confirmar efectivo (no tiene CONFIRMAR)', 'eb0bca7b-b366-4d72-80e1-0b02e9bdd666', 'D13:efe:caj1', '8d000000-0000-0000-0000-000000000003', 'abc_confirmar_reembolso_no_autorizado');
select pg_temp.sol('K12 el Cajero/a sigue sujeto a las guardas de siempre: no más del saldo (8 €)', 'eb0bca7b-b366-4d72-80e1-0b02e9bdd666', 'D13:req:caj-exceso', '8d000000-0000-0000-0000-000000000901', '50000000-0000-0000-0000-0000000000d1', 8.01, 'prueba', 'saldo_reembolsable_insuficiente');
select pg_temp.sol('K13 …ni sin motivo', 'eb0bca7b-b366-4d72-80e1-0b02e9bdd666', 'D13:req:caj-sinmotivo', '8d000000-0000-0000-0000-000000000902', '50000000-0000-0000-0000-0000000000d1', 1, '   ', 'motivo_reembolso_requerido');
-- ==== FIN CHUNK ====

-- ==== CHUNK: aprobar ====
do $t$
declare v jsonb; r public.reembolsos; v2 jsonb;
begin
  -- Separación de funciones: una solicitud sin aprobar creada por un Encargado (caso forzado) no la aprueba él mismo.
  update public.reembolsos set aprobado_por = null, aprobado_at = null where id = '8d000000-0000-0000-0000-000000000002';
  update public.reembolsos set created_by = '5003adca-2e30-477e-8afd-ffb3037b034e'::uuid where id = '8d000000-0000-0000-0000-000000000002';
  perform pg_temp.apr('S1 un Encargado no aprueba una solicitud que hizo él mismo', '5003adca-2e30-477e-8afd-ffb3037b034e', 'D13:apr:self', '8d000000-0000-0000-0000-000000000002', 'reembolso_aprobador_distinto_solicitante');
  perform pg_temp.ok('S2 y la solicitud sigue sin aprobar', (pg_temp.reemb('8d000000-0000-0000-0000-000000000002')).aprobado_at is null);
  -- Lo restauramos como estaba (aprobada por el Propietario, que es quien la había hecho).
  update public.reembolsos set created_by = '16c79749-a206-47d9-8d56-fbc7a4a49eb7'::uuid, aprobado_por = '16c79749-a206-47d9-8d56-fbc7a4a49eb7'::uuid, aprobado_at = created_at where id = '8d000000-0000-0000-0000-000000000002';

  -- El Encargado aprueba la del Cajero/a.
  v := pg_temp.apr('B1 el Encargado aprueba la solicitud del Cajero/a', '5003adca-2e30-477e-8afd-ffb3037b034e', 'D13:apr:caj1', '8d000000-0000-0000-0000-000000000003');
  r := pg_temp.reemb('8d000000-0000-0000-0000-000000000003');
  perform pg_temp.ok('B2 queda aprobada por el Encargado y sigue PENDIENTE', r.aprobado_por = '5003adca-2e30-477e-8afd-ffb3037b034e'::uuid and r.aprobado_at is not null and r.estado = 'PENDIENTE', to_jsonb(r));
  perform pg_temp.ok('B3 el resultado dice aprobado=true', (v->>'aprobado') = 'true' and v->>'estado' = 'PENDIENTE', v);
  perform pg_temp.ok('B4 AHORA se encola el envío (uno solo)', pg_temp.n_efectos('8d000000-0000-0000-0000-000000000003') = 1);
  perform pg_temp.ok('B5 evento APROBADO con automatica=false y quién la había solicitado',
    pg_temp.n_eventos('8d000000-0000-0000-0000-000000000003','REEMBOLSO_APROBADO') = 1
    and (select payload->>'automatica' from public.abc_eventos where aggregate_id='8d000000-0000-0000-0000-000000000003' and event_type='REEMBOLSO_APROBADO') = 'false'
    and (select payload->>'solicitado_por' from public.abc_eventos where aggregate_id='8d000000-0000-0000-0000-000000000003' and event_type='REEMBOLSO_APROBADO') = 'eb0bca7b-b366-4d72-80e1-0b02e9bdd666'
    and (select actor_user_id from public.abc_eventos where aggregate_id='8d000000-0000-0000-0000-000000000003' and event_type='REEMBOLSO_APROBADO') = '5003adca-2e30-477e-8afd-ffb3037b034e'::uuid);
  perform pg_temp.ok('B6 el envío lleva los mismos datos que si se hubiera aprobado al solicitar',
    (select payload ?& array['reembolso_id','pago_id','importe','currency_code','motivo','terminal_id','operating_day'] and (payload->>'importe')::numeric = 4 and payload->>'currency_code' = 'EUR'
       from public.efectos_pendientes where empresa_id='D13-EMP' and dedupe_key='reembolso:8d000000-0000-0000-0000-000000000003'));
  v2 := pg_temp.apr('B7 repetir la misma aprobación (misma operación) devuelve lo mismo y no duplica', '5003adca-2e30-477e-8afd-ffb3037b034e', 'D13:apr:caj1', '8d000000-0000-0000-0000-000000000003');
  perform pg_temp.ok('B8 sigue habiendo un envío y un evento APROBADO', pg_temp.n_efectos('8d000000-0000-0000-0000-000000000003') = 1 and pg_temp.n_eventos('8d000000-0000-0000-0000-000000000003','REEMBOLSO_APROBADO') = 1 and v2 = v);
  perform pg_temp.apr('B9 aprobarla otra vez con otra operación: ya aprobada', '5003adca-2e30-477e-8afd-ffb3037b034e', 'D13:apr:caj1:otra', '8d000000-0000-0000-0000-000000000003', 'reembolso_ya_aprobado');
  perform pg_temp.apr('B10 aprobar una solicitud que ya se aprobó sola (la del Encargado) también es «ya aprobada»', '16c79749-a206-47d9-8d56-fbc7a4a49eb7', 'D13:apr:enc1', '8d000000-0000-0000-0000-000000000001', 'reembolso_ya_aprobado');
  perform pg_temp.apr('B11 aprobar algo que no existe', '5003adca-2e30-477e-8afd-ffb3037b034e', 'D13:apr:nada', '8d000000-0000-0000-0000-0000000009ff', 'reembolso_no_encontrado');
  perform pg_temp.apr('B12 el Propietario de OTRA empresa no puede aprobar', '73967f0c-3474-443d-ad83-9f20b94204c3', 'D13:apr:otra', '8d000000-0000-0000-0000-000000000003', 'abc_aprobar_reembolso_no_autorizado');
  perform pg_temp.paso('B13 el rol anon tampoco (sin permiso de ejecución)', null,
    format('select public.abc_aprobar_reembolso(%L,%L,%L,%L::uuid,%L::uuid,%L::date)', 'D13:apr:anon', 'D13-EMP', 'D13-L1', '8d000000-0000-0000-0000-000000000003', '90000000-0000-0000-0000-0000000000d1', '2026-09-23'),
    'permission denied', 'anon');
  perform pg_temp.ok('B14 el efecto sigue siendo uno solo tras todos esos intentos', pg_temp.n_efectos('8d000000-0000-0000-0000-000000000003') = 1);
end $t$;
-- ==== FIN CHUNK ====

-- ==== CHUNK: rechazar ====
do $t$
declare v jsonb; r public.reembolsos; antes numeric;
begin
  v := pg_temp.sol('R1 el Cajero/a solicita 3 € más de la tarjeta', 'eb0bca7b-b366-4d72-80e1-0b02e9bdd666', 'D13:req:caj2', '8d000000-0000-0000-0000-000000000004', '50000000-0000-0000-0000-0000000000d1', 3);
  antes := pg_temp.disp_pago('50000000-0000-0000-0000-0000000000d1');
  perform pg_temp.ok('R2 queda sin aprobar, sin envío y con el saldo reservado (4 €)', (pg_temp.reemb('8d000000-0000-0000-0000-000000000004')).aprobado_at is null and pg_temp.n_efectos('8d000000-0000-0000-0000-000000000004') = 0 and antes = 5, jsonb_build_object('disp', antes));
  v := pg_temp.can('R3 el Encargado la rechaza (cancelar) con motivo', '5003adca-2e30-477e-8afd-ffb3037b034e', 'D13:can:caj2', '8d000000-0000-0000-0000-000000000004');
  r := pg_temp.reemb('8d000000-0000-0000-0000-000000000004');
  perform pg_temp.ok('R4 queda CANCELADO, nunca se aprobó y no se encoló nada', r.estado = 'CANCELADO' and r.aprobado_at is null and pg_temp.n_efectos('8d000000-0000-0000-0000-000000000004') = 0, to_jsonb(r));
  perform pg_temp.ok('R5 el saldo reservado se libera (vuelve a 8 €)', pg_temp.disp_pago('50000000-0000-0000-0000-0000000000d1') = 8, jsonb_build_object('disp', pg_temp.disp_pago('50000000-0000-0000-0000-0000000000d1')));
  perform pg_temp.ok('R6 evento CANCELADO y ningún APROBADO', pg_temp.n_eventos('8d000000-0000-0000-0000-000000000004','REEMBOLSO_CANCELADO') = 1 and pg_temp.n_eventos('8d000000-0000-0000-0000-000000000004','REEMBOLSO_APROBADO') = 0);
  perform pg_temp.apr('R7 una solicitud rechazada ya no se puede aprobar', '5003adca-2e30-477e-8afd-ffb3037b034e', 'D13:apr:caj2', '8d000000-0000-0000-0000-000000000004', 'reembolso_no_aprobable');
end $t$;
-- ==== FIN CHUNK ====

-- ==== CHUNK: efectivo ====
do $t$
declare v jsonb; r public.reembolsos;
begin
  v := pg_temp.sol('E1 el Cajero/a solicita 6 € del cobro en efectivo', 'eb0bca7b-b366-4d72-80e1-0b02e9bdd666', 'D13:req:caj-efe', '8d000000-0000-0000-0000-000000000005', '50000000-0000-0000-0000-0000000000d2', 6);
  perform pg_temp.ok('E2 queda sin aprobar y no hay envío (efectivo: nunca lo hay)', (pg_temp.reemb('8d000000-0000-0000-0000-000000000005')).aprobado_at is null and pg_temp.n_efectos('8d000000-0000-0000-0000-000000000005') = 0 and (v->>'requiere_aprobacion') = 'true');
  perform pg_temp.efe('E3 el Encargado NO puede sacar el efectivo de la caja si no está aprobado', '5003adca-2e30-477e-8afd-ffb3037b034e', 'D13:efe:sin-apr', '8d000000-0000-0000-0000-000000000005', 'reembolso_pendiente_aprobacion');
  perform pg_temp.ok('E4 y no se ha movido nada: sigue PENDIENTE y sin movimiento de caja', (pg_temp.reemb('8d000000-0000-0000-0000-000000000005')).estado = 'PENDIENTE'
    and (select count(*) from public.caja_operaciones where tipo='REEMBOLSO' and origen_id='8d000000-0000-0000-0000-000000000005') = 0);
  v := pg_temp.apr('E5 el Encargado la aprueba', '5003adca-2e30-477e-8afd-ffb3037b034e', 'D13:apr:caj-efe', '8d000000-0000-0000-0000-000000000005');
  perform pg_temp.ok('E6 aprobada y sin ningún envío al proveedor (es efectivo)', (pg_temp.reemb('8d000000-0000-0000-0000-000000000005')).aprobado_at is not null and pg_temp.n_efectos('8d000000-0000-0000-0000-000000000005') = 0);
  v := pg_temp.efe('E7 ahora el Encargado confirma el efectivo', '5003adca-2e30-477e-8afd-ffb3037b034e', 'D13:efe:caj-efe', '8d000000-0000-0000-0000-000000000005');
  r := pg_temp.reemb('8d000000-0000-0000-0000-000000000005');
  perform pg_temp.ok('E8 queda CONFIRMADO con UN movimiento negativo de caja de −6 €', r.estado = 'CONFIRMADO'
    and (select count(*) from public.caja_operaciones where tipo='REEMBOLSO' and origen_id='8d000000-0000-0000-0000-000000000005' and efecto_efectivo = -6) = 1, to_jsonb(r));
  -- Encargado: se aprueba en el acto, y confirmar efectivo funciona directamente, como antes.
  v := pg_temp.sol('E9 el Encargado solicita los 4 € que quedan del efectivo', '5003adca-2e30-477e-8afd-ffb3037b034e', 'D13:req:enc-efe', '8d000000-0000-0000-0000-000000000006', '50000000-0000-0000-0000-0000000000d2', 4);
  perform pg_temp.ok('E10 se aprueba en el acto', (pg_temp.reemb('8d000000-0000-0000-0000-000000000006')).aprobado_por = '5003adca-2e30-477e-8afd-ffb3037b034e'::uuid and pg_temp.n_efectos('8d000000-0000-0000-0000-000000000006') = 0);
  v := pg_temp.efe('E11 y confirma el efectivo sin pasos extra', '5003adca-2e30-477e-8afd-ffb3037b034e', 'D13:efe:enc-efe', '8d000000-0000-0000-0000-000000000006');
  perform pg_temp.ok('E12 queda CONFIRMADO y el pago en efectivo REEMBOLSADO', (pg_temp.reemb('8d000000-0000-0000-0000-000000000006')).estado = 'CONFIRMADO'
    and (select estado from public.pagos where id='50000000-0000-0000-0000-0000000000d2') = 'REEMBOLSADO');
  perform pg_temp.apr('E13 no se puede aprobar un efectivo ya confirmado', '5003adca-2e30-477e-8afd-ffb3037b034e', 'D13:apr:tarde', '8d000000-0000-0000-0000-000000000006', 'reembolso_no_aprobable');
end $t$;
-- ==== FIN CHUNK ====

-- ==== CHUNK: acl ====
do $t$ begin
  perform pg_temp.ok('L1 abc_aprobar_reembolso: solo ejecutable por authenticated (no anon, no public, no service_role)',
    has_function_privilege('authenticated','public.abc_aprobar_reembolso(text,text,text,uuid,uuid,date)','execute')
    and not has_function_privilege('anon','public.abc_aprobar_reembolso(text,text,text,uuid,uuid,date)','execute')
    and not has_function_privilege('service_role','public.abc_aprobar_reembolso(text,text,text,uuid,uuid,date)','execute'));
  perform pg_temp.ok('L2 las funciones que se reemplazaron conservan sus permisos (solicitar y confirmar efectivo: authenticated; no anon)',
    has_function_privilege('authenticated','public.abc_solicitar_reembolso(text,text,text,uuid,uuid,numeric,text,uuid,date)','execute')
    and not has_function_privilege('anon','public.abc_solicitar_reembolso(text,text,text,uuid,uuid,numeric,text,uuid,date)','execute')
    and has_function_privilege('authenticated','public.abc_confirmar_reembolso_efectivo(text,text,text,uuid,uuid,uuid,uuid,date)','execute')
    and not has_function_privilege('anon','public.abc_confirmar_reembolso_efectivo(text,text,text,uuid,uuid,uuid,uuid,date)','execute'));
  perform pg_temp.ok('L3 abc_resolver_reembolso sigue siendo solo del sistema (service_role) y no de authenticated',
    has_function_privilege('service_role','public.abc_resolver_reembolso(text,text,text,uuid,text,text,text,jsonb,date)','execute')
    and not has_function_privilege('authenticated','public.abc_resolver_reembolso(text,text,text,uuid,text,text,text,jsonb,date)','execute'));
  perform pg_temp.ok('L4 las dos columnas nuevas son las dos o ninguna (restricción)',
    exists(select 1 from pg_constraint where conrelid='public.reembolsos'::regclass and conname='abc_d13_reembolso_aprobacion_par'));
  perform pg_temp.ok('L5 las funciones siguen siendo SECURITY DEFINER con search_path vacío',
    (select count(*) from pg_proc p where p.oid in ('public.abc_aprobar_reembolso(text,text,text,uuid,uuid,date)'::regprocedure,
        'public.abc_solicitar_reembolso(text,text,text,uuid,uuid,numeric,text,uuid,date)'::regprocedure,
        'public.abc_confirmar_reembolso_efectivo(text,text,text,uuid,uuid,uuid,uuid,date)'::regprocedure)
        and p.prosecdef and exists(select 1 from unnest(coalesce(p.proconfig, array[]::text[])) c where c = 'search_path=""')) = 3);
end $t$;
-- ==== FIN CHUNK ====
