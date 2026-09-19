// PM33 P05 -- registro exacto de qué objetos crea cada ejecución del kit
// de QA, para que 04_limpiar.mjs borre EXACTAMENTE esos objetos (nunca
// "todo lo que empiece por qa-pm33-", que podría alcanzar restos de otra
// ejecución) y para conservar constancia de lo pendiente si algo falla a
// mitad de camino.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const RUTA = fileURLToPath(new URL('./._manifest.json', import.meta.url));

export function nuevoRunId() {
  const t = new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15);
  const azar = Math.random().toString(36).slice(2, 8);
  return `${t}-${azar}`;
}

export function cargarManifest() {
  if (!existsSync(RUTA)) return null;
  return JSON.parse(readFileSync(RUTA, 'utf8'));
}

export function guardarManifest(m) {
  writeFileSync(RUTA, JSON.stringify(m, null, 2));
}

export function nuevoManifest(runId) {
  return {
    runId,
    estado: 'pendiente', // pendiente | confirmado | revertido | fallo_parcial
    creadoEn: new Date().toISOString(),
    usuarios: {},   // nombre -> { uid, email }
    empresas: [],
    locales: [],
    almacenKv: [],  // [empresa_id, local_id, key]
    membresiaIds: [],
  };
}

export { RUTA as RUTA_MANIFEST };
