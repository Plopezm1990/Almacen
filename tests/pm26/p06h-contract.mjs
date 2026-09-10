import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { escanearArbol } from '../../tools/seguridad/verificar-secretos-e-identificadores.mjs';

// PM26 P06h: contrato del diseno estricto (Opcion B) del aviso F para
// prefiltros_candidatos -- aislamiento por empresa/local, RLS en
// lectura, RPC en escritura, migracion combinada A+C justificada por
// 0 filas. No certifica ninguna aplicacion real en QA -- certifica que
// (1) el documento de diseno contiene todos los marcadores exigidos,
// (2) el hash documentado coincide con el archivo real, (3) la
// migracion vive fuera de supabase/migrations y no toca fuente.js,
// (4) validar.sh (que reproduce todo el ciclo, incluida la bateria de
// 15 casos) se re-ejecuta de verdad y pasa, y (5) ni el documento ni
// este contrato contienen ningun secreto real.

const __filename = fileURLToPath(import.meta.url);
const RAIZ_REPO = path.resolve(path.dirname(__filename), '..', '..');

function leer(rel) {
  return fs.readFileSync(path.join(RAIZ_REPO, rel), 'utf8');
}

const doc = leer('tests/pm26/P06H_AVISO_F_DISENO_DESPLIEGUE.md');

for (const marcador of [
  'PM26_P06H_OPCION_B_CONFIRMADA=SI',
  'PM26_P06H_MIGRACION_COMBINADA_JUSTIFICADA_0_FILAS=SI',
  'PM26_P06H_PREFLIGHT_DETECTA_PRODUCCION=SI',
  'PM26_P06H_PREFLIGHT_DETECTA_FILAS_EXISTENTES=SI',
  'PM26_P06H_FASE_B_BLOQUEADA_POR_DEFECTO_K=SI',
  'PM26_P06H_FUENTE_JS_TOCADO=NO',
  'PM26_P06H_BATERIA_15_CASOS=PASS',
  'PM26_P06H_REAPLICACION_RECHAZADA_POR_PREFLIGHT=SI',
  'PM26_P06H_REVERSION_EXACTA=SI',
  'PM26_P06H_SHA256_CALCULADO=SI',
  'PM26_P06H_APLICADO_EN_QA=NO',
  'PM26_P06H_APLICADO_EN_PRODUCCION=NO',
]) {
  assert.ok(doc.includes(marcador), `falta el marcador ${marcador} en el informe`);
}
console.log('PM26_P06H_ESTADO_DOC_VERIFICADO=PASS');

// --- El archivo real de la migracion existe, vive fuera de
// supabase/migrations, y contiene las protecciones exigidas. ---
const rutaMigracion = 'supabase/qa-solo/pm26_p06h_aislamiento_prefiltros_candidatos.sql';
const migracionAbs = path.join(RAIZ_REPO, rutaMigracion);
assert.ok(fs.existsSync(migracionAbs), `debe existir ${rutaMigracion}`);
const migracionTexto = fs.readFileSync(migracionAbs, 'utf8');

const migraciones = fs.readdirSync(path.join(RAIZ_REPO, 'supabase/migrations'));
assert.ok(!migraciones.some((m) => /prefiltro/i.test(m)), 'no debe existir ninguna migracion real del aviso F en supabase/migrations');

assert.match(migracionTexto, /^begin;/m, 'la migracion debe empezar con BEGIN explicito');
assert.match(migracionTexto, /^commit;/m, 'la migracion debe terminar con COMMIT explicito');
assert.match(migracionTexto, /set lock_timeout = '5s';/);
assert.match(migracionTexto, /set statement_timeout = '30s';/);
assert.match(migracionTexto, /PREFLIGHT_FALLO/);
assert.match(migracionTexto, /PREFLIGHT_CATALOGO=PASS/);
assert.match(migracionTexto, /'prefiltros - propietario lee'/, 'el preflight debe descartar las 3 politicas reales de produccion');
assert.match(migracionTexto, /'prefiltros - propietario crea'/);
assert.match(migracionTexto, /'prefiltros - propietario borra'/);
assert.match(migracionTexto, /v_total <> 0/, 'el preflight debe exigir 0 filas antes de imponer NOT NULL');
assert.match(migracionTexto, /add column empresa_id text not null/);
assert.match(migracionTexto, /add column local_id text not null/);
assert.match(migracionTexto, /private\.pm11_puede_ver_personal\(empresa_id, local_id\)/);
assert.match(migracionTexto, /private\.pm11_puede_mutar_personal\(p_empresa_id, p_local_id\)/);
assert.match(migracionTexto, /revoke insert, update, delete on public\.prefiltros_candidatos from authenticated, anon, public;/);
assert.match(migracionTexto, /grant select on public\.prefiltros_candidatos to authenticated;/);
console.log('PM26_P06H_MIGRACION_CONTIENE_PROTECCIONES=PASS');

// El orden importa: preflight antes que los limites de tiempo, antes
// que las columnas/politica/RPC, antes del COMMIT final.
const idxBegin = migracionTexto.indexOf('begin;');
const idxDoBlock = migracionTexto.indexOf('do $$');
const idxLockTimeout = migracionTexto.indexOf('set lock_timeout');
const idxAlterColumn = migracionTexto.indexOf('add column empresa_id');
const idxCommit = migracionTexto.lastIndexOf('commit;');
assert.ok(idxBegin < idxDoBlock, 'BEGIN debe preceder al bloque de preflight');
assert.ok(idxDoBlock < idxLockTimeout, 'el preflight debe preceder a los limites de tiempo');
assert.ok(idxLockTimeout < idxAlterColumn, 'los limites de tiempo deben preceder a las columnas nuevas');
assert.ok(idxAlterColumn < idxCommit, 'las columnas nuevas deben preceder al COMMIT final');

// --- Hash documentado coincide con el archivo real. ---
const hashReal = crypto.createHash('sha256').update(fs.readFileSync(migracionAbs)).digest('hex');
assert.match(doc, new RegExp(hashReal), 'el hash SHA-256 documentado no coincide con el archivo real');
console.log('PM26_P06H_HASH_VERIFICADO=PASS');

// --- fuente.js no se toco (Fase B bloqueada por el Defecto K). ---
const fuenteJs = leer('fuente.js');
assert.ok(
  fuenteJs.includes('pm11_crear_prefiltro_candidato') === false && fuenteJs.includes('pm11_eliminar_prefiltro_candidato') === false,
  'fuente.js no debe llamar todavia a las RPC nuevas -- la Fase B esta bloqueada por el Defecto K'
);
console.log('PM26_P06H_FUENTE_JS_NO_TOCADO=PASS');

// --- Re-ejecuta de verdad validar.sh (bateria de 15 casos, preflight
// positivo/negativo, reaplicacion rechazada, reversion exacta) -- no
// se toma como afirmacion. ---
const validar = path.join(RAIZ_REPO, 'tests/pm26/p06h-f-aislado/validar.sh');
const r1 = spawnSync('bash', [validar], { cwd: RAIZ_REPO, encoding: 'utf8', timeout: 120000 });
if (r1.status !== 0) {
  console.error(r1.stdout);
  console.error(r1.stderr);
}
assert.equal(r1.status, 0, 'validar.sh (P06h) debe terminar con exito');
for (const marcador of [
  'PM26_P06H_F_AISLADO_FUERA_DE_SUPABASE_MIGRATIONS=PASS',
  'PM26_P06H_F_AISLADO_SCHEMA=PASS',
  'PM26_P06H_F_AISLADO_SEED=PASS',
  'PM26_P06H_F_AISLADO_PREFLIGHT_DETECTA_PRODUCCION=PASS',
  'PM26_P06H_F_AISLADO_SIMULACRO_PRODUCCION_SIN_RASTRO=PASS',
  'PM26_P06H_F_AISLADO_PREFLIGHT_DETECTA_FILAS_EXISTENTES=PASS',
  'PM26_P06H_F_AISLADO_MIGRACION_APLICADA=PASS',
  'PM26_P06H_F_AISLADO_BATERIA_15_CASOS=PASS',
  'PM26_P06H_F_AISLADO_REAPLICACION_RECHAZADA=PASS',
  'PM26_P06H_F_AISLADO_REVERSION_EXACTA=PASS',
  'PM26_P06H_F_AISLADO_REAPLICACION_LIMPIA_TRAS_REVERTIR=PASS',
  'PM26_P06H_F_AISLADO_VALIDACION_COMPLETA=PASS',
]) {
  assert.ok(r1.stdout.includes(marcador), `falta el marcador ${marcador} en la salida real de validar.sh`);
}
console.log('PM26_P06H_VALIDAR_SH_REPRODUCIDO=PASS');

// --- Los 15 casos de comportamiento.sql estan realmente presentes y
// cubren los positivos/negativos exigidos (rol, empresa, local, token). ---
const comportamiento = leer('tests/pm26/p06h-f-aislado/comportamiento.sql');
for (const caso of ['P1', 'P2', 'P3', 'N4', 'N5', 'N6', 'N7', 'N8', 'P9', 'N10', 'P11', 'N12', 'N13', 'N14', 'N15']) {
  assert.ok(new RegExp(`${caso}=PASS`).test(comportamiento), `falta el caso ${caso} en comportamiento.sql`);
}
assert.match(comportamiento, /set role authenticated;/, 'la bateria debe correr como authenticated, no como superusuario');
console.log('PM26_P06H_BATERIA_CUBRE_15_CASOS=PASS');

// --- revertir.sql no restaura INSERT/UPDATE/DELETE (QA nunca los tuvo). ---
const revertir = leer('tests/pm26/p06h-f-aislado/revertir.sql');
assert.ok(!/grant\s+insert/i.test(revertir), 'revertir.sql no debe conceder INSERT (QA nunca lo tuvo)');
assert.ok(!/grant\s+update/i.test(revertir), 'revertir.sql no debe conceder UPDATE (QA nunca lo tuvo)');
assert.ok(!/grant\s+delete/i.test(revertir), 'revertir.sql no debe conceder DELETE (QA nunca lo tuvo)');
assert.match(revertir, /revoke select on public\.prefiltros_candidatos from authenticated;/);
console.log('PM26_P06H_REVERSION_NO_RESTAURA_GRANTS_INEXISTENTES=PASS');

// --- Estructural: sin secretos ni identificadores internos. ---
{
  const archivosNuevos = [
    'tests/pm26/P06H_AVISO_F_DISENO_DESPLIEGUE.md',
    'tests/pm26/P06G_DEFECTO_L_SIN_AISLAMIENTO_PRODUCCION.md',
    'tests/pm26/p06h-contract.mjs',
    'supabase/qa-solo/pm26_p06h_aislamiento_prefiltros_candidatos.sql',
    'tests/pm26/p06h-f-aislado/schema.sql',
    'tests/pm26/p06h-f-aislado/seed.sql',
    'tests/pm26/p06h-f-aislado/comportamiento.sql',
    'tests/pm26/p06h-f-aislado/revertir.sql',
    'tests/pm26/p06h-f-aislado/validar.sh',
  ];
  const hallazgos = escanearArbol({ raiz: RAIZ_REPO, archivos: archivosNuevos, ubicacionesLegitimas: [] });
  const secretosReales = hallazgos.filter((h) => h.tipo === 'secreto_real');
  const identificadoresNoAdmitidos = hallazgos.filter(
    (h) => h.tipo === 'identificador_duplicado' && h.categoria !== 'falso_positivo'
  );
  assert.equal(secretosReales.length, 0, 'los archivos de P06h no deben contener ningún secreto real');
  assert.equal(
    identificadoresNoAdmitidos.length,
    0,
    'los archivos de P06h no deben contener ningún candidato a identificador interno real -- encontrado en: ' +
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
  console.log('PM26_P06H_SIN_SECRETOS_NI_IDENTIFICADORES=PASS');
}

console.log('PM26 P06h — aviso F diseño estricto (Opción B), validación aislada: contrato OK');
