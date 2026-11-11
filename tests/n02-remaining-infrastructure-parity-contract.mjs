// N-02 — contrato de paridad para guards y triggers de infraestructura.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = fileURLToPath(new URL('../', import.meta.url));
const migration = readFileSync(
  join(repo, 'supabase/migrations/20261110220000_n02_remaining_infrastructure_parity.sql'),
  'utf8'
).replace(/\r\n/g, '\n');
const executableSql = migration.replace(/^\s*--.*$/gm, '');

for (const name of [
  'private.es_propietario_activo',
  'private.pm13_cargo_guard_nombre',
  'private.pm13_cargo_guard_propietario',
  'public.completar_local_movimiento',
  'public.estampar_propiedad_suscripcion_push'
]) {
  assert.match(migration, new RegExp(`create or replace function ${name.replaceAll('.', '\\.')}`, 'i'));
}

for (const trigger of [
  'pm13_cargo_guard_nombre',
  'pm13_cargo_guard_propietario',
  'movimientos_completar_local',
  'suscripciones_push_estampar_propiedad'
]) {
  assert.match(migration, new RegExp(`create trigger ${trigger}`, 'i'));
}

assert.match(migration, /grant execute on function private\.es_propietario_activo\(\) to authenticated/i);
assert.match(migration, /private\.plataforma_empresa_del_llamante\(\)/i);
assert.match(migration, /auth\.uid\(\)/i);
assert.match(migration, /if not exists \([\s\S]*?pg_trigger[\s\S]*?pm13_cargo_guard_nombre/i);
assert.doesNotMatch(executableSql, /insert\s+into|update\s+[^\s]+\s+set|delete\s+from/i);

// Legacy sensitive functions are intentionally not copied by this migration.
assert.doesNotMatch(executableSql, /anular_venta_tpv|descontar_stock|registrar_auditoria/i);

console.log('N02_REMAINING_INFRASTRUCTURE_PARITY_CONTRACT=PASS');
