import assert from 'node:assert/strict';
import fs from 'node:fs';

const storage = fs.readFileSync(new URL('../../index-storage-bootstrap.js', import.meta.url), 'utf8');
const index = fs.readFileSync(new URL('../../index.html', import.meta.url), 'utf8');

assert.match(storage, /var colaSubidaKv = \[\];/, 'existe una cola global para las escrituras KV');
assert.match(storage, /function drenarColaKv\(\)/, 'la cola KV tiene un drenaje serial');
assert.match(storage, /function encolarKv\(key, tarea\)/, 'las escrituras KV pasan por un planificador');
assert.match(storage, /if \(key === "localActivoId"\) colaSubidaKv\.unshift\(item\)/, 'localActivoId tiene prioridad sobre el resto de claves KV');
assert.match(storage, /encolarKv\(key, function \(\) \{\s*return conTiempoLimite\(encolarPorClave\(key, function \(\) \{ return guardarBloque\(key, anterior, value\); \}\), ESPERA_NUBE_MS\);\s*\}\)/s, 'el guardado KV queda acotado por timeout dentro de la cola');
assert.match(storage, /encolarKv\(key, function \(\) \{\s*return conTiempoLimite\(encolarPorClave\(key, function \(\) \{ return guardarBloque\(key, null, valor\); \}\), ESPERA_NUBE_MS\);\s*\}\)/s, 'los pendientes usan la misma cola priorizada');
assert.match(index, /index-storage-bootstrap\.js\?v=(?:pm12|qa-movimientos-local)-[a-z0-9-]+/, 'el bootstrap KV lleva cache-busting versionado');

console.log('PM12 P15 contrato de prioridad de escrituras KV OK');
