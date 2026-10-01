import fs from 'node:fs';
import assert from 'node:assert/strict';

const doc = fs.readFileSync('docs/plan-abc/F5_C04_CONTRATO_CIERRE_SESION_2026-10-01.md', 'utf8');
const sql = fs.readFileSync('supabase/migrations/20261001140000_abc_f5_c04_close_reopen.sql', 'utf8');

for (const fn of [
  'abc_iniciar_cierre_sesion_caja',
  'abc_confirmar_cierre_provisional',
  'abc_finalizar_cierre_sesion_caja',
  'abc_reabrir_cierre_provisional',
]) {
  assert.match(sql, new RegExp(`create function public\\.${fn}\\(`), `C04 falta ${fn}`);
  assert.match(sql, new RegExp(`grant execute on function public\\.${fn}`), `C04 falta grant ${fn}`);
  assert.match(sql, new RegExp(`revoke all on function public\\.${fn}`), `C04 falta revoke ${fn}`);
}
for (const term of [
  'abc_c04_bloqueos_cierre',
  'abc_c04_guard_final_session',
  'cierre_definitivo_requiere_provisional',
  'cierre_definitivo_bloqueado',
  'PAGOS_PENDIENTES',
  'EFECTOS_PENDIENTES',
  'CAJA_SESION_CIERRE_PROVISIONAL',
  'CAJA_SESION_REABIERTA',
  'operation_id',
]) {
  assert.match(sql, new RegExp(term, 'i'), `C04 falta ${term}`);
}
assert.doesNotMatch(sql, /grant execute on function public\.[^;]+ to service_role/i);
assert.match(doc, /CANDIDATO_C04_(IMPLEMENTADO_NO_APLICADO|VALIDADO_PG_NO_APLICADO)/);
assert.match(doc, /Decidir y autorizar la aplicación en QA|Aplicar y verificar la migración en una base PostgreSQL/i);
assert.match(doc, /Reabrir una\s+sesión `CERRADA_FINAL` queda fuera/i);

console.log('ABC_F5_C04_CLOSE_IMPLEMENTATION=PASS_WITH_POSTGRES_PENDING');
