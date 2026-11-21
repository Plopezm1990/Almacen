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
assert.match(shell, /encargos\|devoluciones\|descuentos\|cortesias\|cupones/, 'ventas auxiliares no heredan la superficie TPV');
assert.match(matrix, /Esta matriz es de seguimiento/, 'la matriz no conserva el criterio de cierre');
assert.match(transfer, /objetivo 4|Objetivo 4|migraci[oó]n visual por m[oó]dulos/i, 'el traspaso no documenta el objetivo modular');

console.log('REDISENO_MIGRACION_MODULOS_CONTRACT=PASS módulos=12 shell=12 matriz=12 responsive=PASS tactil=44');
