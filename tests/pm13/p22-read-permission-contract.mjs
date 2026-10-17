import fs from 'node:fs';
import assert from 'node:assert/strict';

const fuente = fs.readFileSync('fuente.js', 'utf8');
const recuperado = fs.readFileSync('source-recovery/fuente-recuperado.js', 'utf8');
const edge = fs.readFileSync('edge-auth-patch.js', 'utf8');

for (const [nombre, texto] of [['fuente.js', fuente], ['source-recovery/fuente-recuperado.js', recuperado]]) {
  for (const clave of ['PM13_PERSONAL_CONSULTAR', 'PM13_FICHAJE_CONSULTAR', 'PM13_AUSENCIA_CONSULTAR']) {
    assert.ok(texto.includes(clave), `${nombre}: incluye ${clave}`);
  }
  assert.match(texto, /puedeConsultarPantallaPM13\s*\(/, `${nombre}: gate de navegación PM13`);
  assert.match(texto, /setPermisosConsultaPM13\s*\(/, `${nombre}: carga los permisos de consulta PM13`);
  assert.match(texto, /empleadosVisiblesDelLocalActivo[\s\S]{0,350}ausencias:\s*\[\]/, `${nombre}: oculta ausencias si falta el permiso de consulta`);
}

for (const [nombre, texto] of [['fuente.js', fuente], ['edge-auth-patch.js', edge]]) {
  assert.match(texto, /pm13_resolver_cargo_permiso/, `${nombre}: usa el resolver servidor de permisos`);
  assert.match(texto, /p_accion:\s*["']CONSULTAR["']/, `${nombre}: resuelve acción de consulta`);
  assert.match(texto, /respuesta\.data\.ok\s*===\s*true[^\n]*respuesta\.data\.permitido\s*===\s*true/, `${nombre}: solo acepta una respuesta permitida y válida`);
  assert.match(texto, /return false/, `${nombre}: tiene fallback fail-closed`);
}

assert.match(fuente, /PM13_PERSONAL_CONSULTAR[\s\S]{0,500}respuestaStorage\(key, \[\]\)/, 'fuente.js: Personal no autorizado devuelve colección vacía');
assert.match(fuente, /PM13_FICHAJE_CONSULTAR[\s\S]{0,500}respuestaStorage\(key, \[\]\)/, 'fuente.js: Fichajes no autorizados devuelve colección vacía');
assert.match(edge, /PM13_PERSONAL_CONSULTAR[\s\S]{0,500}respuestaStorage\(key, \[\]\)/, 'edge-auth-patch.js: Personal no autorizado devuelve colección vacía');
assert.match(edge, /PM13_FICHAJE_CONSULTAR[\s\S]{0,500}respuestaStorage\(key, \[\]\)/, 'edge-auth-patch.js: Fichajes no autorizados devuelve colección vacía');
assert.match(edge, /obtener_contexto_operativo[\s\S]{0,250}p_local_id:\s*localIdSolicitado/, 'edge-auth-patch.js: contexto acotado al local solicitado');

console.log('PM13_P22_READ_PERMISSION_CONTRACT=PASS');
