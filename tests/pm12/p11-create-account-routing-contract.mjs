import assert from 'node:assert/strict';
import fs from 'node:fs';

const fuente = fs.readFileSync(new URL('../../fuente.js', import.meta.url), 'utf8');
const recuperada = fs.readFileSync(new URL('../../source-recovery/fuente-recuperado.js', import.meta.url), 'utf8');
const reset = fs.readFileSync(new URL('../../reset-pruebas-preview.js', import.meta.url), 'utf8');

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

console.log('P11_CREATE_ACCOUNT_ROUTING=PASS');
