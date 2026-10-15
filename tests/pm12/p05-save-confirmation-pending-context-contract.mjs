import assert from 'node:assert/strict';
import fs from 'node:fs';

const root = new URL('../../', import.meta.url);
const storage = fs.readFileSync(new URL('index-storage-bootstrap.js', root), 'utf8').replace(/\r\n/g, '\n');
const fuente = fs.readFileSync(new URL('fuente.js', root), 'utf8').replace(/\r\n/g, '\n');
const recuperada = fs.readFileSync(new URL('source-recovery/fuente-recuperado.js', root), 'utf8').replace(/\r\n/g, '\n');

assert.match(storage, /function pendientesContexto\(\)/);
assert.match(storage, /function contextoPendienteActual\(\)/);
assert.match(storage, /function pendienteEsDelContexto\(key\)/);
assert.match(storage, /almacen__pendientes_contexto/);
assert.match(storage, /if \(!pendienteEsDelContexto\(key\)\) continue;/);
assert.match(storage, /entradas\.push\(\{ key: key, empresaId: contexto\.empresaId, localId: contexto\.localId, cacheKey: cacheKey \|\| key, valor: valor \}\)/);
assert.match(storage, /entradaPendienteActual\(key\)/);
assert.match(storage, /confirmadoServidor: confirmadoServidor/);
assert.match(storage, /pendienteSincronizacion: pendienteSincronizacion \|\| pendientes\(\)\.indexOf\(key\) !== -1/);
assert.match(storage, /marcarPendiente\(key, value, cacheKey\);\s*pendienteSincronizacion = true;/s);

const saveInicio = fuente.indexOf('async function saveKey(key, value)');
const saveFin = fuente.indexOf('\nasync function sincronizarConteosPm12', saveInicio);
assert.ok(saveInicio > 0 && saveFin > saveInicio, 'no se encontró saveKey');
const save = fuente.slice(saveInicio, saveFin);
assert.match(save, /const resultado = await window\.storage\.set/);
assert.match(save, /resultado\?\.pendienteSincronizacion/);
assert.match(save, /resultado\?\.confirmadoServidor/);
assert.match(save, /fallo-guardado/);
assert.match(save, /guardado-confirmado/);
const saveRecInicio = recuperada.indexOf('async function saveKey(key, value)');
const saveRecFin = recuperada.indexOf('\nasync function sincronizarConteosPm12', saveRecInicio);
assert.equal(recuperada.slice(saveRecInicio, saveRecFin), save, 'saveKey debe mantener paridad exacta');

const listenerInicio = fuente.indexOf('function onFalloGuardado(e2)');
const listenerFin = fuente.indexOf('}, []);', listenerInicio) + '}, []);'.length;
assert.match(fuente.slice(listenerInicio, listenerFin), /function onGuardadoConfirmado\(e2\)/);
assert.match(fuente.slice(listenerInicio, listenerFin), /setFallosGuardado\(\(s22\) => s22\.filter/);
assert.match(fuente.slice(listenerInicio, listenerFin), /removeEventListener\("guardado-confirmado"/);

console.log('PM12 P05 confirmación de guardado y pendientes contextuales: contrato OK');
