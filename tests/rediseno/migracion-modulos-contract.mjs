import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const css = readFileSync(resolve(root, 'la-apariencia.css'), 'utf8');
const shell = readFileSync(resolve(root, 'la-orbita-shell.js'), 'utf8');
const matrix = readFileSync(resolve(root, 'docs/rediseno/MATRIZ-MIGRACION-MODULOS-ORBITA-2026-11-21.md'), 'utf8');
const transfer = readFileSync(resolve(root, 'docs/rediseno/TRASPASO_QA_CLAUDE_2026-11-17.md'), 'utf8');

const modules = [
  ['inicio', 'Inicio y panel general'],
  ['tpv', 'TPV y sala'],
  ['pase', 'Pase'],
  ['cocina', 'Cocina'],
  ['caja', 'Caja'],
  ['clientes', 'Clientes'],
  ['compras', 'Compras'],
  ['inventario', 'Inventario'],
  ['personal', 'Personal'],
  ['configuracion', 'Configuración'],
  ['plataforma', 'Plataforma'],
  ['acceso', 'Acceso']
];

for (const [id, label] of modules) {
  assert.match(shell, new RegExp(`['\"]${id}['\"]`), `el shell no enumera ${label}`);
  if (id === 'acceso') {
    assert.ok(css.includes('.la-acceso'), 'Acceso no tiene raíz visual');
  } else {
    assert.ok(css.includes(`data-la-orbita-module="${id}"`), `${label} no tiene superficie CSS scoped`);
  }
  assert.match(matrix, new RegExp(`\|[^|]+\|\s*${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\s*\|`), `${label} no figura en la matriz`);
}

assert.match(css, /min-height:\s*var\(--la-control-height\)/, 'falta altura táctil común');
assert.match(css, /@media\s*\(max-width:\s*767px\)/, 'falta adaptación móvil');
assert.match(css, /prefers-reduced-motion:\s*reduce/, 'falta reducción de movimiento');
assert.match(shell, /labelEncabezado\s*=\s*textoVisible\(main && main\.querySelector\("h1, h2"\)\)/, 'las pantallas históricas no usan su encabezado para anclar el módulo');
assert.match(shell, /labelParaCoincidencia[\s\S]{0,260}normalize\("NFD"\)/, 'las rutas con tildes no normalizan su etiqueta antes de clasificarse');
assert.match(shell, /encargos\|devoluciones\|descuentos\|cortesias\|cupones/, 'ventas auxiliares no heredan la superficie TPV');
assert.ok(shell.includes('reconciliaci[oó]n'), 'Reconciliación no hereda la superficie Inventario');
assert.match(shell, /traspasos\|reconciliacion\|inventario ciego/, 'Traspasos no prioriza la superficie Inventario');
assert.match(shell, /registro horario|cuadrante de turnos/, 'Registro horario no hereda la superficie Personal');
assert.ok(shell.indexOf('encargos|devoluciones|descuentos|cortesias|cupones') < shell.indexOf('\\\\bpersonal\\\\b|\\\\bempleados\\\\b'), 'Encargos no debe confundirse con Personal');
assert.match(matrix, /Esta matriz es de seguimiento/, 'la matriz no conserva el criterio de cierre');
assert.match(transfer, /objetivo 4|Objetivo 4|migraci[oó]n visual por m[oó]dulos/i, 'el traspaso no documenta el objetivo modular');

// La pasada móvil live se conserva como contrato documental. Esto no finge
// una sesión autenticada: fija únicamente que el shell móvil fue recorrido,
// que las diez entradas observadas resolvieron su superficie y que el criterio
// de 390×844/44px/overflow no se puede borrar sin actualizar la evidencia.
assert.match(matrix, /Recorrido visual m[oó]vil/, 'falta la evidencia móvil del recorrido modular');
assert.match(matrix, /390 ×\s*844 px/, 'la evidencia móvil no fija el viewport');
assert.match(matrix, /10\/10 rutas m[oó]viles clasificadas correctamente/, 'la evidencia móvil no fija el resultado');
for (const route of ['Panel general', 'TPV', 'Cocina', 'Proveedores', 'Productos', 'Personal', 'Clientes', 'Configuración', 'Arqueo de caja', 'Encargos']) {
  assert.match(matrix, new RegExp(`\\| ${route.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')} \\|`), `la evidencia móvil no incluye ${route}`);
}
assert.match(transfer, /Evidencia visual m[oó]vil/, 'el traspaso no conserva la evidencia móvil');
assert.match(transfer, /overflow=false/, 'el traspaso no conserva el criterio de overflow móvil');
assert.match(transfer, /control visible m[ií]nimo de \*\*44 px\*\*/, 'el traspaso no conserva el criterio táctil móvil');
assert.match(matrix, /Acceso · revisi[oó]n visual no autenticada/, 'la matriz no conserva la revisión responsive de Acceso');
assert.match(matrix, /390 × 844 px.*1440 × 900 px/s, 'la matriz no fija los dos viewports de Acceso');
assert.match(transfer, /Acceso · revisi[oó]n responsive no autenticada/, 'el traspaso no conserva la revisión responsive de Acceso');

console.log('REDISENO_MIGRACION_MODULOS_CONTRACT=PASS módulos=12 shell=12 matriz=12 responsive=PASS tactil=44');
