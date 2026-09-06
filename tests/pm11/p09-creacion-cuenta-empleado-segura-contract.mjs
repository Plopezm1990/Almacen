import fs from 'node:fs';
import assert from 'node:assert/strict';

const src = fs.readFileSync('fuente.js', 'utf8');
const migration = fs.readFileSync('supabase/migrations/20260906101500_pm11_creacion_cuenta_empleado_segura.sql', 'utf8');
const edge = fs.readFileSync('supabase/functions/crear-cuenta-empleado/index.ts', 'utf8');

for (const token of [
  'public.pm11_finalizar_creacion_cuenta_empleado',
  "p_rol not in ('Encargado', 'Básico', 'Camarero/a', 'Cajero/a', 'Churrero/a')",
  "m.rol = 'Propietario'",
  'private.pm11_local_activo(p_empresa_id, p_local_id)',
  "v_empleado.estado <> 'activo'",
  'insert into public.membresias_usuario',
  'insert into public.perfiles',
  "'Personal · crear cuenta empleado'",
  'to service_role'
]) assert.ok(migration.includes(token), `falta contrato DB P09: ${token}`);

assert.match(migration, /revoke all on function public\.pm11_finalizar_creacion_cuenta_empleado[\s\S]*from public, anon, authenticated/);
assert.ok(migration.indexOf('insert into public.membresias_usuario') < migration.indexOf('insert into public.perfiles'), 'membresía se crea antes que perfil vinculado');

for (const token of [
  'caller.auth.getUser()',
  'SUPABASE_SERVICE_ROLE_KEY',
  '.from("empleados")',
  'm.rol === "Propietario"',
  'admin.auth.admin.createUser',
  'pm11_finalizar_creacion_cuenta_empleado',
  'admin.auth.admin.deleteUser(nuevoUserId)',
  'ban_duration: "876000h"',
  'perfilExistente?.user_id',
  'yaCreada: true'
]) assert.ok(edge.includes(token), `falta contrato Edge P09: ${token}`);

assert.doesNotMatch(edge, /rol\s*===\s*"Propietario"\s*\?\s*true/);
assert.doesNotMatch(edge, /body\?\.empresaId|body\?\.localId/);

const bloquePersonalIni = src.indexOf('async function crearCuentaEmpleado(');
const bloquePersonalFin = src.indexOf('\n  function updateEmpleado(', bloquePersonalIni);
assert.ok(bloquePersonalIni >= 0 && bloquePersonalFin > bloquePersonalIni, 'crearCuentaEmpleado existe');
const bloque = src.slice(bloquePersonalIni, bloquePersonalFin);
assert.ok(bloque.includes('supabase.functions.invoke("crear-cuenta-empleado"'), 'frontend usa proyecto Supabase activo');
assert.doesNotMatch(bloque, /flqercbgpgmmfaakrwkc\.supabase\.co\/functions\/v1\/crear-cuenta-empleado/, 'frontend no hardcodea producción');
assert.ok(bloque.includes('body: { empleadoId, nombre, email, password, rol }'), 'payload cuenta conservado');

console.log('PM11 P09 creación segura de cuenta empleado: contrato OK');
