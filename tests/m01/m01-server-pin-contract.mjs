import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = fileURLToPath(new URL('../../', import.meta.url));
const fuente = readFileSync(join(REPO, 'source-recovery', 'fuente-recuperado.js'), 'utf8');
const bundle = readFileSync(join(REPO, 'fuente.js'), 'utf8');
const edge = readFileSync(join(REPO, 'edge-auth-patch.js'), 'utf8');
const migracion = readFileSync(join(REPO, 'supabase/migrations/20261108120000_m01_server_pin_authentication.sql'), 'utf8');

const seguridadInicio = fuente.indexOf('function crearLogicaSeguridad');
const seguridadFin = fuente.indexOf('\nfunction ', seguridadInicio + 1);
assert.ok(seguridadInicio >= 0, 'falta crearLogicaSeguridad');
const seguridad = fuente.slice(seguridadInicio, seguridadFin > seguridadInicio ? seguridadFin : undefined);

assert.match(seguridad, /pm11_iniciar_sesion_empleado/);
assert.match(seguridad, /pinConfigurado\s*!==\s*true/);
assert.doesNotMatch(seguridad, /hashPin\(/);
assert.doesNotMatch(seguridad, /emp\.pin\b/);
assert.match(fuente, /pm11_iniciar_sesion_empleado/);
assert.match(fuente, /pinConfigurado\s*!==\s*true/);
assert.match(bundle, /pm11_iniciar_sesion_empleado/);
assert.doesNotMatch(bundle, /hashPin\(pinIntento\)/);

assert.match(edge, /sanitizarEmpleadosLegacy/);
assert.match(edge, /empleadosPropietarioSinSecretos/);
assert.match(edge, /pm11_listar_empleados_modo/);
assert.match(edge, /delete\s+\w+\.pin/);

assert.match(migracion, /create table if not exists private\.pm11_empleado_pin/);
assert.match(migracion, /extensions\.crypt\(v_pin, extensions\.gen_salt\('bf', 12\)\)/);
assert.match(migracion, /public\.pm11_verificar_pin_empleado/);
assert.match(migracion, /public\.pm11_listar_empleados_modo/);
assert.match(migracion, /datos = datos - 'pin'/);
assert.match(migracion, /revoke all on table private\.pm11_empleado_pin/);
assert.match(migracion, /pin_hash text not null/);

console.log('M01_SERVER_PIN_CONTRACT=PASS');
