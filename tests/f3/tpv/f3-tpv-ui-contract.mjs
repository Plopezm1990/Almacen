import fs from 'node:fs';
import assert from 'node:assert/strict';

const contract = fs.readFileSync('docs/plan-abc/F3_2_CONTRATO_UI_TPV_2026-10-01.md', 'utf8');

for (const term of ['Contexto', 'Catálogo', 'Línea activa', 'Desglose', 'Preparación', 'Cobro', 'Conexión', 'Interacciones obligatorias', 'Estados visibles', 'Criterios de aceptación F3.2']) {
  assert.match(contract, new RegExp(term, 'i'), `F3.2 falta ${term}`);
}
for (const state of ['PENDIENTE', 'DESCONOCIDO', 'CONFLICTO_VERSION', 'DENEGADO', 'RECHAZADO', 'ERROR_REINTENTABLE']) {
  assert.match(contract, new RegExp(state), `F3.2 falta estado ${state}`);
}
assert.match(contract, /CONTRATO_UI_PREPARADO_NO_APLICADO/);
assert.match(contract, /ni\s+solicita PAN\/CVV/i);
assert.match(contract, /sin tocar todavía\s+fuente publicada/i);
assert.match(contract, /ni deploy de Netlify/i);

console.log('ABC_F3_TPV_UI_CONTRACT=PASS');
