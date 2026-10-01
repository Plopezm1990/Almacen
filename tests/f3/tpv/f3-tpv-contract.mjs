import fs from 'node:fs';
import assert from 'node:assert/strict';

const contract = fs.readFileSync('docs/plan-abc/F3_1_CONTRATO_TPV_AUTORIDAD_2026-10-01.md', 'utf8');

for (const term of ['Recorrido de venta', 'Contrato de línea', 'operation_id', 'CONFLICTO_VERSION', 'DESCONOCIDO', 'Criterios de aceptación F3.1']) {
  assert.match(contract, new RegExp(term, 'i'), `F3.1 falta ${term}`);
}
assert.match(contract, /CONTRATO_PREPARADO_NO_APLICADO/);
assert.match(contract, /servidor es la fuente del total/i);
assert.match(contract, /no genera segundo cargo/i);
assert.match(contract, /No se hace migración remota, merge ni deploy/i);

console.log('ABC_F3_TPV_CONTRACT=PASS');
