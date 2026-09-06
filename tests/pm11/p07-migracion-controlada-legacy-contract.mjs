import fs from 'node:fs';
import assert from 'node:assert/strict';

const sql = fs.readFileSync('supabase/migrations/20260906093000_pm11_migracion_controlada_empleados_legacy.sql', 'utf8');
const evidencia = fs.readFileSync('tests/pm11/P07_MIGRACION_CONTROLADA_EMPLEADOS_LEGACY_EVIDENCIA.md', 'utf8');

for (const token of [
  'private.pm11_try_timestamptz',
  'private.pm11_local_pertenece_empresa',
  'private.pm11_puede_migrar_personal',
  'private.pm11_normalizar_empleado_legacy',
  'public.pm11_previsualizar_migracion_empleados_legacy',
  'public.pm11_migrar_empleados_legacy',
  "m.rol = 'Propietario'",
  "empleado_legacy_id_duplicado_en_lote",
  "empleado_legacy_id_colision_otro_contexto",
  "empleado_legacy_conflicto_con_sql",
  "migracion_legacy_bloqueada",
  "empleados_legacy_limite_500",
  "pm11_validar_datos_laborales",
  "pg_advisory_xact_lock",
  "Personal · migrar empleado legacy",
  "'kvEliminado', false",
  "grant execute on function public.pm11_previsualizar_migracion_empleados_legacy",
  "grant execute on function public.pm11_migrar_empleados_legacy"
]) assert.ok(sql.includes(token), `falta contrato SQL P07: ${token}`);

// La migración histórica puede conservar un local cerrado, pero exige pertenencia real.
const puedeMigrarIni = sql.indexOf('create or replace function private.pm11_puede_migrar_personal');
const puedeMigrarFin = sql.indexOf('create or replace function private.pm11_normalizar_empleado_legacy', puedeMigrarIni);
const puedeMigrar = sql.slice(puedeMigrarIni, puedeMigrarFin);
assert.match(puedeMigrar, /pm11_local_pertenece_empresa/);
assert.doesNotMatch(puedeMigrar, /pm11_local_activo/);
assert.match(puedeMigrar, /m\.rol = 'Propietario'/);

// No se borra ni reescribe la fuente KV durante P07.
assert.doesNotMatch(sql, /delete\s+from\s+public\.almacen_kv/i);
assert.doesNotMatch(sql, /update\s+public\.almacen_kv/i);
assert.doesNotMatch(sql, /truncate\s+(table\s+)?public\.almacen_kv/i);

// La anonimización legacy no puede reintroducir PII conocida.
for (const pii of ["'dni'", "'nie'", "'pin'", "'email'", "'telefono'", "'direccion'", "'documentos'", "'ausencias'"])
  assert.ok(sql.includes(`- ${pii}`), `falta limpieza ${pii}`);
assert.match(sql, /v_nombre := null/);

// No se confía en empresa/local contenidos en la ficha legacy.
assert.match(sql, /empleado_legacy_empresa_no_coincide/);
assert.match(sql, /empleado_legacy_local_no_coincide/);
assert.match(sql, /'empresaId', p_empresa_id/);
assert.match(sql, /'localId', p_local_id/);

// La previsualización bloquea el lote completo ante cualquier problema.
const migrarIni = sql.indexOf('create or replace function public.pm11_migrar_empleados_legacy');
const migrar = sql.slice(migrarIni);
assert.match(migrar, /pm11_previsualizar_migracion_empleados_legacy/);
assert.match(migrar, /if coalesce\(\(v_preview->>'problemas'\)::integer, 0\) > 0 then/);
assert.match(migrar, /'ok', false/);
assert.match(migrar, /'codigo', 'migracion_legacy_bloqueada'/);

// Privilegios: API a authenticated, nunca a anon.
assert.match(sql, /revoke all on function public\.pm11_previsualizar_migracion_empleados_legacy\(text, text, jsonb\) from public, anon;/);
assert.match(sql, /revoke all on function public\.pm11_migrar_empleados_legacy\(text, text, jsonb\) from public, anon;/);

for (const token of [
  'PM11_P07_MIGRACION_CONTROLADA_EMPLEADOS_LEGACY=PASS',
  'SIGUIENTE=PM11_P08_VINCULO_CUENTA_EMPLEADO_INTEGRIDAD',
  'insertados=3',
  'omitidosYaMigrados=1',
  'migracion_legacy_bloqueada',
  'empleados `P07-QA-*` restantes: 0',
  'clave KV sintética P07 restante: 0',
  'producción: 0 cambios'
]) assert.ok(evidencia.includes(token), `falta evidencia P07: ${token}`);

assert.ok(fs.existsSync('tests/pm11/p06-puente-frontend-sql-contract.mjs'), 'regresión P06 disponible');
assert.ok(fs.existsSync('tests/pm11/p05-rpc-ciclo-vida-contract.mjs'), 'regresión P05 disponible');

console.log('PM11 P07 migración controlada empleados legacy: contrato OK');
