import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { escanearArbol } from '../../tools/seguridad/verificar-secretos-e-identificadores.mjs';

// PM26 P05c: contrato del cierre del defecto E. No certifica que esta
// sesión haya cambiado nada en Netlify -- certifica que (1) el informe
// documenta con precisión que el cambio lo hizo la usuaria manualmente,
// (2) release y main siguen alineadas (ninguna promoción de commit se
// coló aquí), (3) el informe reconoce con honestidad el matiz sobre el
// metadato "branch" del deploy en vez de sobre-afirmar, y (4) ni el
// informe ni este contrato contienen ningún secreto real.

const __filename = fileURLToPath(import.meta.url);
const RAIZ_REPO = path.resolve(path.dirname(__filename), '..', '..');

function git(args) {
  const r = spawnSync('git', args, { cwd: RAIZ_REPO, encoding: 'utf8' });
  assert.equal(r.status, 0, `git ${args.join(' ')} falló: ${r.stderr}`);
  return r.stdout.trim();
}

function leer(rel) {
  return fs.readFileSync(path.join(RAIZ_REPO, rel), 'utf8');
}

// --- main y release siguen alineadas -- P05c es un cierre documental
// de una acción manual externa, no una promoción de commit. ---
git(['fetch', 'origin', 'main', 'release', '--quiet']);
const shaMain = git(['rev-parse', 'origin/main']);
const shaRelease = git(['rev-parse', 'origin/release']);
assert.equal(shaRelease, shaMain, 'origin/release debe seguir apuntando exactamente al mismo commit que origin/main');
assert.equal(shaMain, '93a570badba1c5375febfbddc1dffdbcef003dcd', 'origin/main debe seguir congelada en el commit conocido');
console.log('PM26_P05C_MAIN_RELEASE_SIGUEN_ALINEADAS=PASS');

const RUTA_DOC = 'tests/pm26/P05C_DEFECTO_E_CERRADO.md';
const doc = leer(RUTA_DOC);

for (const marcador of [
  'PM26_P05C_ESTADO=CERRADO',
  'PM26_P05C_CAMBIO_NETLIFY_REALIZADO_POR=USUARIA_MANUALMENTE',
  'PM26_P05C_CAMBIO_APLICADO_POR_HERRAMIENTA_DE_SESION=NO',
  'PM26_P05C_PRODUCTION_BRANCH_CONFIRMADA_EN_PANEL=RELEASE',
  'PM26_P05C_DEPLOY_ACTUAL_ESTADO=READY',
  'PM26_P05C_DEPLOY_ACTUAL_COMMIT_REF=93a570badba1c5375febfbddc1dffdbcef003dcd',
  'PM26_P05C_FUNCTIONS_DESPLEGADAS=NO',
  'PM26_P05C_EDGE_FUNCTIONS_DESPLEGADAS=NO',
  'PM26_P05C_OTROS_CAMPOS_NETLIFY_TOCADOS=NO',
  'PM26_P05C_MAIN_RELEASE_TOCADOS_POR_SESION=NO',
  'PM26_P05C_SUPABASE_QA_PRODUCCION_TPV_TOCADOS=NO',
  'PM26_P05C_DEFECTO_E_RESUELTO=SI',
]) {
  assert.ok(doc.includes(marcador), `falta el marcador ${marcador} en el informe`);
}
console.log('PM26_P05C_ESTADO_DOC_VERIFICADO=PASS');

// --- El informe atribuye el cambio a la usuaria, no a una herramienta
// de esta sesión, y reconoce el matiz del metadato "branch" en vez de
// sobre-afirmar una verificación que las herramientas no dan directa. ---
assert.match(doc, /la usuaria\s+realizó manualmente/i);
assert.match(doc, /[Nn]inguna herramienta de esta\s+sesión tocó esa configuración/);
assert.match(doc, /conserva internamente `"branch": "main"` como metadato\s+histórico/);
assert.match(doc, /No\s+se fuerza esa divergencia aquí/);
console.log('PM26_P05C_ATRIBUCION_Y_MATIZ_DOCUMENTADOS=PASS');

// --- Sigue referenciando P05b como el punto de partida (parcial ->
// cerrado), sin reescribir su narrativa histórica. ---
assert.match(doc, /P05B_PREPARACION_RAMA_RELEASE\.md/);
const docP05b = leer('tests/pm26/P05B_PREPARACION_RAMA_RELEASE.md');
assert.match(docP05b, /PM26_P05B_ESTADO=PARCIAL_BLOQUEADO/, 'P05b debe conservar intacta su narrativa histórica de parcial/bloqueado');
console.log('PM26_P05C_REFERENCIA_HISTORICA_INTACTA=PASS');

// --- Estructural: sin secretos ni identificadores internos. ---
{
  const archivosNuevos = [RUTA_DOC, 'tests/pm26/p05c-contract.mjs'];
  const hallazgos = escanearArbol({ raiz: RAIZ_REPO, archivos: archivosNuevos, ubicacionesLegitimas: [] });
  const secretosReales = hallazgos.filter((h) => h.tipo === 'secreto_real');
  const identificadoresNoAdmitidos = hallazgos.filter(
    (h) => h.tipo === 'identificador_duplicado' && h.categoria !== 'falso_positivo'
  );
  assert.equal(secretosReales.length, 0, 'los archivos de P05c no deben contener ningún secreto real');
  assert.equal(
    identificadoresNoAdmitidos.length,
    0,
    'los archivos de P05c no deben contener ningún candidato a identificador interno real -- encontrado en: ' +
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
  console.log('PM26_P05C_SIN_SECRETOS_NI_IDENTIFICADORES=PASS');
}

console.log('PM26 P05c — defecto E cerrado (producción publica desde release): contrato OK');
