import assert from 'node:assert/strict';
import fs from 'node:fs';

const fuente = fs.readFileSync(new URL('../../fuente.js', import.meta.url), 'utf8');
const recuperada = fs.readFileSync(new URL('../../source-recovery/fuente-recuperado.js', import.meta.url), 'utf8');
const reset = fs.readFileSync(new URL('../../reset-pruebas-preview.js', import.meta.url), 'utf8');
const edge = fs.readFileSync(new URL('../../supabase/functions/crear-cuenta-empleado/index.ts', import.meta.url), 'utf8');
const finalize = fs.readFileSync(new URL('../../supabase/migrations/20260922180000_p2_sec_pm11_finalize_account_dependency.sql', import.meta.url), 'utf8');

const resolver = 'const endpointCuentaEmpleado =';
assert.equal((fuente.match(new RegExp(resolver, 'g')) || []).length, 1);
assert.equal((recuperada.match(new RegExp(resolver, 'g')) || []).length, 1);
assert.match(
  fuente,
  /window\.__modoPruebasQA === true[\s\S]*window\.__qaNubeUrl[\s\S]*qa-crear-empleado/,
  'el preview debe usar explícitamente el stub QA seguro'
);
assert.match(
  fuente,
  /: "https:\/\/flqercbgpgmmfaakrwkc\.supabase\.co\/functions\/v1\/crear-cuenta-empleado"/,
  'producción debe conservar su endpoint real'
);
assert.doesNotMatch(
  fuente,
  /fetch\("https:\/\/flqercbgpgmmfaakrwkc\.supabase\.co\/functions\/v1\/crear-cuenta-empleado"/,
  'el frontend no debe hacer una llamada productiva directa para crear cuentas'
);
assert.match(
  reset,
  /"crear-cuenta-empleado":\s*"qa-crear-empleado"/,
  'la barrera de preview debe conservar el stub seguro'
);

// Alta idempotente y compensación: una repetición no debe crear otra identidad,
// y una finalización fallida no debe dejar un acceso Auth utilizable a medias.
assert.match(fuente, /disabled: creando/);
assert.match(edge, /pm11_preparar_cuenta_empleado/);
assert.match(edge, /mismoEmail[\s\S]*perfilExistente\.activo === true[\s\S]*perfilExistente\.rol === rol/);
assert.match(edge, /yaCreada:\s*true/);
assert.match(edge, /createUser\(/);
assert.match(edge, /pm11_finalizar_creacion_cuenta_empleado/);
assert.match(edge, /admin\.auth\.admin\.deleteUser\(nuevoUserId\)/);
assert.match(edge, /ban_duration:\s*"876000h"/);
assert.match(edge, /already/);
for (const patron of [
  /select \* into v_empleado[\s\S]*for update/,
  /cuenta_objetivo_ya_configurada/,
  /cuenta_objetivo_tiene_membresias_previas/,
  /empleado_cuenta_ya_vinculada/,
  /'yaCreada', true/
]) assert.match(finalize, patron, `falta garantía de alta idempotente: ${patron}`);

console.log('P11_CREATE_ACCOUNT_ROUTING=PASS');
