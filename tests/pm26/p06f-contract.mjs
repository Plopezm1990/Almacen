import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { escanearArbol } from '../../tools/seguridad/verificar-secretos-e-identificadores.mjs';

// PM26 P06f: contrato del endurecimiento del aviso H (preflight
// embebido en la misma ejecucion, atomicidad BEGIN/COMMIT,
// lock_timeout/statement_timeout con prueba real de bloqueo
// concurrente, comprobacion de indices equivalentes con otro nombre).
// No certifica ninguna aplicacion real en QA -- certifica que (1) el
// archivo real contiene todas las protecciones exigidas, (2) el hash
// documentado coincide con el archivo real, (3) validar.sh (que
// reproduce todo, incluida la prueba de lock_timeout con bloqueo
// concurrente real) se re-ejecuta de verdad y pasa, y (4) ni el
// informe ni este contrato contienen ningun secreto real.

const __filename = fileURLToPath(import.meta.url);
const RAIZ_REPO = path.resolve(path.dirname(__filename), '..', '..');

function leer(rel) {
  return fs.readFileSync(path.join(RAIZ_REPO, rel), 'utf8');
}

const doc = leer('tests/pm26/P06F_AVISO_H_ENDURECIDO.md');

for (const marcador of [
  'PM26_P06F_PREFLIGHT_EMBEBIDO_EN_MISMA_EJECUCION=SI',
  'PM26_P06F_PREFLIGHT_INDEPENDIENTE_MANTENIDO=SI',
  'PM26_P06F_ATOMICIDAD_BEGIN_COMMIT=SI',
  'PM26_P06F_LOCK_TIMEOUT_CONFIGURADO=SI',
  'PM26_P06F_TIMEOUTS_SET_LOCAL_ANTES_PREFLIGHT=SI',
  'PM26_P06F_LOCK_TIMEOUT_PROBADO_CON_BLOQUEO_REAL=SI',
  'PM26_P06F_STATEMENT_TIMEOUT_CONFIGURADO=SI',
  'PM26_P06F_IF_NOT_EXISTS_RETIRADO=SI',
  'PM26_P06F_INDICE_EQUIVALENTE_OTRO_NOMBRE_COMPROBADO=SI',
  'PM26_P06F_CHECKLIST_ASESORES_PRESENTADO=SI',
  'PM26_P06F_ASESORES_REEJECUTADOS_EN_ESTA_RONDA=NO',
  'PM26_P06F_SHA256_RECALCULADO=SI',
  'PM26_P06F_PRUEBAS_REPETIDAS=SI',
  'PM26_P06F_APLICADO_EN_QA=NO',
  'PM26_P06F_P01_GATE_CORREGIDO=SI',
]) {
  assert.ok(doc.includes(marcador), `falta el marcador ${marcador} en el informe`);
}
console.log('PM26_P06F_ESTADO_DOC_VERIFICADO=PASS');

// --- El archivo real de la migracion contiene todas las protecciones. ---
const rutaMigracion = 'supabase/qa-solo/pm26_p06b_rendimiento_indices_rls_initplan.sql';
const migracionAbs = path.join(RAIZ_REPO, rutaMigracion);
assert.ok(fs.existsSync(migracionAbs), `debe existir ${rutaMigracion}`);
const migracionTexto = fs.readFileSync(migracionAbs, 'utf8');

assert.match(migracionTexto, /^begin;/m, 'la migracion debe empezar con BEGIN explicito');
assert.match(migracionTexto, /^commit;/m, 'la migracion debe terminar con COMMIT explicito');
assert.match(migracionTexto, /set local lock_timeout = '5s';/);
assert.match(migracionTexto, /set local statement_timeout = '30s';/);
assert.match(migracionTexto, /do \$\$/);
assert.match(migracionTexto, /PREFLIGHT_FALLO/);
assert.match(migracionTexto, /PREFLIGHT_CATALOGO=PASS/);
// El BEGIN debe preceder a los limites locales, y estos deben proteger
// ya el preflight y toda la DDL posterior.
const idxBegin = migracionTexto.indexOf('begin;');
const idxDoBlock = migracionTexto.indexOf('do $$');
const idxLockTimeout = migracionTexto.indexOf("set local lock_timeout");
const idxCreateIndex = migracionTexto.indexOf('create index');
const idxCommit = migracionTexto.lastIndexOf('commit;');
assert.ok(idxBegin < idxLockTimeout, 'BEGIN debe preceder a los limites de tiempo locales');
assert.ok(idxLockTimeout < idxDoBlock, 'los limites de tiempo deben proteger tambien el preflight');
assert.ok(idxDoBlock < idxCreateIndex, 'el preflight debe preceder a la creacion de indices');
assert.ok(idxCreateIndex < idxCommit, 'la creacion de indices debe preceder al COMMIT final');
assert.doesNotMatch(
  migracionTexto,
  /create\s+index\s+if\s+not\s+exists/i,
  'la migracion no debe ocultar carreras o divergencias con CREATE INDEX IF NOT EXISTS'
);

// Comprobacion de indices equivalentes con otro nombre, para las 4 columnas.
for (const columna of ['actor_user_id', 'operation_id', 'revierte_pago_id', 'user_id']) {
  assert.ok(
    migracionTexto.includes(`a.attname = '${columna}'`),
    `falta la comprobacion de indice equivalente con otro nombre para la columna ${columna}`
  );
}
console.log('PM26_P06F_MIGRACION_CONTIENE_PROTECCIONES=PASS');

// --- Hash documentado coincide con el archivo real. ---
const hashReal = crypto.createHash('sha256').update(fs.readFileSync(migracionAbs)).digest('hex');
assert.match(doc, new RegExp(hashReal), 'el hash SHA-256 documentado no coincide con el archivo real');
console.log('PM26_P06F_HASH_VERIFICADO=PASS');

// --- El preflight independiente tambien tiene la comprobacion de
// indices equivalentes con otro nombre, y coincide con el embebido. ---
const preflight = leer('tests/pm26/p06b-h-aislado/preflight-catalogo.sql');
for (const columna of ['actor_user_id', 'operation_id', 'revierte_pago_id', 'user_id']) {
  assert.ok(preflight.includes(`a.attname = '${columna}'`), `falta en preflight-catalogo.sql la comprobacion para ${columna}`);
}
console.log('PM26_P06F_PREFLIGHT_INDEPENDIENTE_ACTUALIZADO=PASS');

// --- Re-ejecuta de verdad validar.sh (incluye ahora la prueba de
// lock_timeout con bloqueo concurrente real, y la reaplicacion
// rechazada) -- no se toma como afirmacion. ---
const validar = path.join(RAIZ_REPO, 'tests/pm26/p06b-h-aislado/validar.sh');
const r1 = spawnSync('bash', [validar], { cwd: RAIZ_REPO, encoding: 'utf8', timeout: 120000 });
if (r1.status !== 0) {
  console.error(r1.stdout);
  console.error(r1.stderr);
}
assert.equal(r1.status, 0, 'validar.sh (endurecido) debe terminar con exito');
for (const marcador of [
  'PM26_P06B_H_AISLADO_FUERA_DE_SUPABASE_MIGRATIONS=PASS',
  'PM26_P06B_H_AISLADO_PREFLIGHT_EMBEBIDO_COINCIDE=PASS',
  'PM26_P06B_H_AISLADO_PREFLIGHT_POSITIVO=PASS',
  'PM26_P06B_H_AISLADO_PREFLIGHT_NEGATIVO_CATALOGO_DISTINTO=PASS',
  'PM26_P06B_H_AISLADO_PREFLIGHT_ROLLBACK_SIMULACRO_LIMPIO=PASS',
  'PM26_P06B_H_AISLADO_MIGRACION_APLICADA=PASS',
  'PM26_P06B_H_AISLADO_REAPLICACION_RECHAZADA_POR_PREFLIGHT=PASS',
  'PM26_P06B_H_AISLADO_PREFLIGHT_NEGATIVO_YA_APLICADO=PASS',
  'PM26_P06B_H_AISLADO_PERMISOS_IDENTICOS_ANTES_DESPUES=PASS',
  'PM26_P06B_H_AISLADO_SOLO_4_INDICES_NUEVOS_NINGUNO_ELIMINADO=PASS',
  'PM26_P06B_H_AISLADO_INITPLAN_CONFIRMADO=PASS',
  'PM26_P06B_H_AISLADO_REVERSION_EXACTA=PASS',
  'PM26_P06B_H_AISLADO_PREFLIGHT_PASA_TRAS_REVERTIR=PASS',
  'PM26_P06B_H_AISLADO_LOCK_TIMEOUT_CONFIRMADO=PASS',
  'PM26_P06B_H_AISLADO_LOCK_TIMEOUT_SIN_APLICACION_PARCIAL=PASS',
  'PM26_P06B_H_AISLADO_REAPLICACION_LIMPIA_TRAS_LOCK_TEST=PASS',
  'PM26_P06B_H_AISLADO_BLOQUEO_SHARELOCK_CONFIRMADO=PASS',
  'PM26_P06B_H_AISLADO_VALIDACION_COMPLETA=PASS',
]) {
  assert.ok(r1.stdout.includes(marcador), `falta el marcador ${marcador} en la salida real de validar.sh`);
}
console.log('PM26_P06F_VALIDAR_SH_REPRODUCIDO=PASS');

// --- Re-ejecuta tambien la prueba de exclusion de produccion con la
// CLI real (sin cambios funcionales desde P06e, pero se reconfirma). ---
const exclusion = path.join(RAIZ_REPO, 'tests/pm26/p06b-h-aislado/prueba-exclusion-cli.sh');
const r2 = spawnSync('bash', [exclusion], { cwd: RAIZ_REPO, encoding: 'utf8', timeout: 120000 });
if (r2.status !== 0) {
  console.error(r2.stdout);
  console.error(r2.stderr);
}
assert.equal(r2.status, 0, 'prueba-exclusion-cli.sh debe terminar con exito');
assert.ok(r2.stdout.includes('PM26_P06B_H_CLI_EXCLUSION_COMPLETA=PASS'));
console.log('PM26_P06F_EXCLUSION_CLI_REPRODUCIDA=PASS');

// --- Ninguna migracion real para el aviso F, y ninguna mencion a
// prefiltros_candidatos en la migracion de H. ---
const migraciones = fs.readdirSync(path.join(RAIZ_REPO, 'supabase/migrations'));
assert.ok(!migraciones.some((m) => /prefiltro/i.test(m)), 'no debe existir ninguna migracion del aviso F');
assert.ok(!/prefiltro/i.test(migracionTexto), 'la migracion de H no debe mencionar prefiltros_candidatos');

// --- Estructural: sin secretos ni identificadores internos. ---
{
  const archivosNuevos = [
    'tests/pm26/P06F_AVISO_H_ENDURECIDO.md',
    'tests/pm26/p06f-contract.mjs',
    'supabase/qa-solo/pm26_p06b_rendimiento_indices_rls_initplan.sql',
    'tests/pm26/p06b-h-aislado/preflight-catalogo.sql',
    'tests/pm26/p06b-h-aislado/validar.sh',
  ];
  const hallazgos = escanearArbol({ raiz: RAIZ_REPO, archivos: archivosNuevos, ubicacionesLegitimas: [] });
  const secretosReales = hallazgos.filter((h) => h.tipo === 'secreto_real');
  const identificadoresNoAdmitidos = hallazgos.filter(
    (h) => h.tipo === 'identificador_duplicado' && h.categoria !== 'falso_positivo'
  );
  assert.equal(secretosReales.length, 0, 'los archivos de P06f no deben contener ningún secreto real');
  assert.equal(
    identificadoresNoAdmitidos.length,
    0,
    'los archivos de P06f no deben contener ningún candidato a identificador interno real -- encontrado en: ' +
      identificadoresNoAdmitidos.map((h) => `${h.archivo}:${h.linea} (${h.categoria})`).join(', ')
  );
  const reset = leer('reset-pruebas-preview.js');
  const claveQA = reset.match(/var SUPABASE_QA_KEY = "([^"]+)";/)?.[1];
  const urlQAHost = reset.match(/var SUPABASE_QA_HOST = "([^"]+)";/)?.[1];
  assert.ok(claveQA && urlQAHost, 'no se pudo extraer la clave/URL QA reales desde el propio archivo para la comprobación');
  for (const rel of archivosNuevos) {
    const contenido = leer(rel);
    assert.ok(!contenido.includes(claveQA), `${rel} no debe contener la clave pública QA copiada literalmente`);
    assert.ok(!contenido.includes(urlQAHost), `${rel} no debe contener el host QA copiado literalmente`);
  }
  console.log('PM26_P06F_SIN_SECRETOS_NI_IDENTIFICADORES=PASS');
}

console.log('PM26 P06f — aviso H endurecido (preflight embebido, atomicidad, lock_timeout): contrato OK');
