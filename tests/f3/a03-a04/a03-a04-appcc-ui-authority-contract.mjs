import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const runtime = readFileSync('fuente.js', 'utf8');
const recovered = readFileSync('source-recovery/fuente-recuperado.js', 'utf8');
const bridge = readFileSync('appcc-authority-storage-bridge.js', 'utf8');
const html = readFileSync('index.html', 'utf8');

for (const source of [runtime, recovered]) {
  assert.match(source, /appcc_registrar_lectura/, 'APPCC debe usar la RPC autoritativa de lecturas');
  assert.match(source, /normalizarLecturaAppccF3/, 'la respuesta server-side debe normalizarse antes de entrar en el estado UI');
  assert.match(source, /__laAppccAuthorityActive/, 'el camino remoto debe estar protegido por la capacidad desplegada');
  assert.match(source, /function crearLogicaAppcc\(\{[\s\S]*empresaId = null \}\)/, 'APPCC debe recibir el contexto de empresa para la RPC');
}

assert.match(bridge, /appcc_lecturas/, 'el puente debe leer la tabla dedicada');
assert.match(bridge, /storage\.set = async function[\s\S]*registrosAppcc[\s\S]*originalSet/, 'el puente debe interceptar la escritura de registrosAppcc');
assert.match(bridge, /serverAuthoritative: true/, 'la respuesta del puente debe declarar la autoridad server-side');
assert.match(bridge, /window\.__laAppccAuthorityActive = true/, 'el puente debe publicar la capacidad únicamente tras comprobarla');
assert.match(html, /appcc-authority-storage-bridge\.js/, 'el puente APPCC debe cargarse antes de fuente.js');

console.log('A03_A04_APPCC_UI_AUTHORITY_CONTRACT=PASS');
