/**
 * Contrato PGlite de la migración
 *   supabase/migrations/20261128160000_abc_f6_reembolsos_por_venta.sql
 *
 *   node tests/rediseno/h35-reembolsos-por-venta-pglite-contract.mjs
 *
 * H-35: el historial refleja los reembolsos económicos. La función `abc_reembolsos_por_venta` devuelve, por venta fiscal, lo realmente devuelto.
 *
 * Qué se fija:
 *   1. Suma `importe_venta` por venta fiscal solo de reembolsos CONFIRMADOS; no cuenta cancelados ni solicitados, ni aplicaciones sin venta o con importe 0.
 *   2. Solo cuenta lo del local pedido (otra empresa u otro local no se mezcla) y devuelve `{}` si no hay nada.
 *   3. Solo para quien pertenece al local (rechaza a quien no, y a quien no ha iniciado sesión).
 *   4. SECURITY DEFINER con search_path vacío, solo `authenticated` (no `anon`) y no modifica datos.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';

const raiz = path.resolve(fileURLToPath(new URL('../../', import.meta.url)));
const { PGlite } = await import(
  new URL('file://' + path.join(raiz, 'tests/f3/a09/node_modules/@electric-sql/pglite/dist/index.js').replace(/\\/g, '/'))
);
const MIG = await readFile(path.join(raiz, 'supabase/migrations/20261128160000_abc_f6_reembolsos_por_venta.sql'), 'utf8');

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
  create role anon; create role authenticated;
  create schema if not exists private; create schema if not exists auth;
  create table public.ajustes (clave text primary key, valor text);
  insert into public.ajustes values ('usuario','11111111-1111-4111-8111-111111111111');
  create function auth.uid() returns uuid language sql stable as $$ select nullif(valor,'')::uuid from public.ajustes where clave = 'usuario' $$;
  create function private.la_tiene_local(e text, l text) returns boolean language sql stable as $$ select e = 'E1' and l = 'L1' $$;
  create table public.reembolsos (id uuid primary key, empresa_id text, local_id text, estado text);
  create table public.reembolso_aplicaciones (id uuid primary key default gen_random_uuid(), empresa_id text, local_id text, reembolso_id uuid, venta_fiscal_id uuid, importe_venta numeric);
`;

const E = 'E1', L = 'L1';
let n = 0;
const id = () => `60000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;

async function base() {
  const db = new PGlite();
  await db.exec(ANDAMIO);
  await db.exec(MIG);
  return db;
}
async function reembolso(db, estado, aplicaciones, { empresa = E, local = L } = {}) {
  const r = id();
  await db.exec(`insert into public.reembolsos(id,empresa_id,local_id,estado) values ('${r}','${empresa}','${local}','${estado}')`);
  for (const [venta, importe] of aplicaciones) {
    await db.exec(`insert into public.reembolso_aplicaciones(empresa_id,local_id,reembolso_id,venta_fiscal_id,importe_venta) values ('${empresa}','${local}','${r}',${venta ? `'${venta}'` : 'null'},${importe})`);
  }
  return r;
}
const llamar = (db, empresa = E, local = L) => intenta(db, `select public.abc_reembolsos_por_venta('${empresa}','${local}') r`);

const V1 = '70000000-0000-4000-8000-000000000001', V2 = '70000000-0000-4000-8000-000000000002', V3 = '70000000-0000-4000-8000-000000000003', V4 = '70000000-0000-4000-8000-000000000004';

// ---------- A. Qué suma ----------
{
  const db = await base();
  await reembolso(db, 'CONFIRMADO', [[V1, 1]]);
  await reembolso(db, 'CONFIRMADO', [[V1, 0.5], [V2, 2.25]]);
  await reembolso(db, 'CANCELADO', [[V1, 5], [V3, 4]]);
  await reembolso(db, 'SOLICITADO', [[V3, 9]]);
  await reembolso(db, 'CONFIRMADO', [[null, 3], [V4, 0]]);
  const r = await llamar(db);
  const v = r.filas?.[0]?.r?.ventas;
  check('A1 suma por venta fiscal solo lo de reembolsos CONFIRMADOS (V1 = 1,00 + 0,50; V2 = 2,25)', r.ok && r.filas[0].r.ok === true && Number(v[V1]) === 1.5 && Number(v[V2]) === 2.25, JSON.stringify(r.filas?.[0]?.r || r.error));
  check('A2 no cuenta cancelados ni solicitados (V3), ni aplicaciones sin venta ni con importe 0 (V4)', !(V3 in v) && !(V4 in v) && Object.keys(v).length === 2);
  await db.close();
}
{
  const db = await base();
  const r = await llamar(db);
  check('A3 sin reembolsos devuelve un mapa vacío (no nulo)', r.ok && JSON.stringify(r.filas[0].r.ventas) === '{}', JSON.stringify(r.filas?.[0]?.r || r.error));
  await db.close();
}
{
  const db = await base();
  await reembolso(db, 'CONFIRMADO', [[V1, 1]]);
  await reembolso(db, 'CONFIRMADO', [[V1, 7]], { local: 'L2' });
  await reembolso(db, 'CONFIRMADO', [[V1, 8]], { empresa: 'E2' });
  const r = await llamar(db);
  check('A4 no mezcla otro local ni otra empresa', r.ok && Number(r.filas[0].r.ventas[V1]) === 1, JSON.stringify(r.filas?.[0]?.r || r.error));
  await db.close();
}

// ---------- B. Quién puede leer ----------
{
  const db = await base();
  await reembolso(db, 'CONFIRMADO', [[V1, 1]]);
  const otro = await llamar(db, 'E1', 'L2');
  check('B1 quien no pertenece al local es rechazado', !otro.ok && otro.error.includes('reembolsos_lectura_no_autorizada'), otro.error);
  await db.exec(`update public.ajustes set valor = '' where clave = 'usuario'`);
  const anon = await llamar(db);
  check('B2 sin sesión iniciada es rechazado', !anon.ok && anon.error.includes('reembolsos_lectura_no_autorizada'), anon.error);
  await db.close();
}

// ---------- C. Forma e higiene ----------
{
  const db = await base();
  const d = (await db.query(`select pg_get_functiondef('public.abc_reembolsos_por_venta(text,text)'::regprocedure) d`)).rows[0].d;
  check('C1 SECURITY DEFINER con search_path vacío', /SECURITY DEFINER/.test(d) && /SET search_path TO ''/.test(d));
  check('C2 es de solo lectura (STABLE)', /\bSTABLE\b/.test(d));
  const priv = (await db.query(`select has_function_privilege('authenticated','public.abc_reembolsos_por_venta(text,text)','execute') aut, has_function_privilege('anon','public.abc_reembolsos_por_venta(text,text)','execute') anon`)).rows[0];
  check('C3 solo `authenticated` puede ejecutarla (no `anon`)', priv.aut === true && priv.anon === false, JSON.stringify(priv));
  await db.close();
}
const sc = MIG.replace(/--.*$/gm, '');
check('C4 la migración no escribe datos ni cambia tablas', !/\b(insert\s+into|update\s+public\.|delete\s+from|drop\s+table|alter\s+table|truncate|create\s+table)\b/i.test(sc));

console.log(fallos === 0 ? 'H35_REEMBOLSOS_POR_VENTA_PGLITE_CONTRACT=PASS' : `H35_REEMBOLSOS_POR_VENTA_PGLITE_CONTRACT=FAIL (${fallos})`);
process.exitCode = fallos === 0 ? 0 : 1;
