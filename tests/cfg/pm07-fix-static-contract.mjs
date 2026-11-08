// Contrato estático de la corrección de PM07 (migración 20261003130000): el texto de la migración es lo que se dijo que era.
//
// Qué vigila (no necesita base de datos ni librerías):
//   - la función nueva es EXACTAMENTE la de la migración original de PM07 (20260928170000): mismo cuerpo, byte a byte; es decir, el destino de la
//     corrección es el texto canónico del repositorio, no una versión retocada;
//   - las dos huellas md5 de la comprobación previa son las reales: la del cuerpo correcto y la del borrador de producción (el mismo cuerpo sin la
//     barra invertida de la expresión regular);
//   - la migración solo hace tres cosas: `set local lock_timeout`, la comprobación previa y un `create or replace function` de esa única función;
//     no toca tablas, disparadores, permisos ni la otra función de PM07;
//   - la comprobación previa va antes de la función y tiene sus dos rechazos (función ausente y cuerpo desconocido).
//   node tests/cfg/pm07-fix-static-contract.mjs
// PM07_FIX_MIGRACION (opcional) permite probar otra versión de la migración (mutantes).
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const REPO = resolve(new URL('../../', import.meta.url).pathname);
const ruta = process.env.PM07_FIX_MIGRACION || join(REPO, 'supabase/migrations/20261003130000_abc_pm07_correccion_numero_catalogo.sql');
const fix = readFileSync(ruta, 'utf8');
const original = readFileSync(join(REPO, 'supabase/migrations/20260928170000_pm07_bootstrap_stock_desde_productos.sql'), 'utf8');
const md5 = (s) => createHash('md5').update(s.replace(/\r/g, '')).digest('hex');
const sinComentarios = (s) => s.replace(/--[^\n]*/g, '');

const DESTINO = '7f36af3c791b2d94a2c76aed2ee4a095'; // versión del archivo de PM07 y de QA
const BORRADOR = '3dcbe27249f1fd2d37c40ea6398d0215'; // versión de producción el 3/10/2026 (sin la barra invertida)

function funcion(texto, nombre) {
  const m = texto.match(new RegExp(`create or replace function ${nombre.replace('.', '\\.')}\\(([^)]*)\\)\\n([\\s\\S]*?)\\nas \\$\\$([\\s\\S]*?)\\$\\$;`));
  assert.ok(m, `no se encuentra la función ${nombre}`);
  return { firma: m[1], atributos: m[2], cuerpo: m[3] };
}

// ---- 1. El destino es el texto canónico de PM07 ----
const nueva = funcion(fix, 'private.pm07_numero_catalogo');
const canonica = funcion(original, 'private.pm07_numero_catalogo');
assert.equal(nueva.cuerpo, canonica.cuerpo, 'el cuerpo de la función debe ser idéntico al de la migración original de PM07');
assert.equal(nueva.firma, canonica.firma, 'la firma debe ser idéntica a la de PM07');
assert.equal(nueva.atributos, canonica.atributos, 'los atributos (returns, language, immutable, search_path) deben ser idénticos a los de PM07');
assert.equal(md5(nueva.cuerpo), DESTINO, 'la huella del cuerpo no es la conocida');
assert.ok(nueva.cuerpo.includes('\\.[0-9]'), 'la expresión regular debe llevar el punto escapado');

// ---- 2. El borrador de producción es el mismo cuerpo sin la barra invertida ----
assert.equal(md5(nueva.cuerpo.replace('\\.[0-9]', '.[0-9]')), BORRADOR, 'el borrador de producción debe ser el cuerpo sin la barra invertida');
const sinc = sinComentarios(fix);
assert.ok(sinc.includes(`distinct from '${BORRADOR}'`), 'la comprobación previa debe aceptar el borrador de producción');
assert.ok(sinc.includes(`distinct from '${DESTINO}'`), 'la comprobación previa debe aceptar la versión correcta (repetición sin efecto)');
assert.equal([...sinc.matchAll(/'([0-9a-f]{32})'/g)].length, 2, 'solo debe haber dos huellas en la comprobación previa');

// ---- 3. Solo hace tres cosas ----
const sentencias = sinc.replace(/\$\$[\s\S]*?\$\$/g, () => '$$BODY$$').split(';').map((x) => x.trim()).filter(Boolean);
assert.equal(sentencias.length, 3, `la migración debe tener exactamente 3 sentencias: ${sentencias.map((x) => x.slice(0, 40)).join(' | ')}`);
assert.match(sentencias[0], /^set local lock_timeout = '10s'$/);
assert.match(sentencias[1], /^do \$\$BODY\$\$$/);
assert.match(sentencias[2], /^create or replace function private\.pm07_numero_catalogo\(/);
for (const p of ['insert', 'update', 'delete', 'drop', 'alter', 'grant', 'revoke', 'trigger', 'truncate', 'security definer']) {
  assert.ok(!new RegExp(`\\b${p}\\b`, 'i').test(sinc.replace(/\$\$\s*declare[\s\S]*?end \$\$/, '')), `la migración no debe contener «${p}»`);
}
assert.ok(!/pm07_inicializar_stock_desde_productos_kv/.test(sinc), 'la migración no debe tocar la otra función de PM07');

// ---- 4. La comprobación previa va antes y tiene sus dos rechazos ----
assert.ok(fix.indexOf('do $$') < fix.indexOf('create or replace function'), 'la comprobación previa debe ir antes de reemplazar la función');
assert.ok(sinc.includes("raise exception 'ABC_PM07_FIX_PREFLIGHT_FALLO:funcion_ausente:pm07_numero_catalogo'"), 'falta el rechazo por función ausente');
assert.ok(sinc.includes("raise exception 'ABC_PM07_FIX_PREFLIGHT_FALLO:funcion_distinta:pm07_numero_catalogo:%'"), 'falta el rechazo por cuerpo desconocido');
assert.ok(sinc.includes("to_regprocedure('private.pm07_numero_catalogo(text,numeric)')"), 'la comprobación previa debe mirar esa firma exacta');
assert.ok(sinc.includes("md5(replace(p.prosrc,chr(13),''))"), 'la huella debe calcularse sin el retorno de carro, igual que las demás migraciones');
console.log('pm07-fix-static-contract: OK');
