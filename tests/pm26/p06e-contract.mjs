import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { escanearArbol } from '../../tools/seguridad/verificar-secretos-e-identificadores.mjs';

// PM26 P06e: contrato del aislamiento de la migracion del aviso H
// fuera de supabase/migrations. No certifica ninguna aplicacion real
// en QA -- certifica que (1) la migracion vive solo en
// supabase/qa-solo, (2) la CLI real de Supabase, ejecutada contra el
// repositorio real, no la descubre (con un control positivo de que si
// descubre migraciones reales), (3) el preflight de catalogo existe y
// sus pruebas positivas/negativas se reproducen de verdad via
// validar.sh, y (4) ni el informe ni este contrato contienen ningun
// secreto real.

const __filename = fileURLToPath(import.meta.url);
const RAIZ_REPO = path.resolve(path.dirname(__filename), '..', '..');

function leer(rel) {
  return fs.readFileSync(path.join(RAIZ_REPO, rel), 'utf8');
}

const doc = leer('tests/pm26/P06E_AVISO_H_AISLAMIENTO_QA_SOLO.md');

assert.match(doc, /PM26_P06E_UBICACION=SUPABASE_QA_SOLO/);
assert.match(doc, /PM26_P06E_FUERA_DE_SUPABASE_MIGRATIONS=SI/);
assert.match(doc, /PM26_P06E_PRUEBA_CLI_REAL_EJECUTADA=SI/);
assert.match(doc, /PM26_P06E_CLI_NO_VE_LA_MIGRACION=SI/);
assert.match(doc, /PM26_P06E_CONTROL_POSITIVO_CLI_VE_MIGRACIONES_REALES=SI/);
assert.match(doc, /PM26_P06E_CICD_APLICA_A_PRODUCCION_HOY=NO/);
assert.match(doc, /PM26_P06E_PREFLIGHT_CATALOGO_CREADO=SI/);
assert.match(doc, /PM26_P06E_PREFLIGHT_POSITIVO_VALIDADO=SI/);
assert.match(doc, /PM26_P06E_PREFLIGHT_NEGATIVO_CATALOGO_DISTINTO_VALIDADO=SI/);
assert.match(doc, /PM26_P06E_PREFLIGHT_NEGATIVO_YA_APLICADO_VALIDADO=SI/);
assert.match(doc, /PM26_P06E_APLICADO_EN_QA=NO/);
console.log('PM26_P06E_ESTADO_DOC_VERIFICADO=PASS');

// --- Ubicacion real: la migracion vive SOLO en supabase/qa-solo, no
// en supabase/migrations. ---
const rutaQaSolo = 'supabase/qa-solo/pm26_p06b_rendimiento_indices_rls_initplan.sql';
const rutaMigraciones = 'supabase/migrations/pm26_p06b_rendimiento_indices_rls_initplan.sql';
assert.ok(fs.existsSync(path.join(RAIZ_REPO, rutaQaSolo)), `debe existir ${rutaQaSolo}`);
assert.ok(!fs.existsSync(path.join(RAIZ_REPO, rutaMigraciones)), `no debe existir ${rutaMigraciones}`);
const migraciones = fs.readdirSync(path.join(RAIZ_REPO, 'supabase/migrations'));
assert.ok(
  !migraciones.some((m) => m.includes('rendimiento_indices_rls_initplan')),
  'la migracion del aviso H no debe aparecer bajo ningun nombre en supabase/migrations'
);
// El archivo se endurecio despues en PM26 P06f (preflight embebido,
// lock_timeout, etc.) -- este informe queda como narrativa historica
// del momento en que se escribio, el hash vigente se verifica contra
// P06f, no reescribiendo este documento.
const hashReal = crypto.createHash('sha256').update(fs.readFileSync(path.join(RAIZ_REPO, rutaQaSolo))).digest('hex');
const docP06f = leer('tests/pm26/P06F_AVISO_H_ENDURECIDO.md');
assert.match(docP06f, new RegExp(hashReal), 'el hash SHA-256 documentado en P06f no coincide con el archivo real');
assert.match(doc, /relocaliz|endurec/i, 'el informe de P06e debe señalar la actualización posterior en P06f');
console.log('PM26_P06E_UBICACION_VERIFICADA=PASS');

// --- Preflight de catalogo: existe y se reutiliza en validar.sh. ---
const preflight = leer('tests/pm26/p06b-h-aislado/preflight-catalogo.sql');
assert.match(preflight, /PREFLIGHT_FALLO/);
assert.match(preflight, /PREFLIGHT_CATALOGO=PASS/);
console.log('PM26_P06E_PREFLIGHT_EXISTE=PASS');

// --- Re-ejecuta de verdad validar.sh (incluye ahora las pruebas de
// preflight positivas/negativas) y la prueba de exclusion con la CLI
// real -- no se toman como afirmaciones. ---
const validar = path.join(RAIZ_REPO, 'tests/pm26/p06b-h-aislado/validar.sh');
const r1 = spawnSync('bash', [validar], { cwd: RAIZ_REPO, encoding: 'utf8', timeout: 120000 });
if (r1.status !== 0) {
  console.error(r1.stdout);
  console.error(r1.stderr);
}
assert.equal(r1.status, 0, 'validar.sh (con las pruebas de preflight) debe terminar con exito');
for (const marcador of [
  'PM26_P06B_H_AISLADO_FUERA_DE_SUPABASE_MIGRATIONS=PASS',
  'PM26_P06B_H_AISLADO_PREFLIGHT_POSITIVO=PASS',
  'PM26_P06B_H_AISLADO_PREFLIGHT_NEGATIVO_CATALOGO_DISTINTO=PASS',
  'PM26_P06B_H_AISLADO_PREFLIGHT_ROLLBACK_SIMULACRO_LIMPIO=PASS',
  'PM26_P06B_H_AISLADO_PREFLIGHT_NEGATIVO_YA_APLICADO=PASS',
  'PM26_P06B_H_AISLADO_PREFLIGHT_PASA_TRAS_REVERTIR=PASS',
  'PM26_P06B_H_AISLADO_VALIDACION_COMPLETA=PASS',
]) {
  assert.ok(r1.stdout.includes(marcador), `falta el marcador ${marcador} en la salida real de validar.sh`);
}
console.log('PM26_P06E_VALIDAR_SH_REPRODUCIDO=PASS');

const exclusion = path.join(RAIZ_REPO, 'tests/pm26/p06b-h-aislado/prueba-exclusion-cli.sh');
const r2 = spawnSync('bash', [exclusion], { cwd: RAIZ_REPO, encoding: 'utf8', timeout: 120000 });
if (r2.status !== 0) {
  console.error(r2.stdout);
  console.error(r2.stderr);
}
assert.equal(r2.status, 0, 'prueba-exclusion-cli.sh debe terminar con exito');
for (const marcador of [
  'PM26_P06B_H_CLI_EXCLUSION_MIGRATION_LIST_NO_LA_VE=PASS',
  'PM26_P06B_H_CLI_EXCLUSION_CONTROL_POSITIVO_VE_MIGRACIONES_REALES=PASS',
  'PM26_P06B_H_CLI_EXCLUSION_COMPLETA=PASS',
]) {
  assert.ok(r2.stdout.includes(marcador), `falta el marcador ${marcador} en la salida real de prueba-exclusion-cli.sh`);
}
console.log('PM26_P06E_EXCLUSION_CLI_REPRODUCIDA=PASS');

// --- Ninguna cadena de CI/CD aplica migraciones a produccion hoy. ---
{
  const workflowsDir = path.join(RAIZ_REPO, '.github/workflows');
  const workflows = fs.readdirSync(workflowsDir).filter((f) => f.endsWith('.yml'));
  for (const wf of workflows) {
    const contenido = fs.readFileSync(path.join(workflowsDir, wf), 'utf8');
    assert.ok(
      !/supabase\s+db\s+push|supabase\s+migration\s+up/.test(contenido),
      `ningun workflow debe ejecutar supabase db push / migration up -- encontrado en ${wf}`
    );
  }
  console.log('PM26_P06E_NINGUN_WORKFLOW_APLICA_MIGRACIONES=PASS');
}

// --- Estructural: sin secretos ni identificadores internos. ---
{
  const archivosNuevos = [
    'tests/pm26/P06E_AVISO_H_AISLAMIENTO_QA_SOLO.md',
    'tests/pm26/p06e-contract.mjs',
    'supabase/qa-solo/pm26_p06b_rendimiento_indices_rls_initplan.sql',
    'tests/pm26/p06b-h-aislado/preflight-catalogo.sql',
    'tests/pm26/p06b-h-aislado/prueba-exclusion-cli.sh',
    'tests/pm26/p06b-h-aislado/validar.sh',
  ];
  const hallazgos = escanearArbol({ raiz: RAIZ_REPO, archivos: archivosNuevos, ubicacionesLegitimas: [] });
  const secretosReales = hallazgos.filter((h) => h.tipo === 'secreto_real');
  const identificadoresNoAdmitidos = hallazgos.filter(
    (h) => h.tipo === 'identificador_duplicado' && h.categoria !== 'falso_positivo'
  );
  assert.equal(secretosReales.length, 0, 'los archivos de P06e no deben contener ningún secreto real');
  assert.equal(
    identificadoresNoAdmitidos.length,
    0,
    'los archivos de P06e no deben contener ningún candidato a identificador interno real -- encontrado en: ' +
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
  console.log('PM26_P06E_SIN_SECRETOS_NI_IDENTIFICADORES=PASS');
}

console.log('PM26 P06e — aislamiento de la migración H fuera de la cadena de producción: contrato OK');
