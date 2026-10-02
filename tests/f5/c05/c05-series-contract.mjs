import assert from 'node:assert/strict';
import fs from 'node:fs';

const sql = fs.readFileSync('supabase/migrations/20261001150000_abc_f5_c05_document_series.sql', 'utf8');
const doc = fs.readFileSync('docs/plan-abc/F5_C05_CONTRATO_SERIES_NUMERACION_2026-10-01.md', 'utf8');

for (const marker of [
  'abc_c05_series_documentales',
  'abc_c05_documentos_emitidos',
  'abc_reservar_numero_documental',
  'abc_resolver_emision_documental',
  'abc_c05_documento_numero_uq',
  'abc_c05_documento_operation_uq',
  'abc_c05_guard_documento',
  'documento_identidad_inmutable',
  'documento_emitido_inmutable',
  'for update',
  'private.abc_operacion_iniciar',
  'private.abc_operacion_completar',
]) assert.match(sql, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), `falta ${marker}`);

for (const marker of [
  'dos solicitudes concurrentes no pueden recibir el mismo numero',
  'Repetir una reserva con el mismo `operation_id`',
  'No se aplican migraciones remotas',
]) assert.match(doc, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), `documento: falta ${marker}`);

assert.match(sql, /unique \(empresa_id,local_id,tipo_documento,codigo_serie,numero\)/i);
assert.match(sql, /estado in \('RESERVADO','EMITIDO','PENDIENTE','ERROR','ANULADO'\)/i);
assert.doesNotMatch(sql, /next_attempt_at/i);
console.log('ABC_F5_C05_SERIES_CONTRACT=PASS_WITH_POSTGRES_PENDING');
