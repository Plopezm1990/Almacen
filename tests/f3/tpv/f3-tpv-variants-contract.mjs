import fs from 'node:fs';
import assert from 'node:assert/strict';

const contract = fs.readFileSync('docs/plan-abc/F3_4_CONTRATO_VARIANTES_SUPLEMENTOS_2026-10-01.md', 'utf8');

for (const term of ['Modelo de selección', 'Producto base', 'Variante', 'Grupo', 'Suplemento', 'Línea', 'Preparación', 'Casos mínimos', 'Preparación y stock', 'Criterios de aceptación F3.4']) {
  assert.match(contract, new RegExp(term, 'i'), `F3.4 falta ${term}`);
}
assert.match(contract, /CONTRATO_VARIANTES_PREPARADO_NO_APLICADO/);
assert.match(contract, /rechazo en servidor/i);
assert.match(contract, /líneas históricas siguen legibles/i);
assert.match(contract, /No cambia\s+catálogo, stock, base de datos, merge ni deploy/i);

console.log('ABC_F3_TPV_VARIANTS_CONTRACT=PASS');
