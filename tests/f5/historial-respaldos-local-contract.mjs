import assert from 'node:assert/strict';
import fs from 'node:fs';

const storage = fs.readFileSync('index-storage-bootstrap.js', 'utf8');

assert.match(
  storage,
  /var CLAVES_SOLO_DISPOSITIVO = \{[\s\S]*modoEmpleado: true,[\s\S]*usuarioActivoId: true,[\s\S]*historialRespaldos: true[\s\S]*\};/
);
assert.match(
  storage,
  /if \(esClaveSoloDispositivo\(key\)\) \{[\s\S]*quitarPendiente\(key\)[\s\S]*return \{ key: key, value: value, shared: false, confirmadoServidor: false, pendienteSincronizacion: false \};/
);
assert.match(
  storage,
  /if \(esClaveSoloDispositivo\(key\)\) \{[\s\S]*quitarPendiente\(key\)[\s\S]*quitarDenegado\(key\)[\s\S]*continue;/
);

console.log('F5 historial de respaldos local: contrato OK');
