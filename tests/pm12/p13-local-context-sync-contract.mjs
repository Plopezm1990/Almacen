import assert from 'node:assert/strict';
import fs from 'node:fs';

const fuente = fs.readFileSync(new URL('../../fuente.js', import.meta.url), 'utf8');
const recuperada = fs.readFileSync(new URL('../../source-recovery/fuente-recuperado.js', import.meta.url), 'utf8');

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
assert.doesNotMatch(bloque, /sincronizarContextoPm07\(\{ setEmpresas, setLocales, setLocalActivoId, setProductos \}\)/);
assert.match(bloque, /if \(sincronizarContextoCompleto\) contextoPm07InicializadoRef\.current = false/);

const inicioRec = recuperada.indexOf('const localActivoIdRefPm07 =');
const finRec = recuperada.indexOf('const empresaDelLocalActivo =', inicioRec);
assert.ok(inicioRec > 0 && finRec > inicioRec, 'la fuente recuperada no conserva el sincronizador PM07');
assert.equal(recuperada.slice(inicioRec, finRec), bloque, 'la fuente recuperada debe mantener paridad exacta');

console.log('P13_LOCAL_CONTEXT_SYNC=PASS');
