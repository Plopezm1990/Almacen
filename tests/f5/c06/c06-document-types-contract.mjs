import assert from 'node:assert/strict';
import fs from 'node:fs';

const sql = fs.readFileSync('supabase/migrations/20261001160000_abc_f5_c06_document_types.sql', 'utf8');
const doc = fs.readFileSync('docs/plan-abc/F5_C06_CONTRATO_TIPOS_DOCUMENTALES_2026-10-01.md', 'utf8');

for (const marker of [
  'abc_c06_documentos_clasificados',
  'abc_clasificar_documento',
  'abc_c06_clasificacion_documento_uq',
  'abc_c06_documento_id_uq',
  'abc_c06_clasificacion_operation_uq',
  'abc_c06_guard_clasificacion',
  'FACTURA_SIMPLIFICADA',
  'FACTURA_COMPLETA',
  'FACTURA_RECTIFICATIVA',
  'documento_tipo_ya_definido',
  'factura_completa_datos_receptor_requeridos',
  'documento_referencia_no_emitido',
  'private.abc_operacion_iniciar',
  'for update',
]) assert.match(sql, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), `falta ${marker}`);

for (const marker of [
  '`PEDIDO`',
  '`PRECUENTA`',
  '`JUSTIFICANTE_PAGO`',
  'no se aplican migraciones remotas',
  'C07',
]) assert.match(doc, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), `documento: falta ${marker}`);

assert.match(sql, /tipo_documental in \('PEDIDO','PRECUENTA','JUSTIFICANTE_PAGO','FACTURA_SIMPLIFICADA','FACTURA_COMPLETA','FACTURA_RECTIFICATIVA'\)/i);
assert.match(sql, /tipo_documental_no_coincide_con_serie/i);
assert.doesNotMatch(sql, /grant execute on function public\.abc_clasificar_documento[^;]+to service_role/i);
console.log('ABC_F5_C06_DOCUMENT_TYPES_CONTRACT=PASS_WITH_POSTGRES_PENDING');
