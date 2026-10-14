import assert from 'node:assert/strict';
import fs from 'node:fs';

const fuente = fs.readFileSync(new URL('../../fuente.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const recuperada = fs.readFileSync(new URL('../../source-recovery/fuente-recuperado.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');

const inicio = fuente.indexOf('const localActivoIdRefPm07 =');
const fin = fuente.indexOf('const empresaDelLocalActivo =', inicio);
assert.ok(inicio > 0 && fin > inicio, 'no se encontró el sincronizador de contexto PM07');
const bloque = fuente.slice(inicio, fin);

assert.match(bloque, /const localActivoIdRefPm07 = .*useRef\)\(localActivoId\)/);
assert.match(bloque, /const contextoPm07InicializadoRef = .*useRef\)\(false\)/);
assert.match(bloque, /const sincronizarContextoCompleto = !contextoPm07InicializadoRef\.current/);
assert.match(bloque, /if \(sincronizarContextoCompleto\) \{/);
assert.match(bloque, /setLocalActivoId: \(id\) => \{/);
assert.match(bloque, /localActivoIdRefPm07\.current === localActivoInicial/);
assert.match(bloque, /!localActivoInicial && localActivoIdRefPm07\.current === localActivoInicial/);
assert.match(bloque, /ui-context-bridge/);
assert.match(bloque, /valor global de almacen_kv es legado/);

// Regresión PM12: una preferencia local válida (A2) debe sobrevivir a la
// hidratación inicial, mientras que un arranque sin preferencia aún puede
// adoptar el valor remoto por defecto.
const permiteHidratacionRemota = (localInicial, localActual) =>
  !localInicial && localActual === localInicial;
assert.equal(permiteHidratacionRemota('QA-A2', 'QA-A2'), false,
  'A2 guardado en el dispositivo no debe ser sustituido por A1 remoto');
assert.equal(permiteHidratacionRemota(null, null), true,
  'sin preferencia local se permite hidratar el valor remoto');
assert.equal(permiteHidratacionRemota(null, 'QA-A2'), false,
  'una elección hecha durante la petición inicial tampoco debe perderse');
assert.doesNotMatch(bloque, /sincronizarContextoPm07\(\{ setEmpresas, setLocales, setLocalActivoId, setProductos \}\)/);
assert.match(bloque, /if \(sincronizarContextoCompleto\) contextoPm07InicializadoRef\.current = false/);

const inicioRec = recuperada.indexOf('const localActivoIdRefPm07 =');
const finRec = recuperada.indexOf('const empresaDelLocalActivo =', inicioRec);
assert.ok(inicioRec > 0 && finRec > inicioRec, 'la fuente recuperada no conserva el sincronizador PM07');
assert.equal(recuperada.slice(inicioRec, finRec), bloque, 'la fuente recuperada debe mantener paridad exacta');

console.log('P13_LOCAL_CONTEXT_SYNC=PASS');
