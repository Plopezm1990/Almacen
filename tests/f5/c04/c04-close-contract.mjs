import fs from 'node:fs';
import assert from 'node:assert/strict';

const doc = fs.readFileSync('docs/plan-abc/F5_C04_CONTRATO_CIERRE_SESION_2026-10-01.md', 'utf8');
const sessions = fs.readFileSync('supabase/migrations/20260923210000_abc_f2_m01_base_transaccional_caja.sql', 'utf8');
const close = fs.readFileSync('supabase/migrations/20260928223000_pm10_cierre_sesion_caja.sql', 'utf8');

for (const term of [
  'Estados requeridos',
  'CIERRE_PROVISIONAL',
  'CERRADA_FINAL',
  'pago `DESCONOCIDO`',
  'Lo que ya existe',
  'Pendiente para el cierre operativo de C04',
  'reapertura',
  'Criterios de aceptación pendientes',
]) {
  assert.match(doc, new RegExp(term.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&'), 'i'), `C04 falta ${term}`);
}
assert.match(doc, /CANDIDATO_C04_(IMPLEMENTADO_NO_APLICADO|VALIDADO_PG_NO_APLICADO)/);
assert.match(doc, /no se\s+escriben QA\/PROD|sin aplicarse en QA\/PROD/i);

for (const state of ['PREPARANDO_APERTURA', 'ABIERTA', 'EN_CIERRE', 'CIERRE_PROVISIONAL', 'CERRADA_FINAL']) {
  assert.match(sessions, new RegExp(state));
}
for (const term of ['abc_cerrar_sesion_caja', 'sesion_caja_no_abierta', 'expected_amount', 'counted_amount', 'difference', 'CAJA_SESION_CERRADA']) {
  assert.match(close, new RegExp(term, 'i'), `C04 falta implementación existente ${term}`);
}
assert.doesNotMatch(close, /abc_reabrir_sesion_caja/i);
assert.doesNotMatch(close, /CIERRE_PROVISIONAL/);

console.log('ABC_F5_C04_CLOSE_CONTRACT=PASS_WITH_PENDING_PROVISIONAL');
