import assert from 'node:assert/strict';
import fs from 'node:fs';

const sql = fs.readFileSync('supabase/migrations/20261001170000_abc_f5_c07_fiscal_gate.sql', 'utf8');
const doc = fs.readFileSync('docs/plan-abc/F5_C07_CONTRATO_PUERTA_FISCAL_2026-10-01.md', 'utf8');

for (const marker of [
  'abc_c07_modalidades_fiscales',
  'abc_c07_evaluaciones_fiscales',
  'abc_configurar_modalidad_fiscal',
  'abc_evaluar_documento_fiscal',
  'c07_activacion_requiere_validacion_asesoria',
  'proveedor_fiscal_requerido',
  'PREPARADO_SIMULADOR',
  'ACTIVACION_FISCAL_NO_IMPLEMENTADA',
  'abc_c07_guard_config',
  'abc_c07_guard_evaluacion',
  'private.abc_operacion_iniciar',
]) assert.match(sql, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), `falta ${marker}`);

for (const marker of [
  'modo `SIMULADOR`',
  'ACTIVO',
  'no genera emisión fiscal',
  'no conecta un proveedor',
  'No se aplican migraciones remotas',
]) assert.match(doc, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), `documento: falta ${marker}`);

assert.match(sql, /estado in \('PENDIENTE_ASESORIA','SIMULADOR','ACTIVO','BLOQUEADO'\)/i);
assert.match(sql, /modalidad in \('NO_FISCAL','SIF_SIMULADOR','SIF_PRODUCCION','B2B_SIMULADOR','B2B_PRODUCCION'\)/i);
assert.match(sql, /revoke all on table public\.abc_c07_modalidades_fiscales,public\.abc_c07_evaluaciones_fiscales from public,anon,authenticated,service_role/i);
console.log('ABC_F5_C07_FISCAL_GATE_CONTRACT=PASS_WITH_POSTGRES_PENDING');
