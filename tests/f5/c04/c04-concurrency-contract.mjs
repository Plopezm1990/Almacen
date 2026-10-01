import fs from 'node:fs';
import assert from 'node:assert/strict';

const closeSql = fs.readFileSync('supabase/migrations/20261001140000_abc_f5_c04_close_reopen.sql', 'utf8');
const cobroSql = fs.readFileSync('supabase/migrations/20260923234500_abc_f2_m03b_checkout_cobro.sql', 'utf8');
const reembolsoSql = fs.readFileSync('supabase/migrations/20260923235900_abc_f2_m03c_reembolsos_transaccionales.sql', 'utf8');

function functionBody(sql, name) {
  const start = sql.indexOf(`function public.${name}(`);
  assert.notEqual(start, -1, `falta la función ${name}`);
  const end = sql.indexOf('\ncreate ', start + 10);
  return sql.slice(start, end === -1 ? sql.length : end);
}

const iniciar = functionBody(closeSql, 'abc_iniciar_cierre_sesion_caja');
const provisional = functionBody(closeSql, 'abc_confirmar_cierre_provisional');
const finalizar = functionBody(closeSql, 'abc_finalizar_cierre_sesion_caja');
const reabrir = functionBody(closeSql, 'abc_reabrir_cierre_provisional');

assert.match(iniciar, /estado='ABIERTA'\s+for update/i);
assert.match(provisional, /estado='INICIADO'\s+for update/i);
assert.match(provisional, /estado='EN_CIERRE'\s+for update/i);
assert.match(finalizar, /estado='PROVISIONAL'\s+for update/i);
assert.match(finalizar, /estado='CIERRE_PROVISIONAL'\s+for update/i);
assert.match(reabrir, /estado='PROVISIONAL'\s+for update/i);
assert.match(reabrir, /estado='CIERRE_PROVISIONAL'\s+for update/i);

assert.match(closeSql, /before update of estado on public\.caja_sesiones/i);
assert.match(closeSql, /old\.estado<>'CIERRE_PROVISIONAL'/i);
assert.match(closeSql, /cierre_definitivo_bloqueado/i);
assert.match(cobroSql, /s\.estado='ABIERTA'\s+for update/i);
assert.match(reembolsoSql, /s\.estado='ABIERTA'/i);

for (const body of [iniciar, provisional, finalizar, reabrir]) {
  assert.match(body, /abc_operacion_iniciar/);
  assert.match(body, /abc_operacion_completar/);
  assert.match(body, /abc_operacion_fallar/);
}

console.log('ABC_F5_C04_CONCURRENCY_CONTRACT=PASS_WITH_POSTGRES_PENDING');
