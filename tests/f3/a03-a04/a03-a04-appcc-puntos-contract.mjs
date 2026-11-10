import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const migration = readFileSync('supabase/migrations/20261109180000_a03_appcc_puntos_server_side.sql', 'utf8').toLowerCase();
const runtime = readFileSync('fuente.js', 'utf8');
const recovered = readFileSync('source-recovery/fuente-recuperado.js', 'utf8');
const bridge = readFileSync('appcc-authority-storage-bridge.js', 'utf8');

for (const fragment of [
  'appcc_guardar_punto',
  'appcc_desactivar_punto',
  'private.la_tiene_local',
  'on conflict (id) do update',
  'revoke all on function'
]) assert.ok(migration.includes(fragment), `falta contrato de puntos APPCC: ${fragment}`);

for (const source of [runtime, recovered]) {
  assert.match(source, /appcc_guardar_punto/, 'la creación/edición de puntos debe ir por RPC');
  assert.match(source, /appcc_desactivar_punto/, 'la baja de puntos debe ser server-side');
  assert.match(source, /normalizarPuntoAppccF3/, 'la respuesta del servidor debe normalizarse');
}
assert.match(bridge, /puntosControl/, 'el puente debe leer puntos desde la tabla autoritativa');
assert.match(bridge, /appcc_puntos_control/, 'el puente debe consultar la tabla de puntos');

console.log('A03_A04_APPCC_PUNTOS_SERVER_SIDE_CONTRACT=PASS');
