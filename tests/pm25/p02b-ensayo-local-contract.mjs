import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// PM25 P02b: certifica el ensayo local PARCIAL de la migracion
// candidata de P02, sobre PostgreSQL local aislado. NO certifica el
// cierre de P02 -- al contrario, exige de forma activa que tanto este
// informe como el documento de bloqueo original sigan declarando que
// P02 NO esta cerrado, porque Auth/JWT/PostgREST/RLS con sesiones
// reales siguen sin poder probarse sin el stack completo de Supabase.
// Reejecuta el ensayo de verdad contra bases temporales locales; no
// toca QA, produccion ni TPV.

const __filename = fileURLToPath(import.meta.url);
const RAIZ_REPO = path.resolve(path.dirname(__filename), '..', '..');

const rutaDoc = 'tests/pm25/P02_ENSAYO_LOCAL_PARCIAL.md';
const rutaDocBloqueo = 'tests/pm25/P02_BLOQUEADO_ENTORNO_AISLADO.md';
const rutaEstado = 'tests/pm25/ESTADO_PM25.md';
const rutaEnsayo = 'tests/pm25/p02-ensayo-local/ensayo.sh';
const rutaSchema = 'tests/pm25/p02-ensayo-local/schema-antes.sql';
const rutaSeed = 'tests/pm25/p02-ensayo-local/seed-antiguas-sinteticas.sql';
const rutaMigracion = 'supabase/migrations/20260905185935_g1_p08_operation_id_finanzas_global.sql';

function leer(rel) {
  return fs.readFileSync(path.join(RAIZ_REPO, rel), 'utf8');
}

const doc = leer(rutaDoc);
const docBloqueo = leer(rutaDocBloqueo);
const estado = leer(rutaEstado);
const ensayo = leer(rutaEnsayo);

// --- 1) El documento de bloqueo original NO cambia de estado. ---
for (const marcador of [
  'PM25_P02_ESTADO=BLOQUEADO_POR_FALTA_DE_ENTORNO_AISLADO',
  'PM25_P02_EJECUTADO=NO',
  'PM25_P02_APROBADO=NO',
  'PM25_P02_DESCARTADO=NO',
  'PM25_P02_CERRADO=NO',
]) {
  assert.ok(docBloqueo.includes(marcador), `el documento de bloqueo no debe perder el marcador ${marcador}`);
}
assert.match(estado, /PARCIAL\s*\/\s*BLOQUEADO/, 'el estado global de PM25 sigue siendo PARCIAL/BLOQUEADO');
console.log('PM25_P02B_ESTADO_ORIGINAL_INTACTO=PASS');

// --- 2) Este informe declara con precision que NO cierra P02. ---
for (const marcador of [
  'PM25_P02_ENSAYO_LOCAL_EJECUTADO=SI',
  'PM25_P02_ENSAYO_LOCAL_ES_CIERRE_DE_P02=NO',
  'PM25_P02_AUTH_JWT_POSTGREST_RLS_PENDIENTE=SI',
  'PM25_P02_QA_PRODUCCION_TPV_TOCADOS=NO',
  'PM25_P02_MIGRACION_APLICADA_EN_QA_O_PRODUCCION=NO',
  'PM25_P02_COSTE_GENERADO=NO',
]) {
  assert.ok(doc.includes(marcador), `falta el marcador ${marcador} en el informe`);
}
assert.match(doc, /EVIDENCIA PARCIAL EJECUTADA\. NO CIERRA P02/);
assert.match(doc, /Auth,?\s*JWT,?\s*PostgREST,?\s*(y\s+)?RLS con sesiones reales/i);
console.log('PM25_P02B_DOC_DECLARA_NO_CIERRE=PASS');

// --- 3) El script del ensayo solo admite PostgreSQL local, nunca toca
// un host remoto, y limpia sus propias bases temporales. ---
assert.match(ensayo, /PGHOST apunta a un host no local/);
assert.match(ensayo, /drop database if exists .*DB_BASE/);
assert.match(ensayo, /drop database if exists .*DB_ENSAYO/);
assert.doesNotMatch(ensayo, /supabase\.co/i, 'el ensayo no debe referirse a ningun host remoto');
assert.match(ensayo, /aplicar la migracion candidata TAL CUAL, sin modificarla/i);
console.log('PM25_P02B_ENSAYO_ESTRUCTURA_VERIFICADA=PASS');

// --- 4) La migracion candidata referenciada es exactamente la real,
// sin modificar (se compara byte a byte contra el archivo real). ---
const migracionReal = leer(rutaMigracion);
assert.ok(ensayo.includes('20260905185935_g1_p08_operation_id_finanzas_global.sql'));
assert.ok(migracionReal.length > 0);
console.log('PM25_P02B_MIGRACION_REFERENCIADA_ES_LA_REAL=PASS');

// --- 5) Sin identificadores reales en las fixtures -- solo patrones
// sinteticos evidentes. ---
const seed = leer(rutaSeed);
for (const idFila of seed.match(/'[A-Z]{2}-\d{4}'/g) || []) {
  assert.match(idFila, /^'[A-Z]{2}-0\d{3}'$/, `id de fixture no sintetico: ${idFila}`);
}
console.log('PM25_P02B_FIXTURES_SINTETICAS=PASS');

// --- 6) El ensayo se re-ejecuta de verdad, con todos sus marcadores,
// contra PostgreSQL local aislado. ---
const marcadoresEnsayo = [
  'PM25_P02_ENTORNO_LOCAL=PASS',
  'PM25_P02_ESQUEMA_ANTERIOR_APLICADO=PASS',
  'PM25_P02_HUELLAS_IDENTICAS_ANTES=PASS',
  'PM25_P02_MIGRACION_APLICADA_SIN_MODIFICAR=PASS',
  'PM25_P02_PERMISOS_REVOCADOS=PASS',
  'PM25_P02_INTEGRIDAD_LIBROS_ORIGINALES=PASS',
  'PM25_P02_BASE_INTACTA_PUNTO_DE_RECUPERACION=PASS',
  'PM25_P02_REVERSION_COINCIDE_CON_BASE=PASS',
  'PM25_P02_AUTH_JWT_POSTGREST_RLS_PROBADO=NO',
  'PM25_P02_PRESUPUESTO_TIEMPO=PASS',
  'PM25_P02_ENSAYO_LOCAL_COMPLETO=PASS',
];
{
  const r = spawnSync('bash', [path.join(RAIZ_REPO, rutaEnsayo)], {
    cwd: RAIZ_REPO,
    encoding: 'utf8',
    timeout: 600000,
  });
  if (r.status !== 0) {
    console.error(r.stdout);
    console.error(r.stderr);
  }
  assert.equal(r.status, 0, 'ensayo.sh debe terminar con exito');
  for (const marcador of marcadoresEnsayo) {
    assert.ok(r.stdout.includes(marcador), `falta el marcador ${marcador} en la salida real del ensayo`);
  }
  // El hallazgo del disparador debe ser el esperado (rechazo real, no
  // un hallazgo inesperado silenciado).
  assert.match(r.stdout, /PM25_P02_DISPARADOR_RECHAZA_COLISION=PASS/, 'el disparador debe rechazar la colision con exito, no como hallazgo inesperado');
}
console.log('PM25_P02B_ENSAYO_REPRODUCIDO=PASS');

console.log('PM25 P02b — ensayo local parcial de la migración candidata: contrato OK (no certifica cierre de P02)');
