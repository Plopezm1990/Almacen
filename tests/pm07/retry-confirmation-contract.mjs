import fs from 'node:fs';
import assert from 'node:assert/strict';

// AUD-009: un reintento completado debe limpiar el aviso de guardado.
// El flujo de reintento vive en el bootstrap de almacenamiento, mientras que
// la interfaz escucha `guardado-confirmado` para retirar el banner.
const src = fs.readFileSync('index-storage-bootstrap.js', 'utf8');
const inicio = src.indexOf('window.reintentarSincronizacion = async function');
assert.ok(inicio >= 0, 'no se encontró el flujo de reintento');
const fin = src.indexOf('\n  };', inicio);
assert.ok(fin > inicio, 'no se pudo acotar el flujo de reintento');
const bloque = src.slice(inicio, fin);

assert.match(bloque, /await window\.subirPendientes\(\);/);
assert.match(bloque, /pendientes\(\)\.indexOf\(claveConfirmada\) === -1/);
assert.match(bloque, /!denegadoVigente\(claveConfirmada\)/);
assert.match(bloque, /new CustomEvent\("guardado-confirmado"/);
assert.match(bloque, /reintento: true/);

console.log('AUD-009_REINTENTO_LIMPIA_AVISO_TRAS_CONFIRMACION=PASS');
