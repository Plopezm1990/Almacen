import fs from 'node:fs';
import assert from 'node:assert/strict';

const doc = fs.readFileSync('docs/plan-abc/F3_5_CONTRATO_COCINA_COMANDAS_2026-10-01.md', 'utf8');
const migration = fs.readFileSync('supabase/migrations/20260926110000_abc_f3_a10_kitchen_commands.sql', 'utf8');
const auditMigration = fs.readFileSync('supabase/migrations/20260926140000_abc_f3_a10b_kitchen_audit.sql', 'utf8');

for (const term of [
  'Identidad y rutas',
  'Estados y autoridad',
  'Cambios, cancelación y reimpresión',
  'PENDIENTE',
  'RECIBIDA',
  'BLOQUEADA',
  'snapshot',
  'MERMA_CONFIRMADA',
  'NO_MERMA',
  'Criterios de aceptación F3.5',
]) {
  assert.match(doc, new RegExp(term, 'i'), `F3.5 falta ${term}`);
}
assert.match(doc, /CONTRATO_COCINA_PREPARADO_NO_APLICADO/);
assert.match(doc, /no mueve stock, no cobra, no emite fiscalidad/i);
assert.match(doc, /no añade migración remota/i);

for (const source of [migration, auditMigration]) {
  for (const term of [
    'comandas_preparacion',
    'comanda_lineas',
    'route_key',
    'KITCHEN_COMANDA',
    'abc_enviar_cambio_comanda',
    'abc_reimprimir_comanda',
    'abc_resolver_merma_comanda_linea',
  ]) {
    assert.match(source, new RegExp(term, 'i'), `A10 falta ${term}`);
  }
}
assert.match(migration, /on conflict \(empresa_id,operation_id,route_key,tipo\) do nothing/i);
assert.match(migration, /estado='BLOQUEADA'/i);
assert.match(auditMigration, /MERMA_CONFIRMADA/);
assert.match(auditMigration, /NO_MERMA/);

console.log('ABC_F3_TPV_KITCHEN_CONTRACT=PASS');
