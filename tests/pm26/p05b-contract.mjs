import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { escanearArbol } from '../../tools/seguridad/verificar-secretos-e-identificadores.mjs';

// PM26 P05b: contrato de la PREPARACIÓN parcial del defecto E. No
// certifica que el defecto E esté resuelto -- certifica que (1) la rama
// `release` existe en el remoto y apunta exactamente al mismo commit que
// `origin/main`, (2) el informe documenta con precisión que el paquete
// queda PARCIAL/BLOQUEADO y por qué (límite real de herramienta, no una
// elección), (3) no se aplicó ningún cambio de configuración de Netlify,
// y (4) ni el informe ni este contrato contienen ningún secreto real.

const __filename = fileURLToPath(import.meta.url);
const RAIZ_REPO = path.resolve(path.dirname(__filename), '..', '..');

function git(args) {
  const r = spawnSync('git', args, { cwd: RAIZ_REPO, encoding: 'utf8' });
  assert.equal(r.status, 0, `git ${args.join(' ')} falló: ${r.stderr}`);
  return r.stdout.trim();
}

// --- La rama release existe en el remoto y apunta exactamente al mismo
// commit que origin/main (ni un commit de más, ni de menos). ---
git(['fetch', 'origin', 'main', 'release', '--quiet']);
const shaMain = git(['rev-parse', 'origin/main']);
const shaRelease = git(['rev-parse', 'origin/release']);
assert.equal(shaRelease, shaMain, 'origin/release debe apuntar exactamente al mismo commit que origin/main -- no debe llevar ningún commit adicional ni ir por detrás');
console.log('PM26_P05B_RAMA_RELEASE_ALINEADA_CON_MAIN=PASS');

const RUTA_DOC = 'tests/pm26/P05B_PREPARACION_RAMA_RELEASE.md';
const doc = fs.readFileSync(path.join(RAIZ_REPO, RUTA_DOC), 'utf8');

// --- Estado inequívoco: parcial/bloqueado, no resuelto ---
assert.match(doc, /\*\*PARCIAL\/BLOQUEADO\.\*\*/);
assert.match(doc, /PM26_P05B_ESTADO=PARCIAL_BLOQUEADO/);
assert.match(doc, /PM26_P05B_RAMA_RELEASE_CREADA=SI/);
assert.match(doc, /PM26_P05B_RAMA_RELEASE_APUNTA_A_MAIN_CONGELADO=SI/);
assert.match(doc, /PM26_P05B_NETLIFY_CONTEXTO_PRODUCCION_CAMBIADO=NO/);
assert.match(doc, /PM26_P05B_MOTIVO_BLOQUEO=HERRAMIENTA_DE_ESCRITURA_NETLIFY_SIN_OPERACION_PARA_RAMA_DE_PRODUCCION/);
assert.match(doc, /PM26_P05B_ACCION_PENDIENTE=USUARIO_DEBE_CAMBIAR_PRODUCTION_BRANCH_EN_PANEL_NETLIFY/);
assert.match(doc, /PM26_P05B_MAIN_TOCADO=NO/);
assert.match(doc, /PM26_P05B_SUPABASE_QA_PRODUCCION_TOCADO=NO/);
assert.match(doc, /PM26_P05B_TPV_TOCADO=NO/);
assert.match(doc, /PM26_P05B_DEFECTO_E_RESUELTO=NO/);
console.log('PM26_P05B_ESTADO_DOC_VERIFICADO=PASS');

// --- El motivo del bloqueo queda documentado como límite real de
// herramienta (con la lista exacta de operaciones disponibles), no como
// una elección o una duda de alcance. ---
assert.match(doc, /netlify-project-services-updater/);
assert.match(doc, /update-visitor-access-controls.*update-forms.*manage-form-submissions.*update-project-name.*manage-env-vars.*create-new-project/s);
assert.match(doc, /Ninguna de ellas permite cambiar la rama de\s*\n?\s*contexto de producci[óo]n/i);
assert.match(doc, /No se intent[óo] ning[úu]n atajo para sortear esta limitaci[óo]n/i);
console.log('PM26_P05B_MOTIVO_BLOQUEO_DOCUMENTADO=PASS');

// --- Las instrucciones exactas para el usuario están presentes. ---
assert.match(doc, /Site settings → Build & deploy → Deploy contexts/);
assert.match(doc, /Production branch.*de `main` a `release`/);
console.log('PM26_P05B_INSTRUCCIONES_USUARIO_PRESENTES=PASS');

// --- No se declara ningún cambio de Netlify aplicado. ---
assert.doesNotMatch(doc, /se cambi[óo] la configuraci[óo]n de Netlify/i);
assert.match(doc, /No se cambi[óo] ninguna configuraci[óo]n de Netlify/i);

// --- Estructural: ni el informe ni este contrato contienen ningún
// secreto real ni identificador interno fuera de una ubicación
// legítima. ---
{
  const archivosNuevosP05b = [RUTA_DOC, 'tests/pm26/p05b-contract.mjs'];
  const hallazgos = escanearArbol({ raiz: RAIZ_REPO, archivos: archivosNuevosP05b, ubicacionesLegitimas: [] });
  const secretosReales = hallazgos.filter((h) => h.tipo === 'secreto_real');
  const identificadoresNoAdmitidos = hallazgos.filter(
    (h) => h.tipo === 'identificador_duplicado' && h.categoria !== 'falso_positivo'
  );
  assert.equal(secretosReales.length, 0, 'los archivos nuevos de P05b no deben contener ningún secreto real');
  assert.equal(
    identificadoresNoAdmitidos.length,
    0,
    'los archivos nuevos de P05b no deben contener ningún candidato a identificador interno real -- encontrado en: ' +
      identificadoresNoAdmitidos.map((h) => `${h.archivo}:${h.linea} (${h.categoria})`).join(', ')
  );
  const reset = fs.readFileSync(path.join(RAIZ_REPO, 'reset-pruebas-preview.js'), 'utf8');
  const claveQA = reset.match(/var SUPABASE_QA_KEY = "([^"]+)";/)?.[1];
  const urlQAHost = reset.match(/var SUPABASE_QA_HOST = "([^"]+)";/)?.[1];
  assert.ok(claveQA && urlQAHost, 'no se pudo extraer la clave/URL QA reales desde el propio archivo para la comprobación');
  for (const rel of archivosNuevosP05b) {
    const contenido = fs.readFileSync(path.join(RAIZ_REPO, rel), 'utf8');
    assert.ok(!contenido.includes(claveQA), `${rel} no debe contener la clave pública QA copiada literalmente`);
    assert.ok(!contenido.includes(urlQAHost), `${rel} no debe contener el host QA copiado literalmente`);
  }
  console.log('PM26_P05B_SIN_SECRETOS_NI_IDENTIFICADORES_QA_COPIADOS=PASS');
}

console.log('PM26 P05b — preparación parcial/bloqueada de la rama release: contrato OK');
