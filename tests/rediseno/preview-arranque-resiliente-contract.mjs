import assert from 'node:assert/strict';
import fs from 'node:fs';

const index = fs.readFileSync('index.html', 'utf8');
const storage = fs.readFileSync('index-storage-bootstrap.js', 'utf8');
const loader = fs.readFileSync('index-loader.js', 'utf8');
const fuente = fs.readFileSync('fuente.js', 'utf8');
const shell = fs.readFileSync('la-orbita-shell.js', 'utf8');

assert.doesNotMatch(index, /diagnostico-capas-almacen-preview\.js/, 'el diagnostico temporal no se publica en el preview');
assert.match(index, /index-storage-bootstrap\.js\?v=qa-arranque-resiliente-v2-20261121/, 'el puente de almacenamiento tiene versión de arranque');
assert.match(storage, /conTiempoLimite\(leerHistorialRespaldosIndexedDb\(\), 1200\)/, 'el historial IndexedDB no puede bloquear el arranque');
assert.match(loader, /20000/, 'el arranque tiene un límite visible de 20 segundos');
assert.match(loader, /error-arranque/, 'el arranque expone un aviso accesible');
assert.match(loader, /Reintentar/, 'el aviso de arranque ofrece reintento');
assert.match(loader, /location\.reload\(\)/, 'el reintento vuelve a cargar sin borrar datos');
assert.match(fuente, /requestIdleCallback/, 'el respaldo automático se difiere a inactividad');
assert.match(fuente, /No se pudo crear el respaldo automático/, 'un fallo del respaldo no bloquea la suite');
assert.match(shell, /function textoSiCambia/, 'la cabecera no reescribe texto idéntico');
assert.match(shell, /prepararPendiente/, 'el observador del marco está agrupado');

console.log('PREVIEW_ARRANQUE_RESILIENTE=PASS');
