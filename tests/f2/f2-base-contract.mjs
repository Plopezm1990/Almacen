import fs from 'node:fs';
import assert from 'node:assert/strict';

const contract = fs.readFileSync('docs/plan-abc/F2_1_BASE_TRANSACCIONAL_CONTRATO_2026-10-01.md', 'utf8');
const inventory = fs.readFileSync('docs/plan-abc/F2_2_INVENTARIO_DEPENDENCIAS_RELEASE_2026-10-01.md', 'utf8');

for (const term of [
  'operation_id', 'resultado externo desconocido', 'efectos pendientes', 'RLS',
  'user_metadata', 'service_role', 'security_invoker', 'Data API',
  'Orden de una operación protegida', 'Puerta de aplicación', 'QA o PROD',
]) {
  assert.match(contract, new RegExp(term.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&'), 'i'), `F2 falta ${term}`);
}

assert.match(contract, /CANDIDATO_DOCUMENTAL_NO_APLICADO/);
assert.match(contract, /no se crea migration SQL/i);
assert.match(contract, /no se usa `db push`/i);
assert.match(contract, /no se conecta a\s+QA\/PROD/i);
assert.match(contract, /no se hace deploy de Netlify/i);

for (const migration of [
  '20260923210000_abc_f2_m01_base_transaccional_caja.sql',
  '20260923230000_abc_f2_m02b_pagos_reservas_reembolsos.sql',
  '20260924003000_abc_f2_m04c_outbox_persistente.sql',
  '20260924004000_abc_f2_m04d_acl_parity.sql',
]) {
  assert.match(inventory, new RegExp(migration), `F2.2 falta ${migration}`);
}
assert.match(inventory, /INVENTARIO_ESTATICO_PENDIENTE_VERIFICACION_SQL/);
assert.match(inventory, /La existencia de\s+un archivo no demuestra/i);
assert.match(inventory, /advisors, RLS, ACL, índices/i);
assert.match(inventory, /No se usará `apply_migration`/i);
assert.match(inventory, /sin\s+aplicar todavía cambios en QA\/PROD/i);

console.log('ABC_F2_BASE_CONTRACT=PASS');
