import assert from 'node:assert/strict';
import fs from 'node:fs';

const sql = fs.readFileSync('supabase/migrations/20261001210000_abc_f5_c11_explainable_reconciliation.sql', 'utf8');
const doc = fs.readFileSync('docs/plan-abc/F5_C11_CONTRATO_CONCILIACION_EXPLICABLE_2026-10-01.md', 'utf8');

for (const marker of [
  'abc_c11_conciliaciones_documentales',
  'abc_generar_conciliacion_documental',
  'DOCUMENTO_CONCILIADO',
  'PENDIENTE_ENTREGA',
  'INCONSISTENTE',
  'ENTREGA_FALTANTE',
  'informe_hash',
  'explicacion',
  'private.abc_request_hash',
  'private.abc_operacion_iniciar',
]) assert.match(sql, new RegExp(marker.replace(/[.*+?^${}()|[\\]\\]/g, '\\\\$&'), 'i'), `falta ${marker}`);

for (const marker of [
  'conciliación',
  'explicable',
  'emitido',
  'conservada',
  'PENDIENTE_ENTREGA',
  'No se aplican migraciones remotas',
]) assert.match(doc, new RegExp(marker.replace(/[.*+?^${}()|[\\]\\]/g, '\\\\$&'), 'i'), `documento: falta ${marker}`);

assert.match(sql, /constraint abc_c11_conciliacion_resultado check \(resultado in \('CONCILIADO','PENDIENTE_ENTREGA','INCONSISTENTE'\)\)/i);
assert.match(sql, /constraint abc_c11_conciliacion_hash check \(informe_hash ~ '\^\[0-9a-f\]\{64\}\$'/i);
assert.match(sql, /before update or delete on public\.abc_c11_conciliaciones_documentales/i);
assert.match(sql, /alter table public\.abc_c11_conciliaciones_documentales enable row level security/i);
console.log('ABC_F5_C11_RECONCILIATION_CONTRACT=PASS_WITH_POSTGRES_PENDING');
