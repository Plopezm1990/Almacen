/**
 * Contrato PGlite de la migración
 *   supabase/migrations/20261128120000_abc_f6_empresa_nueva_con_politica_mfa_propietario.sql
 *
 *   node tests/rediseno/h17-empresa-nueva-politica-mfa-pglite-contract.mjs
 *
 * H-17: decisión del 25/11/2026, segundo factor obligatorio solo para Propietario. `private.mfa_politica` dice «sin fila =
 * no se exige», así que una empresa nueva nacía sin segundo factor para su Propietario. Un disparador siembra la fila.
 *
 *   A. ANTES: una empresa nueva no tiene política MFA.
 *   B. DESPUÉS: nace con (Propietario, exigida = true) y solo esa; no pisa una política ya existente; no rellena las
 *      empresas que ya existían; vale para cualquier camino de alta (se prueba con un INSERT directo y con una función).
 *   C. Idempotente, no ejecutable por authenticated/anon y falla en voz alta si falta la tabla de política.
 *   D. La guarda real (private.mfa_exigida_para_uid, copiada de la migración 20261115120000) pasa a exigir aal2 a ese Propietario.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';

const raiz = path.resolve(fileURLToPath(new URL('../../', import.meta.url)));
const { PGlite } = await import(
  new URL('file://' + path.join(raiz, 'tests/f3/a09/node_modules/@electric-sql/pglite/dist/index.js').replace(/\\/g, '/'))
);
const MIG = await readFile(path.join(raiz, 'supabase/migrations/20261128120000_abc_f6_empresa_nueva_con_politica_mfa_propietario.sql'), 'utf8');
const MFA = await readFile(path.join(raiz, 'supabase/migrations/20261115120000_mfa_politica_opcional.sql'), 'utf8');

function trozo(texto, desde, hasta) {
  const a = texto.indexOf(desde);
  const b = texto.indexOf(hasta, a);
  if (a < 0 || b < 0) throw new Error('No se encontró ' + desde);
  return texto.slice(a, b + hasta.length);
}
const TABLA_POLITICA = trozo(MFA, 'create table if not exists private.mfa_politica (', ');');
const FUNCION_EXIGIDA = trozo(MFA, 'create or replace function private.mfa_exigida_para_uid()', '$function$;');

let fallos = 0;
function check(nombre, ok, detalle = '') {
  if (!ok) fallos++;
  console.log(`${ok ? '[OK]  ' : '[FAIL]'} ${nombre}${detalle ? ' — ' + detalle : ''}`);
}
async function intenta(db, sql) {
  try { return { ok: true, filas: (await db.query(sql)).rows }; }
  catch (e) { return { ok: false, error: String(e && (e.message || e)) }; }
}
async function ejecuta(db, sql) {
  try { await db.exec(sql); return { ok: true }; }
  catch (e) { return { ok: false, error: String(e && (e.message || e)) }; }
}
const UID = '44444444-4444-4444-8444-444444444444';

const ANDAMIO = `
  create role anon nologin; create role authenticated nologin;
  create schema auth; create schema private;
  create function auth.uid() returns uuid language sql stable as $$ select '${UID}'::uuid $$;
  create table public.empresas (id text primary key, nombre text);
  create table public.membresias_usuario (id serial primary key, user_id uuid, empresa_id text, rol text, activo boolean);
  ${TABLA_POLITICA}
  ${FUNCION_EXIGIDA}
  -- Un camino de alta como los reales: una función que inserta la empresa.
  create function public.crear_empresa_de_prueba(p_id text) returns void language plpgsql security definer as $f$
  begin insert into public.empresas(id, nombre) values (p_id, 'Empresa ' || p_id); end $f$;
  -- Empresa que ya existía antes de la migración.
  insert into public.empresas(id, nombre) values ('VIEJA', 'Empresa antigua');
`;
async function base(conMigracion) {
  const db = new PGlite();
  await db.exec(ANDAMIO);
  if (conMigracion) await db.exec(MIG);
  return db;
}
const politica = async (db, e) => (await db.query(`select rol, exigida from private.mfa_politica where empresa_id = '${e}' order by rol`)).rows;

// A
{
  const db = await base(false);
  await db.exec(`insert into public.empresas(id, nombre) values ('NUEVA','x')`);
  check('A1 ANTES: una empresa nueva nace sin política de segundo factor (no se exige a nadie)', (await politica(db, 'NUEVA')).length === 0);
}

// B
{
  const db = await base(true);
  await db.exec(`insert into public.empresas(id, nombre) values ('NUEVA','x')`);
  const p = await politica(db, 'NUEVA');
  check('B1 DESPUÉS: la empresa nueva nace con Propietario exigido', p.length === 1 && p[0].rol === 'Propietario' && p[0].exigida === true, JSON.stringify(p));
  await db.exec(`select public.crear_empresa_de_prueba('POR_FUNCION')`);
  const p2 = await politica(db, 'POR_FUNCION');
  check('B2 también por una función de alta (cualquier camino)', p2.length === 1 && p2[0].exigida === true, JSON.stringify(p2));
  check('B3 NO rellena las empresas que ya existían (decisión por empresa y entorno)', (await politica(db, 'VIEJA')).length === 0);

  // No pisa una política existente.
  const db2 = await base(true);
  await db2.exec(`insert into private.mfa_politica(empresa_id, rol, exigida) values ('CONFIG','Propietario', false)`);
  await db2.exec(`insert into public.empresas(id, nombre) values ('CONFIG','x')`);
  const p3 = await politica(db2, 'CONFIG');
  check('B4 no pisa una política ya configurada (queda exigida = false)', p3.length === 1 && p3[0].exigida === false, JSON.stringify(p3));
  check('B5 solo siembra Propietario (Encargado, Cajero/a y Camarero/a siguen sin exigencia)', p.every((x) => x.rol === 'Propietario'));
}

// C
{
  const db = await base(true);
  const otra = await ejecuta(db, MIG);
  check('C1 la migración es idempotente', otra.ok, otra.error || '');
  await db.exec(`insert into public.empresas(id, nombre) values ('N2','x')`);
  check('C2 tras aplicarla dos veces sigue sembrando una sola fila', (await politica(db, 'N2')).length === 1);
  const ejec = (await db.query(`select has_function_privilege('authenticated','private.mfa_sembrar_politica_empresa_nueva()','EXECUTE') a, has_function_privilege('anon','private.mfa_sembrar_politica_empresa_nueva()','EXECUTE') b`)).rows[0];
  check('C3 la función del disparador no es ejecutable por authenticated ni anon', !ejec.a && !ejec.b);
  const sin = new PGlite();
  await sin.exec(ANDAMIO + '\n drop table private.mfa_politica cascade;');
  const r = await ejecuta(sin, MIG);
  check('C4 sin la tabla de política, falla en voz alta', !r.ok && /DEPENDENCIA_OBLIGATORIA_NO_ENCONTRADA/.test(r.error || ''), r.error || 'no falló');
}

// D
{
  const db = await base(true);
  await db.exec(`insert into public.empresas(id, nombre) values ('NUEVA','x'); insert into public.membresias_usuario(user_id, empresa_id, rol, activo) values ('${UID}','NUEVA','Propietario', true)`);
  const exigida = (await db.query(`select private.mfa_exigida_para_uid() v`)).rows[0].v;
  check('D1 el Propietario de una empresa nueva queda sujeto a la exigencia de segundo factor de la guarda real', exigida === true);
}

console.log(fallos === 0 ? 'H17_EMPRESA_NUEVA_POLITICA_MFA_CONTRACT=PASS' : `H17_EMPRESA_NUEVA_POLITICA_MFA_CONTRACT=FAIL (${fallos})`);
process.exitCode = fallos === 0 ? 0 : 1;
