import assert from 'node:assert/strict';
import fs from 'node:fs';

const sql = fs.readFileSync('supabase/migrations/20261001180000_abc_f5_c08_document_retention.sql', 'utf8');
const doc = fs.readFileSync('docs/plan-abc/F5_C08_CONTRATO_CONSERVACION_CORRECCION_2026-10-01.md', 'utf8');

for (const marker of [
  'abc_c08_documento_versiones',
  'abc_c08_correcciones_documentales',
  'abc_conservar_documento_emitido',
  'abc_registrar_correccion_documental',
  'snapshot_hash',
  'documento_version_inmutable',
  'correccion_documental_inmutable',
  'DOCUMENTO_CONSERVADO',
  'DOCUMENTO_CORREGIDO',
  'FACTURA_RECTIFICATIVA',
  'CANCELACION_OPERATIVA',
  'REEMBOLSO',
  'private.abc_operacion_iniciar',
]) assert.match(sql, new RegExp(marker.replace(/[.*+?^${}()|[\\]\\]/g, '\\\\$&'), 'i'), `falta ${marker}`);

for (const marker of [
  'inmutable',
  'RECTIFICACION',
  'CANCELACION_OPERATIVA',
  'REEMBOLSO',
  'snapshot_hash',
  'No se aplican migraciones',
]) assert.match(doc, new RegExp(marker.replace(/[.*+?^${}()|[\\]\\]/g, '\\\\$&'), 'i'), `documento: falta ${marker}`);

assert.match(sql, /constraint abc_c08_version_hash check \(snapshot_hash ~ '\^\[0-9a-f\]\{64\}\$'/i);
assert.match(sql, /constraint abc_c08_correccion_tipo check \(tipo_correccion in \('RECTIFICACION','CANCELACION_OPERATIVA','REEMBOLSO'\)\)/i);
assert.match(sql, /if v_tipo='RECTIFICACION' and p_documento_correccion_id is null then/i);
assert.match(sql, /v_clasificacion\.tipo_documental<>'FACTURA_RECTIFICATIVA'/i);
assert.match(sql, /alter table public\.abc_c08_documento_versiones enable row level security/i);
assert.match(sql, /alter table public\.abc_c08_correcciones_documentales enable row level security/i);
console.log('ABC_F5_C08_RETENTION_CONTRACT=PASS_WITH_POSTGRES_PENDING');
