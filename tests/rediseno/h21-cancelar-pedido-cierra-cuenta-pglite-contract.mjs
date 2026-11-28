/**
 * Contrato PGlite de la migración
 *   supabase/migrations/20261127100000_abc_f5_cancelar_pedido_cierra_cuenta_vacia.sql
 *
 *   node tests/rediseno/h21-cancelar-pedido-cierra-cuenta-pglite-contract.mjs
 *
 * Hallazgos H-21 y H-42 de la auditoría del TPV (26/11/2026), decisión del usuario el 27/11/2026:
 * «Cancelar pedido» dejaba el pedido y sus líneas CANCELADOS pero la cuenta comercial ABIERTA, sin líneas
 * activas. Esas cuentas se acumulaban en «Cuentas abiertas» (94 en QA) y al retomarlas no quedaban activas.
 *
 * Qué se fija:
 *   1. Al cancelar el ÚLTIMO pedido vivo de una cuenta que no tiene nada más (ventas fiscales, cobros,
 *      repartos, cuotas), la cuenta se cierra (CERRADA, versión +1, evento CUENTA_CERRADA_SIN_PEDIDOS) y el
 *      resultado lo dice.
 *   2. NO se cierra si la cuenta conserva otro pedido no cancelado, una venta fiscal viva, un checkout, un
 *      reparto o una cuota viva (como origen o destino) o está ya cerrada.
 *   3. La migración parchea la definición viva, es idempotente y falla en voz alta si no encuentra la forma esperada.
 *
 * El esquema es un andamio con las columnas que usa la función y el texto ORIGINAL de abc_cancelar_pedido.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';

const raiz = path.resolve(fileURLToPath(new URL('../../', import.meta.url)));
const { PGlite } = await import(
  new URL('file://' + path.join(raiz, 'tests/f3/a09/node_modules/@electric-sql/pglite/dist/index.js').replace(/\\/g, '/'))
);
const MIG = await readFile(path.join(raiz, 'supabase/migrations/20261127100000_abc_f5_cancelar_pedido_cierra_cuenta_vacia.sql'), 'utf8');

let fallos = 0;
function check(nombre, ok, detalle = '') {
  if (!ok) fallos++;
  console.log(`${ok ? '[OK]  ' : '[FAIL]'} ${nombre}${detalle ? ' — ' + detalle : ''}`);
}
async function intenta(db, sql) {
  try { return { ok: true, filas: (await db.query(sql)).rows }; }
  catch (e) { return { ok: false, error: String(e && (e.message || e)) }; }
}

const ANDAMIO = `
  create schema if not exists private;
  create schema if not exists auth;
  create function auth.uid() returns uuid language sql stable as $$ select '11111111-1111-4111-8111-111111111111'::uuid $$;
  create function private.abc_tiene_capacidad(a text, b text, c text) returns boolean language sql stable as $$ select true $$;
  create function private.abc_terminal_sesion_operativa(a text, b text, c uuid, d uuid) returns boolean language sql stable as $$ select true $$;
  create function private.abc_operacion_iniciar(op text, e text, l text, t text, r jsonb, term uuid) returns jsonb language sql as $$ select jsonb_build_object('replayed', false) $$;
  create function private.abc_operacion_completar(op text, r jsonb) returns void language sql as $$ select 1 $$;
  create function private.abc_registrar_transicion_pedido(e text, l text, p uuid, op text, a text, b text, m text, u uuid, t uuid, s uuid, d date, md jsonb) returns void language sql as $$ select 1 $$;

  create table public.cuentas_comerciales (id uuid primary key, empresa_id text, local_id text, estado text, version bigint default 1, closed_at timestamptz);
  create table public.pedidos_tpv (id uuid primary key, empresa_id text, local_id text, cuenta_id uuid, estado text, version bigint default 1, created_operating_day date, closed_at timestamptz);
  create table public.pedido_lineas (id uuid primary key, empresa_id text, local_id text, pedido_id uuid, estado text, version bigint default 1);
  create table public.pedido_linea_transiciones (empresa_id text, local_id text, pedido_id uuid, linea_id uuid, operation_id text, estado_anterior text, estado_nuevo text, motivo text, actor_user_id uuid, terminal_id uuid, session_id uuid, occurred_at timestamptz, operating_day date, metadata jsonb);
  create table public.ventas_fiscales (id uuid primary key default gen_random_uuid(), empresa_id text, local_id text, cuenta_id uuid, estado text);
  create table public.checkouts (id uuid primary key default gen_random_uuid(), empresa_id text, local_id text, cuenta_id uuid, estado text);
  create table public.cuenta_linea_repartos (id uuid primary key default gen_random_uuid(), empresa_id text, local_id text, source_line_id uuid, cuenta_id uuid, estado text);
  create table public.cuenta_cuotas_importe (id uuid primary key default gen_random_uuid(), empresa_id text, local_id text, cuenta_origen_id uuid, cuenta_destino_id uuid, estado text);
  create table public.abc_eventos (empresa_id text, local_id text, operation_id text, aggregate_type text, aggregate_id text, event_type text, payload jsonb, actor_user_id uuid, terminal_id uuid, occurred_at timestamptz, operating_day date);

  -- Texto original (20261001...).
  create or replace function public.abc_cancelar_pedido(p_operation_id text, p_empresa_id text, p_local_id text, p_pedido_id uuid, p_motivo text, p_expected_pedido_version bigint, p_terminal_id uuid, p_session_id uuid, p_operating_day date)
  returns jsonb language plpgsql security definer set search_path = '' as $function$
  declare
    v_pedido public.pedidos_tpv%rowtype;
    v_motivo text:=nullif(btrim(coalesce(p_motivo,'')),'');
    v_cmd jsonb;
    v_request jsonb;
    v_result jsonb;
    v_new_version bigint;
    v_canceladas integer;
  begin
    if auth.uid() is null
       or not private.abc_tiene_capacidad(p_empresa_id,p_local_id,'ABC_PEDIDO_CANCELAR') then
      raise exception 'pedido_cancelar_no_autorizado';
    end if;
    if v_motivo is null then raise exception 'motivo_cancelacion_requerido'; end if;
    v_request:=jsonb_build_object('pedido_id',p_pedido_id,'motivo',v_motivo);
    v_cmd:=private.abc_operacion_iniciar(p_operation_id,p_empresa_id,p_local_id,'ABC_CANCELAR_PEDIDO',v_request,p_terminal_id);
    if (v_cmd->>'replayed')::boolean then
      return coalesce(v_cmd->'resultado',v_cmd);
    end if;

    select *
      into v_pedido
      from public.pedidos_tpv
     where empresa_id=p_empresa_id and local_id=p_local_id and id=p_pedido_id
     for update;
    if not found then raise exception 'pedido_no_encontrado'; end if;
    if v_pedido.estado in ('CERRADO','CANCELADO') then raise exception 'pedido_no_cancelable'; end if;
    if v_pedido.version<>p_expected_pedido_version then raise exception 'pedido_version_conflict'; end if;

    if exists(
      select 1 from public.pedido_lineas
       where empresa_id=p_empresa_id and local_id=p_local_id and pedido_id=p_pedido_id
         and estado='SERVIDA'
    ) then
      raise exception 'pedido_con_lineas_servidas_no_cancelable';
    end if;

    update public.pedido_lineas
       set estado='CANCELADA',
           version=version+1
     where empresa_id=p_empresa_id and local_id=p_local_id and pedido_id=p_pedido_id
       and estado<>'CANCELADA';
    get diagnostics v_canceladas = row_count;

    update public.pedidos_tpv
       set estado='CANCELADO',
           closed_at=now(),
           version=version+1
     where empresa_id=p_empresa_id and local_id=p_local_id and id=p_pedido_id
    returning version into v_new_version;

    perform private.abc_registrar_transicion_pedido(
      p_empresa_id,p_local_id,p_pedido_id,p_operation_id,
      v_pedido.estado,'CANCELADO',v_motivo,auth.uid(),p_terminal_id,p_session_id,
      p_operating_day,jsonb_build_object('lineas_canceladas',v_canceladas)
    );

    insert into public.abc_eventos(
      empresa_id,local_id,operation_id,aggregate_type,aggregate_id,event_type,
      payload,actor_user_id,terminal_id,occurred_at,operating_day
    ) values (
      p_empresa_id,p_local_id,p_operation_id,'PEDIDO',p_pedido_id::text,'PEDIDO_CANCELADO',
      jsonb_build_object(
        'estado_anterior',v_pedido.estado,'estado','CANCELADO',
        'motivo',v_motivo,'pedido_version',v_new_version,
        'lineas_canceladas',v_canceladas,'session_id',p_session_id
      ),
      auth.uid(),p_terminal_id,now(),p_operating_day
    );

    v_result:=jsonb_build_object(
      'ok',true,'pedido_id',p_pedido_id,'estado','CANCELADO',
      'pedido_version',v_new_version,'lineas_canceladas',v_canceladas
    );
    perform private.abc_operacion_completar(p_operation_id,v_result);
    return v_result;
  end $function$;
`;

const E = 'E1', L = 'L1';
let n = 0;
const id = () => `20000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;

async function base() {
  const db = new PGlite();
  await db.exec(ANDAMIO);
  return db;
}
// Cuenta con N pedidos (el primero es el que se cancelará). Devuelve ids.
async function cuenta(db, { pedidos = 1, estado = 'ABIERTA', extra = null } = {}) {
  const c = id();
  await db.exec(`insert into public.cuentas_comerciales(id,empresa_id,local_id,estado) values ('${c}','${E}','${L}','${estado}')`);
  const ps = [];
  for (let i = 0; i < pedidos; i++) {
    const p = id(), l = id();
    await db.exec(`insert into public.pedidos_tpv(id,empresa_id,local_id,cuenta_id,estado,created_operating_day) values ('${p}','${E}','${L}','${c}','ENVIADO','2026-11-27')`);
    await db.exec(`insert into public.pedido_lineas(id,empresa_id,local_id,pedido_id,estado) values ('${l}','${E}','${L}','${p}','ENVIADA')`);
    ps.push({ p, l });
  }
  if (extra) await extra(c, ps);
  return { c, ps };
}
const cancelar = (db, pedido) => intenta(db, `select public.abc_cancelar_pedido('op-${pedido}','${E}','${L}','${pedido}'::uuid,'prueba',1,'${id()}'::uuid,'${id()}'::uuid,'2026-11-27'::date) r`);
const estadoCuenta = async (db, c) => (await db.query(`select estado, version, closed_at is not null cerrada from public.cuentas_comerciales where id='${c}'`)).rows[0];
const eventos = async (db, c) => Number((await db.query(`select count(*)::int n from public.abc_eventos where aggregate_type='CUENTA' and aggregate_id='${c}' and event_type='CUENTA_CERRADA_SIN_PEDIDOS'`)).rows[0].n);

// A. ANTES: se reproduce H-21.
{
  const db = await base();
  const { c, ps } = await cuenta(db);
  const r = await cancelar(db, ps[0].p);
  const ec = await estadoCuenta(db, c);
  check('H-21 reproducido: tras cancelar el único pedido la cuenta sigue ABIERTA', r.ok && ec.estado === 'ABIERTA', JSON.stringify(ec));
  await db.close();
}

// B. DESPUÉS.
{
  const db = await base();
  await db.exec(MIG);

  const a = await cuenta(db);
  const ra = await cancelar(db, a.ps[0].p);
  const ea = await estadoCuenta(db, a.c);
  check('B1 cancelar el único pedido cierra la cuenta (CERRADA, con fecha de cierre)', ra.ok && ea.estado === 'CERRADA' && ea.cerrada === true, JSON.stringify({ ra: ra.error || 'ok', ea }));
  check('B2 la versión de la cuenta sube en uno', Number(ea.version) === 2, JSON.stringify(ea));
  check('B3 queda el evento CUENTA_CERRADA_SIN_PEDIDOS, una sola vez', (await eventos(db, a.c)) === 1);
  const res = ra.filas?.[0]?.r;
  check('B4 el resultado indica que la cuenta se cerró y de cuál', res && res.cuenta_cerrada === true && res.cuenta_id === a.c && res.estado === 'CANCELADO', JSON.stringify(res));

  // Con otro pedido vivo no se cierra.
  const b = await cuenta(db, { pedidos: 2 });
  await cancelar(db, b.ps[0].p);
  check('B5 con otro pedido vivo en la cuenta, NO se cierra', (await estadoCuenta(db, b.c)).estado === 'ABIERTA');
  // Cuando se cancela también el segundo, sí.
  await db.exec(`update public.pedidos_tpv set version=1 where id='${b.ps[1].p}'`);
  await cancelar(db, b.ps[1].p);
  check('B6 al cancelar también el segundo pedido, se cierra', (await estadoCuenta(db, b.c)).estado === 'CERRADA');

  // Venta fiscal viva.
  const c1 = await cuenta(db, { extra: (c) => db.exec(`insert into public.ventas_fiscales(empresa_id,local_id,cuenta_id,estado) values ('${E}','${L}','${c}','ABIERTA')`) });
  await cancelar(db, c1.ps[0].p);
  check('B7 con una venta fiscal viva, NO se cierra', (await estadoCuenta(db, c1.c)).estado === 'ABIERTA');
  const c1b = await cuenta(db, { extra: (c) => db.exec(`insert into public.ventas_fiscales(empresa_id,local_id,cuenta_id,estado) values ('${E}','${L}','${c}','CANCELADA')`) });
  await cancelar(db, c1b.ps[0].p);
  check('B8 con la venta fiscal CANCELADA, sí se cierra', (await estadoCuenta(db, c1b.c)).estado === 'CERRADA');

  // Checkout.
  const c2 = await cuenta(db, { extra: (c) => db.exec(`insert into public.checkouts(empresa_id,local_id,cuenta_id,estado) values ('${E}','${L}','${c}','CANCELADO')`) });
  await cancelar(db, c2.ps[0].p);
  check('B9 con un checkout (aunque esté cancelado) no se cierra: puede haber pagos', (await estadoCuenta(db, c2.c)).estado === 'ABIERTA');

  // Reparto activo como destino y como origen.
  const c3 = await cuenta(db, { extra: (c) => db.exec(`insert into public.cuenta_linea_repartos(empresa_id,local_id,source_line_id,cuenta_id,estado) values ('${E}','${L}','${id()}','${c}','ACTIVO')`) });
  await cancelar(db, c3.ps[0].p);
  check('B10 con un reparto ACTIVO recibido, NO se cierra', (await estadoCuenta(db, c3.c)).estado === 'ABIERTA');
  const c4 = await cuenta(db, { extra: (c, ps) => db.exec(`insert into public.cuenta_linea_repartos(empresa_id,local_id,source_line_id,cuenta_id,estado) values ('${E}','${L}','${ps[0].l}','${id()}','ACTIVO')`) });
  await cancelar(db, c4.ps[0].p);
  check('B11 con una línea suya repartida a otra cuenta (ACTIVO), NO se cierra', (await estadoCuenta(db, c4.c)).estado === 'ABIERTA');
  const c4b = await cuenta(db, { extra: (c) => db.exec(`insert into public.cuenta_linea_repartos(empresa_id,local_id,source_line_id,cuenta_id,estado) values ('${E}','${L}','${id()}','${c}','CERRADO')`) });
  await cancelar(db, c4b.ps[0].p);
  check('B12 con el reparto ya CERRADO, sí se cierra', (await estadoCuenta(db, c4b.c)).estado === 'CERRADA');

  // Cuota por importe viva (origen o destino).
  const c5 = await cuenta(db, { extra: (c) => db.exec(`insert into public.cuenta_cuotas_importe(empresa_id,local_id,cuenta_origen_id,cuenta_destino_id,estado) values ('${E}','${L}','${c}','${id()}','ACTIVA')`) });
  await cancelar(db, c5.ps[0].p);
  check('B13 con una cuota por importe viva, NO se cierra', (await estadoCuenta(db, c5.c)).estado === 'ABIERTA');

  // Cuenta ya cerrada: no se vuelve a cerrar ni se duplica el evento.
  const c6 = await cuenta(db, { estado: 'CERRADA' });
  const r6 = await cancelar(db, c6.ps[0].p);
  const e6 = await estadoCuenta(db, c6.c);
  check('B14 una cuenta ya cerrada no se toca (versión y eventos intactos)', r6.ok && e6.estado === 'CERRADA' && Number(e6.version) === 1 && (await eventos(db, c6.c)) === 0 && r6.filas[0].r.cuenta_cerrada === false, JSON.stringify({ e6, r: r6.filas?.[0]?.r }));

  // Otra empresa/local: lo que no es suyo no cuenta.
  const c7 = await cuenta(db, { extra: (c) => db.exec(`insert into public.ventas_fiscales(empresa_id,local_id,cuenta_id,estado) values ('OTRA','${L}','${c}','ABIERTA')`) });
  await cancelar(db, c7.ps[0].p);
  check('B15 una venta de OTRA empresa con el mismo id de cuenta no impide cerrar', (await estadoCuenta(db, c7.c)).estado === 'CERRADA');

  // El pedido cancelado sigue siendo CANCELADO y sus líneas también.
  const lineas = (await db.query(`select estado from public.pedido_lineas where pedido_id='${a.ps[0].p}'`)).rows.map((x) => x.estado);
  check('B16 el pedido y sus líneas se cancelan igual que antes', lineas.every((x) => x === 'CANCELADA'));
  await db.close();
}

// C. Idempotencia, forma y higiene.
{
  const db = await base();
  await db.exec(MIG);
  const d1 = (await db.query(`select pg_get_functiondef('public.abc_cancelar_pedido(text,text,text,uuid,text,bigint,uuid,uuid,date)'::regprocedure) d`)).rows[0].d;
  await db.exec(MIG);
  const d2 = (await db.query(`select pg_get_functiondef('public.abc_cancelar_pedido(text,text,text,uuid,text,bigint,uuid,uuid,date)'::regprocedure) d`)).rows[0].d;
  check('C1 la migración es idempotente', d1 === d2);
  check('C2 el cierre aparece una vez y sigue siendo SECURITY DEFINER con search_path vacío', (d1.match(/CUENTA_CERRADA_SIN_PEDIDOS/g) || []).length === 1 && /SECURITY DEFINER/.test(d1) && /SET search_path TO ''/.test(d1));
  check('C3 el cierre va DESPUÉS de cancelar el pedido y ANTES del evento del pedido', d1.indexOf("estado='CANCELADO'") < d1.indexOf('CUENTA_CERRADA_SIN_PEDIDOS') && d1.indexOf('CUENTA_CERRADA_SIN_PEDIDOS') < d1.indexOf("'PEDIDO_CANCELADO'"));
  await db.close();
}
{
  const db = new PGlite();
  await db.exec(ANDAMIO);
  await db.exec(`create or replace function public.abc_cancelar_pedido(p_operation_id text, p_empresa_id text, p_local_id text, p_pedido_id uuid, p_motivo text, p_expected_pedido_version bigint, p_terminal_id uuid, p_session_id uuid, p_operating_day date)
    returns jsonb language plpgsql as $f$ begin return '{}'::jsonb; end $f$;`);
  let msg = '';
  try { await db.exec(MIG); } catch (e) { msg = String(e.message || e); }
  check('C4 si la función no tiene la forma esperada, falla en voz alta', msg.includes('ESTRUCTURA_NO_ENCONTRADA'), msg.slice(0, 120));
  await db.close();
}
const sc = MIG.replace(/--.*$/gm, '');
check('C5 la migración no concede ni revoca privilegios ni toca tablas', !/\b(grant|revoke|insert\s+into\s+public\.(?!abc_eventos)|drop\s+table|alter\s+table|truncate)\b/i.test(sc));

console.log(fallos === 0 ? 'H21_CANCELAR_PEDIDO_CIERRA_CUENTA_PGLITE_CONTRACT=PASS' : `H21_CANCELAR_PEDIDO_CIERRA_CUENTA_PGLITE_CONTRACT=FAIL (${fallos})`);
process.exitCode = fallos === 0 ? 0 : 1;
