import fs from 'node:fs';
import assert from 'node:assert/strict';

const migrationPath = 'supabase/migrations/20261017200000_pm13_p05_integrate_action_guards.sql';
const source = fs.readFileSync(migrationPath, 'utf8');

for (const token of [
  'private.pm13_p05_accion_autorizada',
  'public.pm13_resolver_cargo_permiso',
  'PM13_PERSONAL_CREAR',
  'PM13_PERSONAL_EDITAR',
  'PM13_PERSONAL_ANULAR',
  'PM13_FICHAJE_MANUAL',
  'PM13_FICHAJE_CORREGIR',
  'PM13_FICHAJE_ANULAR',
  'PM13_AUSENCIA_REGISTRAR',
  'PM13_AUSENCIA_ANULAR',
  'pm13_fichaje_actor_es_empleado',
  'PM13_P05_GUARD_REWRITE_SIN_COINCIDENCIA',
]) {
  assert.match(source, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `falta ${token}`);
}

assert.match(source, /si no hay cargo activo/i);
assert.match(source, /rollback|commit/i);
assert.doesNotMatch(source, /db\s+push|migration\s+repair/i);
assert.doesNotMatch(source, /delete\s+from|truncate\s+table|drop\s+(table|schema)/i);

console.log('PM13 P19 cargo action guard integration contract: PASS');
