import assert from 'node:assert/strict';
import fs from 'node:fs';

const sql = fs.readFileSync('supabase/migrations/20261001190000_abc_f5_c09_document_printing.sql', 'utf8');
const doc = fs.readFileSync('docs/plan-abc/F5_C09_CONTRATO_IMPRESION_SIN_DUPLICAR_2026-10-01.md', 'utf8');

for (const marker of [
  'abc_c09_impresiones_documentales',
  'abc_registrar_impresion_documental',
  'impresion_original_ya_registrada',
  'version_documental_no_encontrada',
  'DOCUMENTO_IMPRESO',
  'numero_copia',
  'REIMPRESION',
  'private.abc_operacion_iniciar',
]) assert.match(sql, new RegExp(marker.replace(/[.*+?^${}()|[\\]\\]/g, '\\\\$&'), 'i'), `falta ${marker}`);

for (const marker of [
  'sin duplicar',
  'reimpresión',
  'numero',
  'no se aplica ninguna migración',
]) assert.match(doc, new RegExp(marker.replace(/[.*+?^${}()|[\\]\\]/g, '\\\\$&'), 'i'), `documento: falta ${marker}`);

assert.match(sql, /constraint abc_c09_impresion_tipo check \(tipo_impresion in \('ORIGINAL','REIMPRESION'\)\)/i);
assert.match(sql, /constraint abc_c09_impresion_canal check \(canal in \('PAPEL','PDF','DIGITAL'\)\)/i);
assert.match(sql, /before update or delete on public\.abc_c09_impresiones_documentales/i);
assert.match(sql, /select coalesce\(max\(i\.numero_copia\),0\)\+1/i);
assert.match(sql, /insert into public\.abc_c09_impresiones_documentales/i);
console.log('ABC_F5_C09_PRINTING_CONTRACT=PASS_WITH_POSTGRES_PENDING');
