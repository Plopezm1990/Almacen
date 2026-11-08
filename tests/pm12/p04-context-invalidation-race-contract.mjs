import assert from 'node:assert/strict';
import fs from 'node:fs';

const fuente = fs.readFileSync(new URL('../../fuente.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const recuperada = fs.readFileSync(new URL('../../source-recovery/fuente-recuperado.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');

assert.match(fuente, /function claveContextoPm07\(\{ empresaId = null, localId = null, periodo = null \} = \{\}\)/);
assert.match(fuente, /empresa:\$\{empresaId \|\| "todas"\}\|local:\$\{localId \|\| "todos"\}\|periodo:\$\{periodo \|\| "todos"\}/);

for (const nombre of ['sincronizarContextoPm07', 'sincronizarStockPm07', 'sincronizarConteosPm12', 'sincronizarCajaPm08']) {
  const inicio = fuente.indexOf(`async function ${nombre}`);
  assert.ok(inicio > 0, `no se encontró ${nombre}`);
  const fin = fuente.indexOf('\n}', inicio);
  assert.ok(fin > inicio, `no se pudo delimitar ${nombre}`);
  const bloque = fuente.slice(inicio, Math.min(fuente.length, inicio + 7000));
  assert.match(bloque, /esContextoVigente/);
  assert.match(bloque, /obsoleto: true/);
}

const stock = fuente.slice(fuente.indexOf('async function sincronizarStockPm07'), fuente.indexOf('function redondearDineroPM08'));
assert.match(stock, /qStock = qStock\.eq\("empresa_id", empresaId\)/);
assert.match(stock, /qMov = qMov\.eq\("empresa_id", empresaId\)/);
assert.match(stock, /qStock = qStock\.eq\("local_id", localActivoId\)/);
assert.match(stock, /qMov = qMov\.eq\("local_id", localActivoId\)/);

const caja = fuente.slice(fuente.indexOf('async function sincronizarCajaPm08'), fuente.indexOf('async function sincronizarContextoPm07'));
assert.match(caja, /const acotarContexto = \(consulta\) =>/);
assert.match(caja, /acotada\.eq\("empresa_id", empresaId\)/);
assert.match(caja, /acotada\.eq\("local_id", localActivoId\)/);

const inicioEfecto = fuente.indexOf('const contextoPm07SolicitudRef =');
const finEfecto = fuente.indexOf('const empresaDelLocalActivo =', inicioEfecto);
assert.ok(inicioEfecto > 0 && finEfecto > inicioEfecto, 'no se encontró el efecto de sincronización de contexto');
const efecto = fuente.slice(inicioEfecto, finEfecto);
assert.match(efecto, /contextoPm07ClaveRef/);
assert.match(efecto, /const solicitud = contextoPm07SolicitudRef\.current \+ 1/);
assert.match(efecto, /const esContextoVigente = \(\) => activo && contextoPm07SolicitudRef\.current === solicitud/);
assert.match(efecto, /claveContextoPm07\(\{ empresaId: empresaContexto, localId: localContexto \}\)/);
assert.match(efecto, /if \(!esContextoVigente\(\)\) return;/);
assert.match(efecto, /empresaId: empresaContexto, localActivoId, esContextoVigente/);
assert.match(efecto, /empresas\.map\(\(e2\) =>/);
assert.match(efecto, /locales\.map\(\(l22\) =>/);

// 2.7: dos dispositivos pueden compartir jornada, pero dos identidades no
// pueden compartir la resolución en vuelo ni el respaldo de otro usuario.
assert.match(fuente, /contextoUsuarioEnVuelo === usuarioIdSolicitado/);
assert.match(fuente, /contextoUsuarioId === userId && contextoLocalIdUsado === localIdSolicitado \? contextoCache : null/);
assert.match(fuente, /function invalidarPorCambioDeSesion\(nuevoUsuarioId\)/);
assert.match(fuente, /limpiarContextoLocalGuardado\(\);/);
assert.match(fuente, /guardado\.userId !== userId/);
assert.match(fuente, /guardado\.localIdSolicitado \|\| null\) !== \(localIdSolicitado \|\| null\)/);

const contextoSeguro = (cache, cacheUser, cacheLocal, user, local) =>
  cacheUser === user && cacheLocal === local ? cache : null;
assert.deepEqual(contextoSeguro({ rol: 'Propietario', local: 'A1' }, 'user-a', 'A1', 'user-a', 'A1'), { rol: 'Propietario', local: 'A1' });
assert.equal(contextoSeguro({ rol: 'Propietario', local: 'A1' }, 'user-a', 'A1', 'user-b', 'A1'), null,
  'un segundo usuario no debe recibir el contexto del primero');
assert.equal(contextoSeguro({ rol: 'Propietario', local: 'A1' }, 'user-a', 'A1', 'user-a', 'A2'), null,
  'un segundo local no debe recibir el contexto del primero');

const inicioRec = recuperada.indexOf('const contextoPm07SolicitudRef =');
const finRec = recuperada.indexOf('const empresaDelLocalActivo =', inicioRec);
assert.ok(inicioRec > 0 && finRec > inicioRec, 'la fuente recuperada no conserva el efecto');
assert.equal(recuperada.slice(inicioRec, finRec), efecto, 'la fuente recuperada debe mantener paridad exacta del efecto');

const fnInicio = fuente.indexOf('function claveContextoPm07');
const fnFin = fuente.indexOf('function SelectorLocalInformes', fnInicio);
const fnRecInicio = recuperada.indexOf('function claveContextoPm07');
const fnRecFin = recuperada.indexOf('function SelectorLocalInformes', fnRecInicio);
assert.equal(recuperada.slice(fnRecInicio, fnRecFin), fuente.slice(fnInicio, fnFin), 'la fuente recuperada debe mantener paridad de los sincronizadores');

console.log('PM12 P04 invalidación por contexto y descarte de respuestas antiguas: contrato OK');
