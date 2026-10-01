import assert from 'node:assert/strict';
import fs from 'node:fs';

const contract = fs.readFileSync('docs/plan-abc/F4_B12_CONTRATO_ENSAYO_PAGOS_2026-10-01.md', 'utf8');
const b07 = fs.readFileSync('docs/plan-abc/F4_B07_CONTRATO_TECNICO_2026-09-30.md', 'utf8');
const b08 = fs.readFileSync('docs/plan-abc/F4_B08_CONTRATO_TECNICO_2026-09-30.md', 'utf8');
const evidence = fs.readFileSync('docs/plan-abc/F4_B12_EVIDENCIA_SIMULADOR_2026-10-01.md', 'utf8');

for (const scenario of [
  'Rechazo', 'Cancelación', 'Doble clic / replay', 'Resultado incierto',
  'Evento duplicado', 'Pago parcial', 'Reembolso concurrente', 'Expiración',
]) assert.match(contract, new RegExp(scenario.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
assert.match(contract, /SIMULATOR_VALIDATED/g);
assert.match(contract, /PROVIDER_SANDBOX_PENDING/g);
assert.match(contract, /BLOCKED_UNVERIFIED/);
assert.match(contract, /No se usarán credenciales reales/i);
assert.match(b07, /simulador/i);
assert.match(b08, /simulador/i);
assert.doesNotMatch(contract, /sandbox real.*VALIDATED/i);
for (const result of [
  'ABC_F4_B07_WEBHOOK_CONTRACT=PASS',
  'ABC_F4_B07_GENERIC_PROVIDERS=PASS',
  'ABC_F4_B08_REFUND_ADAPTER=PASS',
  'ABC_F4_B08_UI=PASS',
  'ABC_F4_B12_PAYMENT_TRIAL_MATRIX=PASS',
]) assert.match(evidence, new RegExp(result.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
assert.match(evidence, /PROVIDER_SANDBOX_PENDING/);

console.log('ABC_F4_B12_PAYMENT_TRIAL_MATRIX=PASS');
