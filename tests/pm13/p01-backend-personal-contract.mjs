import fs from 'node:fs';
import assert from 'node:assert/strict';

const basePath = 'supabase/migrations/20260907194803_pm13_p01_ciclo_personal_idempotente.sql';
const lockPath = 'supabase/migrations/20260907195207_pm13_p01_alta_concurrency_lock.sql';
const base = fs.readFileSync(basePath, 'utf8');
const lock = fs.readFileSync(lockPath, 'utf8');

for (const fn of ['pm11_alta_empleado', 'pm11_editar_empleado', 'pm11_baja_empleado', 'pm11_reactivar_empleado']) {
  assert.match(base, new RegExp(`CREATE OR REPLACE FUNCTION public\\.${fn}\\(`), `${fn} versionada`);
}

assert.equal((base.match(/SET search_path = ''/g) || []).length, 4, 'las cuatro RPC fijan search_path vacío');
assert.match(base, /IF v_empleado\.estado = 'inactivo'[\s\S]*'yaBaja', true/, 'baja replay idempotente');
assert.match(base, /IF v_empleado\.estado = 'activo'[\s\S]*'yaActivo', true/, 'reactivación replay idempotente');
assert.match(base, /v_datos IS NOT DISTINCT FROM v_empleado\.datos[\s\S]*'yaSinCambios', true/, 'edición replay idempotente');
assert.match(base, /pm13AltaOperationId/, 'alta conserva operation id');

for (const fn of ['pm11_alta_empleado', 'pm11_editar_empleado', 'pm11_baja_empleado', 'pm11_reactivar_empleado']) {
  assert.match(base, new RegExp(`REVOKE ALL ON FUNCTION public\\.${fn}`), `${fn} revoca PUBLIC/anon`);
  assert.match(base, new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${fn}`), `${fn} concede authenticated`);
}

assert.doesNotMatch(base, /\bDELETE\s+FROM\s+public\.empleados\b/i);
assert.doesNotMatch(base, /\bDELETE\s+FROM\s+public\.nominas\b/i);
assert.doesNotMatch(base, /DROP\s+TABLE|TRUNCATE\s+/i);

const lockCall = lock.indexOf('pg_catalog.pg_advisory_xact_lock');
const selectForUpdate = lock.indexOf('SELECT * INTO v_empleado');
const insert = lock.indexOf('INSERT INTO public.empleados');
assert.ok(lockCall >= 0 && selectForUpdate > lockCall && insert > selectForUpdate, 'alta toma advisory lock antes de comprobar/insertar');
assert.match(lock, /hashtextextended\('pm13:empleado:alta:' \|\| p_empresa_id \|\| ':' \|\| p_local_id \|\| ':' \|\| p_empleado_id, 0\)/);
assert.match(lock, /SET search_path = ''/);
assert.match(lock, /REVOKE ALL ON FUNCTION public\.pm11_alta_empleado[\s\S]*FROM PUBLIC, anon/);
assert.doesNotMatch(lock, /DROP\s+TABLE|TRUNCATE\s+|DELETE\s+FROM/i);

const joined = `${base}\n${lock}`;
assert.doesNotMatch(joined, /service_role|sb_secret_|SUPABASE_SERVICE_ROLE_KEY/i, 'sin secretos');

console.log('PM13 P01 backend personal: contrato OK');
