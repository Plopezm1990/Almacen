import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const edgeFunctions = [
  'supabase/functions/crear-cuenta-empleado/index.ts',
  'supabase/functions/qa-crear-empleado/index.ts',
];
const bundles = ['source-recovery/fuente-recuperado.js', 'fuente.js'];
const recoveryPage = read('restablecer-contrasena.js');

for (const path of edgeFunctions) {
  const source = read(path);
  assert.match(source, /password\.length < 8\s*\|\|\s*password\.length > 200/, `${path}: el validador debe exigir 8 caracteres`);
  assert.doesNotMatch(source, /password\.length < 6/, `${path}: no debe conservar el mínimo de 6 caracteres`);
}

for (const path of bundles) {
  const source = read(path);
  assert.match(source, /m\\xEDnimo 8 caracteres/, `${path}: la pantalla de alta debe comunicar el mínimo de 8 caracteres`);
  assert.doesNotMatch(source, /m\\xEDnimo 6 caracteres/, `${path}: la pantalla de alta no debe comunicar el mínimo antiguo`);
  const inicioLogin = source.indexOf('function AppConSesion()');
  assert.ok(inicioLogin >= 0, `${path}: no se encontró AppConSesion`);
  const finLogin = source.indexOf('var rutaHash =', inicioLogin);
  assert.ok(finLogin > inicioLogin, `${path}: no se pudo acotar AppConSesion`);
  const login = source.slice(inicioLogin, finLogin);
  assert.match(login, /MAX_INTENTOS_LOGIN_M04 = 5/, `${path}: falta el umbral de intentos`);
  assert.match(login, /BLOQUEO_LOGIN_MS_M04 = 60 \* 1000/, `${path}: falta la duración del bloqueo`);
  assert.match(login, /bloqueoHasta > Date\.now\(\)/, `${path}: el login no consulta el bloqueo vigente`);
  assert.match(login, /Demasiados intentos fallidos/, `${path}: falta el mensaje visible de bloqueo`);
}

assert.match(recoveryPage, /if\(p1\.length<8\)/,
  'restablecer-contrasena.js: la recuperación debe exigir 8 caracteres');
assert.doesNotMatch(recoveryPage, /p1\.length<6/,
  'restablecer-contrasena.js: no debe conservar el mínimo antiguo de 6 caracteres');
assert.match(recoveryPage, /body:JSON\.stringify\(\{password:p1\}\)/,
  'restablecer-contrasena.js: el camino de recuperación debe enviar la contraseña validada');

console.log('M04_PASSWORD_POLICY_CONTRACT=PASS');
