import assert from 'node:assert/strict';
import fs from 'node:fs';

const sql = fs.readFileSync('supabase/migrations/20261001200000_abc_f5_c10_document_delivery.sql', 'utf8');
const doc = fs.readFileSync('docs/plan-abc/F5_C10_CONTRATO_ENTREGA_COPIAS_2026-10-01.md', 'utf8');

for (const marker of [
  'abc_c10_entregas_documentales',
  'abc_registrar_entrega_documental',
  'entrega_papel_sin_impresion',
  'impresion_no_corresponde_documento',
  'DOCUMENTO_ENTREGADO',
  'REGISTRADA',
  'ORIGINAL',
  'COPIA',
  'private.abc_operacion_iniciar',
]) assert.match(sql, new RegExp(marker.replace(/[.*+?^${}()|[\\]\\]/g, '\\\\$&'), 'i'), `falta ${marker}`);

for (const marker of [
  'entrega',
  'copias',
  'misma versión',
  'no como confirmación',
  'ensayo conectado en QA',
]) assert.match(doc, new RegExp(marker.replace(/[.*+?^${}()|[\\]\\]/g, '\\\\$&'), 'i'), `documento: falta ${marker}`);

assert.match(sql, /constraint abc_c10_entrega_tipo check \(tipo_entrega in \('ORIGINAL','COPIA'\)\)/i);
assert.match(sql, /constraint abc_c10_entrega_canal check \(canal in \('PAPEL','EMAIL','DESCARGA','API'\)\)/i);
assert.match(sql, /constraint abc_c10_entrega_estado check \(estado in \('REGISTRADA','CONFIRMADA','FALLIDA'\)\)/i);
assert.match(sql, /before update or delete on public\.abc_c10_entregas_documentales/i);
assert.match(sql, /insert into public\.abc_c10_entregas_documentales/i);
console.log('ABC_F5_C10_DELIVERY_CONTRACT=PASS_WITH_LIFECYCLE_PENDING');
