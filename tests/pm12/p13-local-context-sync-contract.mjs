import assert from 'node:assert/strict';
import fs from 'node:fs';

const fuente = fs.readFileSync(new URL('../../fuente.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const recuperada = fs.readFileSync(new URL('../../source-recovery/fuente-recuperado.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');

const inicioFuncion = fuente.indexOf('async function sincronizarContextoPm07');
const finFuncion = fuente.indexOf('function SelectorLocalInformes', inicioFuncion);
assert.ok(inicioFuncion > 0 && finFuncion > inicioFuncion, 'no se encontró sincronizarContextoPm07');
const funcion = fuente.slice(inicioFuncion, finFuncion);
assert.match(funcion, /\.in\("key", \["productos"\]\)/);
assert.doesNotMatch(funcion, /empresasNube|localesNube|localActivoNube/);
assert.doesNotMatch(funcion, /setEmpresas|setLocales|setLocalActivoId/);
assert.match(funcion, /contexto seguro sembrado/);

const inicio = fuente.indexOf('const localActivoIdRefPm07 =');
const fin = fuente.indexOf('const empresaDelLocalActivo =', inicio);
assert.ok(inicio > 0 && fin > inicio, 'no se encontró el sincronizador de contexto PM07');
const bloque = fuente.slice(inicio, fin);

assert.match(bloque, /const localActivoIdRefPm07 = .*useRef\)\(localActivoId\)/);
assert.match(bloque, /const contextoPm07InicializadoRef = .*useRef\)\(false\)/);
assert.match(bloque, /const perfilContextoListo = !!miPerfil\?\.rol/);
assert.match(bloque, /const sincronizarContextoCompleto = perfilContextoListo && miPerfil\.rol === "Propietario" && !contextoPm07InicializadoRef\.current/);
assert.match(bloque, /if \(perfilContextoListo\) contextoPm07InicializadoRef\.current = true/);
assert.match(bloque, /if \(sincronizarContextoCompleto\) \{/);
assert.match(bloque, /sincronizarContextoPm07\(\{\s*setProductos,\s*empresaId:\s*empresaContexto,\s*localActivoId,\s*esContextoVigente\s*\}\)/);
assert.doesNotMatch(bloque, /sincronizarContextoPm07\(\{[\s\S]*?setEmpresas/);
assert.doesNotMatch(bloque, /sincronizarContextoPm07\(\{[\s\S]*?setLocales/);
assert.doesNotMatch(bloque, /sincronizarContextoPm07\(\{[\s\S]*?setLocalActivoId/);
assert.match(bloque, /if \(sincronizarContextoCompleto\) contextoPm07InicializadoRef\.current = false/);
assert.match(bloque, /\[ready, miPerfil\?\.rol, localActivoId,/);

const inicioRec = recuperada.indexOf('const localActivoIdRefPm07 =');
const finRec = recuperada.indexOf('const empresaDelLocalActivo =', inicioRec);
assert.ok(inicioRec > 0 && finRec > inicioRec, 'la fuente recuperada no conserva el sincronizador PM07');
assert.equal(recuperada.slice(inicioRec, finRec), bloque, 'la fuente recuperada debe mantener paridad exacta');
const inicioFuncionRec = recuperada.indexOf('async function sincronizarContextoPm07');
const finFuncionRec = recuperada.indexOf('function SelectorLocalInformes', inicioFuncionRec);
assert.equal(recuperada.slice(inicioFuncionRec, finFuncionRec), funcion,
  'la fuente recuperada debe conservar también la autoridad del contexto seguro');

console.log('P13_LOCAL_CONTEXT_SYNC=PASS');
