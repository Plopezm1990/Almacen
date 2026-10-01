import fs from 'node:fs';
import assert from 'node:assert/strict';

const contract = fs.readFileSync('docs/plan-abc/F3_3_CONTRATO_CUENTAS_RECUPERACION_2026-10-01.md', 'utf8');

for (const term of ['Identidad y versiones', 'Escenarios de concurrencia', 'Recuperación', 'Caducidad de borradores', 'Criterios de aceptación F3.3', 'expected_version', 'operation_id']) {
  assert.match(contract, new RegExp(term.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&'), 'i'), `F3.3 falta ${term}`);
}
assert.match(contract, /CONTRATO_CONCURRENCIA_PREPARADO_NO_APLICADO/);
assert.match(contract, /no hay sobrescritura silenciosa/i);
assert.match(contract, /borradores locales no mutan pagos/i);
assert.match(contract, /No requiere migración remota, merge ni deploy/i);

console.log('ABC_F3_TPV_RECOVERY_CONTRACT=PASS');
