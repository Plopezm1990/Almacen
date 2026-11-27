/**
 * Contrato PGlite de la migración
 *   supabase/migrations/20261127120000_abc_f4_cerrar_cuenta_ignora_pagos_rechazados.sql
 *
 *   node tests/rediseno/h48-cerrar-cuenta-ignora-pagos-rechazados-pglite-contract.mjs
 *
 * Hallazgo H-48 (verificación en el navegador de QA, 27/11/2026): «Cerrar cuenta pagada» se negaba a cerrar
 * una cuenta totalmente cobrada si el checkout conservaba un pago RECHAZADO o CANCELADO (por ejemplo, una
 * tarjeta rechazada que el cajero repitió y cobró bien): error `cuenta_pago_no_resuelto`.
 *
 * Qué se fija:
 *   1. ANTES (texto original de la función, leído de la migración A-02): un pago RECHAZADO o CANCELADO impide cerrar.
 *   2. DESPUÉS: ya no impide cerrar; la cuenta se cierra con el saldo confirmado.
 *   3. Siguen impidiéndolo los pagos vivos (PENDIENTE, AUTORIZADO, DESCONOCIDO) y lo demás no cambia: saldo
 *      pendiente, reserva activa, incidencia abierta, pedido sin servir.
 *   4. La migración parchea la definición viva, es idempotente y falla en voz alta si no encuentra la forma esperada.
 *
 * El esquema es un andamio con las columnas que usa la función. El texto de la función NO se reescribe aquí: se
 * extrae de la migración que la definió por última vez, para no arrastrar deriva.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';

const raiz = path.resolve(fileURLToPath(new URL('../../', import.meta.url)));
const { PGlite } = await import(
  new URL('file://' + path.join(raiz, 'tests/f3/a09/node_modules/@electric-sql/pglite/dist/index.js').replace(/\\/g, '/'))
);
const MIG = await readFile(path.join(raiz, 'supabase/migrations/20261127120000_abc_f4_cerrar_cuenta_ignora_pagos_rechazados.sql'), 'utf8');
const ORIGEN = await readFile(path.join(raiz, 'supabase/migrations/20261108170000_a02_cerrar_y_sellar_venta_fiscal.sql'), 'utf8');

const ini = ORIGEN.indexOf('create or replace function public.abc_cerrar_cuenta_pagada(');
const fin = ORIGEN.indexOf('end $$;', ini);
if (ini < 0 || fin < 0) throw new Error('No se encontró la función original en la migración A-02');
const FUNCION_ORIGINAL = ORIGEN.slice(ini, fin + 'end $$;'.length);

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
  create function private.abc_operacion_fallar(op text, r jsonb) returns void language sql as $$ select 1 $$;
  create function private.abc_registrar_transicion_pedido(e text, l text, p uuid, op text, a text, b text, m text, u uuid, t uuid, s uuid, d date, md jsonb) returns void language sql as $$ select 1 $$;

  create table public.cuentas_comerciales (id uuid primary key, empresa_id text, local_id text, estado text, version bigint default 1, closed_at timestamptz);
  create table public.checkouts (id uuid primary key, empresa_id text, local_id text, cuenta_id uuid, estado text, operating_day date);
  create table public.ventas_fiscales (id uuid primary key, empresa_id text, local_id text, cuenta_id uuid, estado text, total numeric(24,8), locked_at timestamptz, version bigint default 1);
  create table public.checkout_ventas (id uuid primary key, empresa_id text, local_id text, checkout_id uuid, venta_fiscal_id uuid);
  create table public.pago_intentos (id uuid primary key, empresa_id text, local_id text, pago_id uuid, estado text);
  create table public.pago_aplicaciones (id uuid primary key default gen_random_uuid(), empresa_id text, local_id text, intento_id uuid, venta_fiscal_id uuid, sale_amount numeric(24,8));
  create table public.pagos (id uuid primary key, empresa_id text, local_id text, checkout_id uuid, estado text);
  create table public.reservas_saldo (id uuid primary key default gen_random_uuid(), empresa_id text, local_id text, checkout_venta_id uuid, estado text);
  create table public.abc_cobro_incidencias (id uuid primary key default gen_random_uuid(), empresa_id text, local_id text, intento_id uuid, estado text);
  create table public.pedidos_tpv (id uuid primary key, empresa_id text, local_id text, cuenta_id uuid, estado text, version bigint default 1, created_at timestamptz default now(), closed_at timestamptz);
  create table public.abc_eventos (empresa_id text, local_id text, operation_id text, aggregate_type text, aggregate_id text, event_type text, payload jsonb, actor_user_id uuid, terminal_id uuid, occurred_at timestamptz, operating_day date);

  ${FUNCION_ORIGINAL}
`;

const E = 'E1', L = 'L1', DIA = '2026-11-27';
let n = 0;
const id = () => `30000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;

async function base(conMigracion) {
  const db = new PGlite();
  await db.exec(ANDAMIO);
  if (conMigracion) await db.exec(MIG);
  return db;
}

/**
 * Cuenta totalmente cobrada: 1 venta de 10 €, un checkout COMPLETADO, un pago CONFIRMADO con su intento y su
 * aplicación, y un pedido SERVIDO. `extra(ctx)` añade lo que cada caso necesite.
 */
async function cuentaCobrada(db, { extra = null, pedido = 'SERVIDO', total = 10, cobrado = 10 } = {}) {
  const c = id(), k = id(), v = id(), cv = id(), pg = id(), it = id(), pd = id();
  await db.exec(`insert into public.cuentas_comerciales(id,empresa_id,local_id,estado) values ('${c}','${E}','${L}','ABIERTA')`);
  await db.exec(`insert into public.checkouts(id,empresa_id,local_id,cuenta_id,estado,operating_day) values ('${k}','${E}','${L}','${c}','COMPLETADO','${DIA}')`);
  await db.exec(`insert into public.ventas_fiscales(id,empresa_id,local_id,cuenta_id,estado,total) values ('${v}','${E}','${L}','${c}','ABIERTA',${total})`);
  await db.exec(`insert into public.checkout_ventas(id,empresa_id,local_id,checkout_id,venta_fiscal_id) values ('${cv}','${E}','${L}','${k}','${v}')`);
  await db.exec(`insert into public.pagos(id,empresa_id,local_id,checkout_id,estado) values ('${pg}','${E}','${L}','${k}','CONFIRMADO')`);
  await db.exec(`insert into public.pago_intentos(id,empresa_id,local_id,pago_id,estado) values ('${it}','${E}','${L}','${pg}','CONFIRMADO')`);
  await db.exec(`insert into public.pago_aplicaciones(empresa_id,local_id,intento_id,venta_fiscal_id,sale_amount) values ('${E}','${L}','${it}','${v}',${cobrado})`);
  await db.exec(`insert into public.pedidos_tpv(id,empresa_id,local_id,cuenta_id,estado) values ('${pd}','${E}','${L}','${c}','${pedido}')`);
  const ctx = { c, k, v, cv, pg, it, pd };
  if (extra) await extra(ctx);
  return ctx;
}
async function conPagoExtra(db, estado, opts = {}) {
  return cuentaCobrada(db, { ...opts, extra: (ctx) => db.exec(`insert into public.pagos(id,empresa_id,local_id,checkout_id,estado) values ('${id()}','${E}','${L}','${ctx.k}','${estado}')`) });
}
const cerrar = (db, ctx) => intenta(db, `select public.abc_cerrar_cuenta_pagada('op-${ctx.c}','${E}','${L}','${ctx.c}'::uuid,'${ctx.k}'::uuid,1,'${id()}'::uuid,'${id()}'::uuid,'${DIA}'::date) r`);
const estadoCuenta = async (db, c) => (await db.query(`select estado, version from public.cuentas_comerciales where id='${c}'`)).rows[0];

// A. ANTES: se reproduce H-48 con el texto original.
{
  const db = await base(false);
  const sano = await cuentaCobrada(db);
  const rs = await cerrar(db, sano);
  check('A0 línea base: una cuenta cobrada con solo pagos CONFIRMADOS se cierra', rs.ok && (await estadoCuenta(db, sano.c)).estado === 'CERRADA', rs.error || '');
  for (const estado of ['RECHAZADO', 'CANCELADO']) {
    const ctx = await conPagoExtra(db, estado);
    const r = await cerrar(db, ctx);
    check(`A1 H-48 reproducido: un pago ${estado} impide cerrar`, !r.ok && /cuenta_pago_no_resuelto/.test(r.error || '') && (await estadoCuenta(db, ctx.c)).estado === 'ABIERTA', r.error || 'cerró');
  }
  await db.close();
}

// B. DESPUÉS.
{
  const db = await base(true);
  for (const estado of ['RECHAZADO', 'CANCELADO']) {
    const ctx = await conPagoExtra(db, estado);
    const r = await cerrar(db, ctx);
    const ec = await estadoCuenta(db, ctx.c);
    check(`B1 con un pago ${estado} la cuenta cobrada SÍ se cierra`, r.ok && ec.estado === 'CERRADA' && Number(ec.version) === 2, r.error || JSON.stringify(ec));
    const res = r.filas?.[0]?.r;
    check(`B2 el resultado conserva el importe confirmado (${estado})`, res && res.ok === true && Number(res.importe_confirmado) === 10 && res.estado === 'CERRADA', JSON.stringify(res));
  }

  // Un rechazado Y un cancelado a la vez.
  const dos = await cuentaCobrada(db, { extra: async (ctx) => {
    await db.exec(`insert into public.pagos(id,empresa_id,local_id,checkout_id,estado) values ('${id()}','${E}','${L}','${ctx.k}','RECHAZADO'),('${id()}','${E}','${L}','${ctx.k}','CANCELADO')`);
  } });
  check('B3 con varios pagos rechazados y cancelados, se cierra', (await cerrar(db, dos)).ok && (await estadoCuenta(db, dos.c)).estado === 'CERRADA');

  // Un reembolsado sigue sin impedirlo (como antes).
  const reemb = await conPagoExtra(db, 'REEMBOLSADO');
  check('B4 un pago REEMBOLSADO sigue sin impedir el cierre', (await cerrar(db, reemb)).ok);

  // Lo vivo SÍ impide cerrar.
  for (const estado of ['PENDIENTE', 'AUTORIZADO', 'DESCONOCIDO']) {
    const ctx = await conPagoExtra(db, estado);
    const r = await cerrar(db, ctx);
    check(`B5 un pago ${estado} SIGUE impidiendo cerrar`, !r.ok && /cuenta_pago_no_resuelto/.test(r.error || '') && (await estadoCuenta(db, ctx.c)).estado === 'ABIERTA', r.error || 'cerró');
  }

  // Un rechazado más uno vivo: sigue bloqueando por el vivo.
  const mixto = await cuentaCobrada(db, { extra: async (ctx) => {
    await db.exec(`insert into public.pagos(id,empresa_id,local_id,checkout_id,estado) values ('${id()}','${E}','${L}','${ctx.k}','RECHAZADO'),('${id()}','${E}','${L}','${ctx.k}','PENDIENTE')`);
  } });
  const rm = await cerrar(db, mixto);
  check('B6 un pago RECHAZADO junto a uno PENDIENTE: sigue bloqueado por el pendiente', !rm.ok && /cuenta_pago_no_resuelto/.test(rm.error || ''), rm.error || 'cerró');

  // Otra empresa con el mismo checkout id no cuenta.
  const ajeno = await cuentaCobrada(db, { extra: (ctx) => db.exec(`insert into public.pagos(id,empresa_id,local_id,checkout_id,estado) values ('${id()}','OTRA','${L}','${ctx.k}','PENDIENTE')`) });
  check('B7 un pago PENDIENTE de OTRA empresa no impide cerrar', (await cerrar(db, ajeno)).ok);

  // Lo demás no cambia.
  const falta = await cuentaCobrada(db, { total: 10, cobrado: 4 });
  const rf = await cerrar(db, falta);
  check('B8 el saldo pendiente sigue impidiendo cerrar', !rf.ok && /cuenta_saldo_pendiente/.test(rf.error || ''), rf.error || 'cerró');

  const reserva = await cuentaCobrada(db, { extra: (ctx) => db.exec(`insert into public.reservas_saldo(empresa_id,local_id,checkout_venta_id,estado) values ('${E}','${L}','${ctx.cv}','ACTIVA')`) });
  const rr = await cerrar(db, reserva);
  check('B9 una reserva de saldo ACTIVA sigue impidiendo cerrar', !rr.ok && /cuenta_reserva_saldo_activa/.test(rr.error || ''), rr.error || 'cerró');

  const incid = await cuentaCobrada(db, { extra: (ctx) => db.exec(`insert into public.abc_cobro_incidencias(empresa_id,local_id,intento_id,estado) values ('${E}','${L}','${ctx.it}','ABIERTA')`) });
  const ri = await cerrar(db, incid);
  check('B10 una incidencia de cobro ABIERTA sigue impidiendo cerrar', !ri.ok && /cuenta_incidencia_cobro_abierta/.test(ri.error || ''), ri.error || 'cerró');

  const sinServir = await conPagoExtra(db, 'RECHAZADO', { pedido: 'ENVIADO' });
  const rp = await cerrar(db, sinServir);
  check('B11 un pedido sin servir sigue impidiendo cerrar (aunque el pago rechazado ya no cuente)', !rp.ok && /cuenta_pedido_no_cerrable/.test(rp.error || ''), rp.error || 'cerró');

  // El cierre sigue sellando la venta y cerrando el pedido servido.
  const sello = await conPagoExtra(db, 'RECHAZADO');
  await cerrar(db, sello);
  const vf = (await db.query(`select estado, locked_at is not null sellada from public.ventas_fiscales where id='${sello.v}'`)).rows[0];
  const pd = (await db.query(`select estado from public.pedidos_tpv where id='${sello.pd}'`)).rows[0];
  check('B12 el cierre sigue sellando la venta fiscal y cerrando el pedido servido', vf.estado === 'CERRADA' && vf.sellada === true && pd.estado === 'CERRADO', JSON.stringify({ vf, pd }));
  await db.close();
}

// C. Idempotencia, forma y higiene.
{
  const db = await base(true);
  const sql = `select pg_get_functiondef('public.abc_cerrar_cuenta_pagada(text,text,text,uuid,uuid,bigint,uuid,uuid,date)'::regprocedure) d`;
  const d1 = (await db.query(sql)).rows[0].d;
  await db.exec(MIG);
  const d2 = (await db.query(sql)).rows[0].d;
  check('C1 la migración es idempotente', d1 === d2);
  check('C2 el predicado nuevo aparece una vez y el viejo ya no', (d1.match(/not in \('CONFIRMADO','REEMBOLSADO','RECHAZADO','CANCELADO'\)/g) || []).length === 1 && !/not in \('CONFIRMADO','REEMBOLSADO'\)/.test(d1));
  check('C3 sigue siendo SECURITY DEFINER con search_path vacío', /SECURITY DEFINER/.test(d1) && /SET search_path TO ''/.test(d1));
  await db.close();
}
{
  const db = new PGlite();
  await db.exec(ANDAMIO);
  await db.exec(`create or replace function public.abc_cerrar_cuenta_pagada(p_operation_id text, p_empresa_id text, p_local_id text, p_cuenta_id uuid, p_checkout_id uuid, p_expected_cuenta_version bigint, p_terminal_id uuid, p_session_id uuid, p_operating_day date)
    returns jsonb language plpgsql as $f$ begin return '{}'::jsonb; end $f$;`);
  let msg = '';
  try { await db.exec(MIG); } catch (e) { msg = String(e.message || e); }
  check('C4 si la función no tiene la forma esperada, falla en voz alta', msg.includes('ESTRUCTURA_NO_ENCONTRADA'), msg.slice(0, 120));
  await db.close();
}
{
  const db = new PGlite();
  let msg = '';
  try { await db.exec(MIG); } catch (e) { msg = String(e.message || e); }
  check('C5 si la función no existe, falla en voz alta', msg.includes('FUNCION_OBLIGATORIA_NO_ENCONTRADA'), msg.slice(0, 120));
  await db.close();
}
const sc = MIG.replace(/--.*$/gm, '');
check('C6 la migración no concede ni revoca privilegios ni toca tablas', !/\b(grant|revoke|insert\s+into|drop\s+table|alter\s+table|truncate|update\s+public\.)\b/i.test(sc));

console.log(fallos === 0 ? 'H48_CERRAR_CUENTA_IGNORA_PAGOS_RECHAZADOS_PGLITE_CONTRACT=PASS' : `H48_CERRAR_CUENTA_IGNORA_PAGOS_RECHAZADOS_PGLITE_CONTRACT=FAIL (${fallos})`);
process.exitCode = fallos === 0 ? 0 : 1;
