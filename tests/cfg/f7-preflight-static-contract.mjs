// Contrato estático del paquete de promoción a producción (F7, 3/10/2026): el archivo de comprobaciones previas es de SOLO LECTURA y sus listas
// (objetos que crea cada migración, huellas md5 exigidas, funciones reemplazadas) coinciden con las migraciones reales del repositorio; y el documento
// de preparación lista todas las migraciones candidatas.
//
// Por qué: el archivo `docs/plan-abc/F7_PROMOCION_PRODUCCION_PREFLIGHT_SOLO_LECTURA_2026-10-03.sql` se ejecutará algún día contra producción. Si una
// migración nueva (o una huella) cambia y el archivo no se actualiza, la foto previa mentiría; y si alguien le añadiera una sentencia que escribe,
// dejaría de ser de solo lectura. No necesita librerías ni base de datos:
//   node tests/cfg/f7-preflight-static-contract.mjs
// F7_PREFLIGHT_SQL y F7_DOC (opcionales) permiten probar otras versiones (mutantes).
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = fileURLToPath(new URL('../../', import.meta.url));
const sqlRuta = process.env.F7_PREFLIGHT_SQL || join(REPO, 'docs/plan-abc/F7_PROMOCION_PRODUCCION_PREFLIGHT_SOLO_LECTURA_2026-10-03.sql');
const docRuta = process.env.F7_DOC || join(REPO, 'docs/plan-abc/F7_PROMOCION_PRODUCCION_PREPARACION_2026-10-03.md');
const sql = readFileSync(sqlRuta, 'utf8');
const doc = readFileSync(docRuta, 'utf8');
const PRIMERA = '20260924160739'; // A09: primera migración candidata
// P3c se promueve en una ventana separada y no forma parte de la foto F7.
const EXCLUIDAS = new Set([
  '20261004201358_abc_p3c_concurrencia_productos.sql',
  '20261005060000_abc_p3c_titularidad_productos.sql',
  '20261005100000_abc_p3c_lista_confirmada.sql',
]);
const archivos = readdirSync(join(REPO, 'supabase/migrations'))
  .filter((f) => f.endsWith('.sql') && f.slice(0, 14) >= PRIMERA && !EXCLUIDAS.has(f))
  .sort();
const leer = (f) => readFileSync(join(REPO, 'supabase/migrations', f), 'utf8');
const sinComentarios = (s) => s.replace(/--[^\n]*/g, '');
const sinCadenas = (s) => s.replace(/'(?:[^']|'')*'/g, "''");

// ---- 1. Solo lectura: ninguna palabra de escritura y toda sentencia empieza por select o with ----
const codigo = sinCadenas(sinComentarios(sql));
const PROHIBIDAS = ['insert', 'update', 'delete', 'create', 'alter', 'drop', 'grant', 'revoke', 'truncate', 'copy', 'call', 'execute', 'do', 'set', 'vacuum', 'refresh', 'comment', 'lock', 'listen', 'notify', 'reindex', 'cluster', 'reset', 'begin', 'commit', 'rollback', 'savepoint', 'prepare', 'declare', 'merge', 'import', 'security', 'discard'];
for (const p of PROHIBIDAS) {
  const m = codigo.match(new RegExp(`\\b${p}\\b`, 'i'));
  assert.ok(!m, `el archivo de comprobaciones previas debe ser de solo lectura: contiene «${p}»`);
}
const sentencias = codigo.split(';').map((x) => x.trim()).filter(Boolean);
assert.ok(sentencias.length >= 10, 'faltan consultas');
for (const x of sentencias) assert.match(x, /^(select|with)\b/i, `toda sentencia debe empezar por select o with: «${x.slice(0, 60)}»`);
for (const b of ['P0', 'P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8', 'P9']) assert.ok(new RegExp(`-- ${b} ·`).test(sql), `falta el bloque ${b}`);

// ---- 2. P2: los objetos nuevos de cada migración candidata ----
const esperadoObj = new Set();
for (const f of archivos) {
  const s = sinComentarios(leer(f));
  const tag = f.slice(0, 14);
  const nombre = f.slice(15, -4);
  for (const m of s.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?([a-z0-9_.]+)/gi)) { const [e, n] = m[1].includes('.') ? m[1].toLowerCase().split('.') : ['public', m[1].toLowerCase()]; esperadoObj.add(`${tag}|${nombre}|tabla|${e}|${n}`); }
  for (const m of s.matchAll(/create\s+function\s+([a-z0-9_.]+)\s*\(/gi)) { const [e, n] = m[1].includes('.') ? m[1].toLowerCase().split('.') : ['public', m[1].toLowerCase()]; esperadoObj.add(`${tag}|${nombre}|funcion|${e}|${n}`); }
}
const enSql = new Set([...sql.matchAll(/\('(\d{14})','([a-z0-9_]+)','(tabla|funcion)','([a-z_]+)','([a-z0-9_]+)'\)/g)].map((m) => m.slice(1, 6).join('|')));
assert.deepEqual([...esperadoObj].filter((x) => !enSql.has(x)), [], 'P2: faltan objetos nuevos de alguna migración candidata');
assert.deepEqual([...enSql].filter((x) => !esperadoObj.has(x)), [], 'P2: hay objetos que ninguna migración candidata crea');

// ---- 3. P3: las huellas md5 son exactamente las que exigen las migraciones ----
const huellasMig = new Set();
const firmasMig = new Set();
for (const f of archivos) {
  const s = leer(f);
  const pre = (s.match(/do \$\$.*?end \$\$;/s) || [''])[0];
  if (!/md5\(/.test(pre)) continue;
  for (const m of pre.matchAll(/'([0-9a-f]{32})'/g)) huellasMig.add(m[1]);
  for (const m of pre.matchAll(/p\.oid='([^']+)'::regprocedure/g)) firmasMig.add(m[1]);
}
const p3 = sql.slice(sql.indexOf('-- P3 ·'), sql.indexOf('-- P4 ·'));
const huellasSql = new Set([...p3.matchAll(/'([0-9a-f]{32})'/g)].map((m) => m[1]));
const firmasSql = new Set([...p3.matchAll(/\('(?:pieza\d|d13|pm07fix)[^']*', '([^']+)', '[0-9a-f]{32}'/g)].map((m) => m[1]));
// La corrección de PM07 comprueba su función con to_regprocedure y p.oid=v_oid (no con p.oid='…'::regprocedure): se añade a mano, verificando el texto.
const PM07_FIRMA = 'private.pm07_numero_catalogo(text,numeric)';
assert.ok(leer('20261003130000_abc_pm07_correccion_numero_catalogo.sql').includes(`to_regprocedure('${PM07_FIRMA}')`), 'la corrección de PM07 debe comprobar su función');
firmasMig.add(PM07_FIRMA);
assert.ok(huellasMig.size === 13 && firmasMig.size === 12, `se esperaban 13 huellas y 12 funciones en las migraciones: ${huellasMig.size}/${firmasMig.size}`);
assert.deepEqual([...huellasMig].sort(), [...huellasSql].sort(), 'P3: las huellas md5 no coinciden con las de las migraciones');
assert.deepEqual([...firmasMig].sort(), [...firmasSql].sort(), 'P3: las funciones comprobadas no coinciden con las de las migraciones');

// ---- 4. P4: las funciones que se reemplazan ----
const reemp = new Set();
for (const f of archivos) for (const m of sinComentarios(leer(f)).matchAll(/create\s+or\s+replace\s+function\s+([a-z0-9_.]+)\s*\(/gi)) reemp.add(m[1].toLowerCase());
const p4 = sql.slice(sql.indexOf('-- P4 ·'), sql.indexOf('-- P5 ·'));
const enP4 = new Set([...p4.matchAll(/^\s+'((?:public|private)\.[a-z0-9_]+)'/gm)].map((m) => m[1]));
assert.deepEqual([...reemp].sort(), [...enP4].sort(), 'P4: las funciones reemplazadas no coinciden con las de las migraciones');

// ---- 5. P5: las 28 tablas que el navegador no puede leer en QA ----
const tablasQa = readFileSync(join(REPO, 'tests/cfg/lib/tablas-sin-acceso-qa.mjs'), 'utf8').match(/SIN_ACCESO_QA = \[(.*?)\];/s)[1].match(/'([^']+)'/g).map((x) => x.slice(1, -1));
const p5 = sql.slice(sql.indexOf('-- P5 ·'), sql.indexOf('-- P6 ·'));
const enP5 = [...p5.matchAll(/^\s+\('([a-z0-9_]+)'\)/gm)].map((m) => m[1]);
assert.deepEqual(enP5.sort(), [...tablasQa].sort(), 'P5: las tablas no coinciden con tests/cfg/lib/tablas-sin-acceso-qa.mjs');

// ---- 6. El documento lista todas las migraciones candidatas y las cifras que cita ----
for (const f of archivos) assert.ok(doc.includes(`\`${f.slice(0, 14)}\``) && doc.includes(`\`${f.slice(15, -4)}\``), `el documento no lista la migración ${f}`);
const filasTabla = doc.split('\n').filter((l) => /^\| \d+ \| `\d{14}` \|/.test(l));
assert.equal(filasTabla.length, archivos.length, 'la tabla del apéndice A debe tener una fila por migración candidata');
assert.ok(doc.includes(`${archivos.length} migraciones candidatas`) || doc.includes(`Las ${archivos.length} migraciones candidatas`) || doc.includes(`${archivos.length} archivos desde`), 'el documento debe citar el número de migraciones candidatas');
assert.ok(doc.includes(`**${reemp.size} funciones**`), `el documento debe citar las ${reemp.size} funciones reemplazadas`);
console.log(`f7-preflight-static-contract: OK (${archivos.length} migraciones, ${esperadoObj.size} objetos, ${huellasMig.size} huellas, ${reemp.size} funciones reemplazadas, ${tablasQa.length} tablas)`);
