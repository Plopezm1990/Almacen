import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const index = readFileSync(resolve(root, 'index.html'), 'utf8');
const layer = readFileSync(resolve(root, 'la-plantillas-orbita.js'), 'utf8');
const css = readFileSync(resolve(root, 'la-apariencia.css'), 'utf8');
const tableLayer = readFileSync(resolve(root, 'la-tablas-fichas.js'), 'utf8');
const shell = readFileSync(resolve(root, 'la-orbita-shell.js'), 'utf8');
const matrix = readFileSync(resolve(root, 'docs/rediseno/MATRIZ-MIGRACION-MODULOS-ORBITA-2026-11-21.md'), 'utf8');

const templates = [
  'panel', 'listado', 'ficha', 'formulario', 'tabla',
  'detalle', 'tpv', 'cola-operativa', 'configuracion', 'movil'
];
const modules = [
  'inicio', 'tpv', 'pase', 'cocina', 'caja', 'clientes', 'compras',
  'inventario', 'personal', 'configuracion', 'plataforma', 'acceso'
];

for (const template of templates) {
  assert.match(layer, new RegExp(`['"]${template}['"]`), `falta la plantilla ${template}`);
  const selector = template === 'movil'
    ? 'data-la-orbita-mobile-template="movil"'
    : `data-la-orbita-template="${template}"`;
  assert.ok(css.includes(selector) || css.includes(`data-la-plantilla="${template}"`),
    `la plantilla ${template} no tiene reglas visuales`);
}

for (const moduleName of modules) {
  assert.match(layer, new RegExp(`${moduleName}:\\s*['"][a-z-]+['"]`), `falta el mapeo de ${moduleName}`);
  assert.ok(shell.includes(`"${moduleName}"`) || shell.includes(`'${moduleName}'`), `el shell no conserva ${moduleName}`);
}

assert.match(index, /la-plantillas-orbita\.js\?v=qa-orbita-plantillas-v1-20261121/,
  'la capa de plantillas no está enlazada con marca de caché');
assert.equal((index.match(/la-plantillas-orbita\.js/g) || []).length, 1,
  'la capa de plantillas debe cargarse una sola vez');
assert.match(layer, /data-la-orbita-template/);
assert.match(layer, /data-la-orbita-mobile-template/);
assert.match(layer, /MutationObserver/);
assert.match(layer, /window\.LAPlantillasOrbita/);
assert.doesNotMatch(layer, /fetch\s*\(|supabase|\.rpc\s*\(/i,
  'la capa de plantillas no puede llamar al servidor ni a RPC');
assert.match(tableLayer, /data-etiqueta/);
assert.match(tableLayer, /MutationObserver/);
assert.ok(css.includes('min-width: 0'), 'las plantillas deben permitir reducir columnas sin overflow');
assert.ok(css.includes('overflow-x: clip'), 'el marco móvil debe cortar overflow horizontal accidental');
assert.ok(css.includes('overscroll-behavior-inline: contain'), 'las tablas móviles deben encapsular su desplazamiento');
assert.ok(css.includes('data-la-plantilla="formulario"') && css.includes('min-width: 0'),
  'la plantilla formulario no acota el ancho');
assert.ok(css.includes('data-la-plantilla="detalle"') && css.includes('max-height: calc(100dvh - 24px)'),
  'la plantilla detalle no acota el alto del diálogo');
assert.match(matrix, /Plantillas Órbita reutilizables/);
assert.match(matrix, /plantillas=10/);
assert.match(matrix, /decisión explícita/);

console.log('REDISENO_PLANTILLAS_ORBITA_CONTRACT=PASS plantillas=10 modulos=12 movil=PASS sin-rpc=PASS');
