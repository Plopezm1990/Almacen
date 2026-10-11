import fs from 'node:fs';
import assert from 'node:assert/strict';

const migration = fs.readFileSync('supabase/migrations/20261011153000_abc_f5_c04_qa_reconcile.sql', 'utf8');
const closeMigration = fs.readFileSync('supabase/migrations/20261001140000_abc_f5_c04_close_reopen.sql', 'utf8');
const sources = [
  'fuente.js',
  'source-recovery/fuente-recuperado.js',
].map((path) => ({ path, text: fs.readFileSync(path, 'utf8') }));

for (const fn of [
  'abc_qa_listar_pendientes_cierre',
  'abc_qa_compensar_efecto_cierre',
  'abc_qa_cancelar_pago_cierre',
]) {
  assert.match(migration, new RegExp(`create or replace function public\\.${fn}\\(`), `falta ${fn}`);
  assert.match(migration, new RegExp(`grant execute on function public\\.${fn}\\([\\s\\S]*? to authenticated;`, 'i'), `falta grant de ${fn}`);
  assert.match(migration, new RegExp(`revoke all on function public\\.${fn}\\([\\s\\S]*? from public,anon,service_role;`, 'i'), `falta revoke de ${fn}`);
}

for (const term of [
  "p_empresa_id='QA-EMP-A'",
  "p_local_id='QA-A1'",
  "m.rol='Propietario'",
  "v_session.estado<>'CIERRE_PROVISIONAL'",
  'QA_EFECTO_COMPENSADO',
  'QA_PAGO_SIMULADO_CANCELADO',
  "estado='COMPLETADO'",
  "'CANCELADO'",
  'qa.f5.c04.effect.compensate.',
  'qa.f5.c04.payment.cancel.',
  "o.operation_id like 'f4.b02b03.pay.%'",
  "'QA_SIMULADO'",
]) {
  assert.match(migration, new RegExp(term.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&'), 'i'), `falta requisito ${term}`);
}

assert.match(migration, /e\.estado in \('PENDIENTE','EN_PROCESO','ERROR'\)/i);
assert.match(migration, /p\.estado in \('PENDIENTE','AUTORIZADO','DESCONOCIDO'\)/i);
assert.match(migration, /already_resolved/);
assert.match(migration, /abc_resolver_intento\(/);
assert.doesNotMatch(migration, /delete\s+from\s+public\.(efectos_pendientes|pagos|pago_intentos)/i);
assert.doesNotMatch(migration, /grant execute on function public\.abc_qa_[^;]+ to service_role/i);

for (const { path, text } of sources) {
  for (const term of [
    'Pendientes QA del cierre',
    'Registrar compensación QA',
    'Cancelar pago simulado QA',
    'listarPendientesCierreQA',
    'compensarEfectoCierreQA',
    'cancelarPagoCierreQA',
    'abc_qa_listar_pendientes_cierre',
    'abc_qa_compensar_efecto_cierre',
    'abc_qa_cancelar_pago_cierre',
  ]) {
    assert.match(text, new RegExp(term.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')), `${path}: falta ${term}`);
  }
}

for (const term of ['cierre_definitivo_bloqueado', 'PAGOS_PENDIENTES', 'EFECTOS_PENDIENTES']) {
  assert.match(closeMigration, new RegExp(term, 'i'), `guardia D10 alterada: falta ${term}`);
}

console.log('ABC_F5_C04_QA_RECONCILE_CONTRACT=PASS');
