import assert from 'node:assert/strict';
import fs from 'node:fs';

const fuente = fs.readFileSync(new URL('../../fuente.js', import.meta.url), 'utf8');
const recuperada = fs.readFileSync(new URL('../../source-recovery/fuente-recuperado.js', import.meta.url), 'utf8');

const inicio = fuente.indexOf('const empleadosIdentidadKeyPM11 =');
const fin = fuente.indexOf('const localesEmpresaActiva =', inicio);
assert.ok(inicio > 0 && fin > inicio, 'no se encontró el efecto de enriquecimiento de cuentas');
const bloque = fuente.slice(inicio, fin);

assert.match(bloque, /const controlador = typeof AbortController === "function"/);
assert.match(bloque, /consulta\.abortSignal\(controlador\.signal\)/);
assert.match(bloque, /\.in\("empleado_id", idsEmpleadosContexto\)/);
assert.match(bloque, /if \(error \|\| !activo \|\| controlador\?\.signal\.aborted/);
assert.match(bloque, /const enContexto = empleadoLocal === localContexto/);
assert.match(bloque, /if \(!enContexto\) return empleado;/);
assert.match(bloque, /if \(controlador\) controlador\.abort\(\);/);
assert.match(bloque, /\[ready, miPerfil, localActivoId, empresas, locales, empleadosIdentidadKeyPM11\]/);

const inicioRec = recuperada.indexOf('const empleadosIdentidadKeyPM11 =');
const finRec = recuperada.indexOf('const localesEmpresaActiva =', inicioRec);
assert.ok(inicioRec > 0 && finRec > inicioRec, 'la fuente recuperada no conserva el bloque');
assert.equal(recuperada.slice(inicioRec, finRec), bloque, 'la fuente recuperada debe mantener paridad exacta');

console.log('P12_ACCOUNT_ENRICHMENT_RACE=PASS');
