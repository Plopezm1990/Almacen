import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { escanearArbol } from '../../tools/seguridad/verificar-secretos-e-identificadores.mjs';

// PM26 P03a: contrato del DIAGNÓSTICO experimental del nuevo detector de
// límite en source-recovery/. No certifica ninguna integración ni
// sustitución de recuperar_candidato.py/fuente-recuperado.js -- certifica
// que el detector se comporta como describe el informe (positivo real +
// 4 negativos, cada uno por su motivo exacto, vía código de salida real
// de un proceso, nunca por una cadena "PASS" en la salida), que el
// informe documenta con precisión que nada del pipeline existente fue
// tocado, y que ni el detector ni sus fixtures ni este contrato
// contienen ningún secreto o identificador interno real.

const __filename = fileURLToPath(import.meta.url);
const RAIZ_REPO = path.resolve(path.dirname(__filename), '..', '..');
const DIR_RECOVERY = path.join(RAIZ_REPO, 'source-recovery');

// --- El arnés de pruebas del detector se ejecuta como proceso real y se
// verifica su CÓDIGO DE SALIDA, nunca una búsqueda de texto "PASS". ---
{
  const r = spawnSync('python3', ['p03a_test_deteccion.py'], { cwd: DIR_RECOVERY, encoding: 'utf8' });
  assert.equal(r.status, 0, `esperado código de salida 0 del arnés de pruebas P03a, obtenido ${r.status}\n${r.stdout}\n${r.stderr}`);
  assert.match(r.stdout, /P03A_PRUEBAS=PASS \(2 positivas \+ 4 negativas/);
  // Los dos casos positivos y los cuatro negativos deben aparecer
  // explícitamente, cada negativo con su motivo exacto -- no basta con
  // el resumen final.
  assert.match(r.stdout, /POSITIVO fuente_js_real=PASS/);
  assert.match(r.stdout, /POSITIVO fixture_control=PASS/);
  assert.match(r.stdout, /NEGATIVO ancla_ausente=PASS \(fall[óo] como se esperaba: cero coincidencias/);
  assert.match(r.stdout, /NEGATIVO ancla_duplicada=PASS \(fall[óo] como se esperaba: 2 coincidencias/);
  assert.match(r.stdout, /NEGATIVO ancla_desplazada=PASS \(fall[óo] como se esperaba: ancla obligatoria ausente/);
  assert.match(r.stdout, /NEGATIVO orden_alterado=PASS \(fall[óo] como se esperaba: ancla fuera de orden/);
  console.log('PM26_P03A_ARNES_DETECTOR=PASS (código de salida real, 2 positivas + 4 negativas por su motivo exacto)');
}

// --- Negativa independiente: si el detector alguna vez "adivinara" en
// silencio en vez de fallar explícitamente, el proceso terminaría con
// código de salida distinto de cero solo si nosotros lo forzamos aquí --
// se comprueba invocando el CLI del detector directamente sobre cada
// fixture negativo y confirmando el código de salida 1 (nunca 0). ---
{
  const fixturesNegativos = [
    'negativo_ancla_ausente.js',
    'negativo_ancla_duplicada.js',
    'negativo_ancla_desplazada.js',
    'negativo_orden_alterado.js',
  ];
  for (const fixture of fixturesNegativos) {
    const ruta = path.join(DIR_RECOVERY, 'p03a_fixtures', fixture);
    const r = spawnSync('python3', ['p03a_deteccion_limite.py', ruta], { cwd: DIR_RECOVERY, encoding: 'utf8' });
    assert.equal(r.status, 1, `esperado código de salida 1 del CLI del detector sobre ${fixture}, obtenido ${r.status}`);
    assert.match(r.stderr, /DETECCION_LIMITE=FALLO/);
  }
  console.log('PM26_P03A_CLI_DETECTOR_FALLA_EN_NEGATIVOS=PASS (código de salida 1, nunca 0, sobre los 4 fixtures negativos)');
}

// --- Positiva independiente: el CLI del detector sobre el fuente.js real
// termina en código de salida 0. ---
{
  const r = spawnSync('python3', ['p03a_deteccion_limite.py'], { cwd: DIR_RECOVERY, encoding: 'utf8' });
  assert.equal(r.status, 0, `esperado código de salida 0 del CLI del detector sobre fuente.js real, obtenido ${r.status}\n${r.stdout}\n${r.stderr}`);
  assert.match(r.stdout, /DETECCION_LIMITE=OK/);
  console.log('PM26_P03A_CLI_DETECTOR_OK_FUENTE_REAL=PASS');
}

// --- Verificación ESTRUCTURAL (nunca por valor literal) de que el
// detector, su arnés de pruebas, sus fixtures y este contrato no
// contienen ningún secreto real ni ningún candidato a identificador
// interno fuera de una ubicación legítima. ---
{
  const archivosNuevosP03a = [
    'source-recovery/p03a_deteccion_limite.py',
    'source-recovery/p03a_test_deteccion.py',
    'source-recovery/P03A_DETECCION_LIMITE.md',
    'tests/pm26/p03a-contract.mjs',
    ...fs
      .readdirSync(path.join(DIR_RECOVERY, 'p03a_fixtures'))
      .map((f) => path.join('source-recovery/p03a_fixtures', f)),
  ];
  const hallazgos = escanearArbol({ raiz: RAIZ_REPO, archivos: archivosNuevosP03a, ubicacionesLegitimas: [] });
  const secretosReales = hallazgos.filter((h) => h.tipo === 'secreto_real');
  const identificadoresNoAdmitidos = hallazgos.filter(
    (h) => h.tipo === 'identificador_duplicado' && h.categoria !== 'falso_positivo'
  );
  assert.equal(secretosReales.length, 0, 'los archivos nuevos de P03a no deben contener ningún secreto real');
  assert.equal(
    identificadoresNoAdmitidos.length,
    0,
    'los archivos nuevos de P03a no deben contener ningún candidato a identificador interno real fuera de una ubicación legítima -- encontrado en: ' +
      identificadoresNoAdmitidos.map((h) => `${h.archivo}:${h.linea} (${h.categoria})`).join(', ')
  );
  console.log('PM26_P03A_SIN_SECRETOS_NI_IDENTIFICADORES_ESTRUCTURAL=PASS');
}

// --- El informe P03A_DETECCION_LIMITE.md documenta con precisión el
// diagnóstico y que nada del pipeline existente fue tocado. ---
const doc = fs.readFileSync(path.join(DIR_RECOVERY, 'P03A_DETECCION_LIMITE.md'), 'utf8');

assert.match(doc, /PM26_P03A_ESTADO=DIAGNOSTICO_VALIDADO_EXPERIMENTALMENTE/);
assert.match(doc, /PM26_P03A_DETECTOR_INTEGRADO=NO/);
assert.match(doc, /PM26_P03A_RECUPERAR_CANDIDATO_MODIFICADO=NO/);
assert.match(doc, /PM26_P03A_FUENTE_RECUPERADA_MODIFICADA=NO/);
assert.match(doc, /PM26_P03A_ENTRADA_RECUPERADA_MODIFICADA=NO/);
assert.match(doc, /PM26_P03A_REBUILD_CURRENT_MODIFICADO=NO/);
assert.match(doc, /PM26_P03A_DIST_FUENTE_MODIFICADO=NO/);
assert.match(doc, /PM26_P03A_WORKFLOW_PERMANENTE_CREADO=NO/);
assert.match(doc, /PM26_P03A_FUENTE_JS_TOCADO=NO/);
assert.match(doc, /PM26_P03A_MAIN_TOCADO=NO/);

// La comparación entre los tres bundles históricos está documentada.
assert.match(doc, /## 1\.\s+Comparaci[óo]n entre los tres bundles hist[óo]ricos/i);
assert.match(doc, /7f792925d6a3d27334ee0e7335ba635b4ed79b6b/);
assert.match(doc, /767a2c3163f924b7599338785fe4331f78f0e1ac/);

// La evidencia de la firma compuesta (comentario + 2 líneas de bootstrap)
// y la distinción entre la aparición espuria y la real están documentadas.
assert.match(doc, /fuente-recuperado\.js/);
assert.match(doc, /aparici[óo]n\s+\(espuria\)/i);
assert.match(doc, /aparici[óo]n\s+\(real\)/i);
assert.match(doc, /exactamente\s+1\s+coincidencia/i);

// El detector falla explícitamente ante cero, varias, ausencia u orden
// alterado -- nunca elige en silencio.
assert.match(doc, /falla\s+expl[íi]citamente/i);
assert.match(doc, /cero\s+coincidencias/i);
assert.match(doc, /m[áa]s\s+de\s+una\s+coincidencia/i);
assert.match(doc, /fuera\s+del\s+orden\s+esperado/i);

// Riesgos y casos ambiguos están presentes, honestamente, no descartados.
assert.match(doc, /## 6\.\s+Riesgos y casos ambiguos/i);

// El diseño de transición separa expresamente recuperación inicial
// (una sola vez) de pipeline permanente, y advierte contra la validación
// circular.
assert.match(doc, /## 8\.\s+Dise[ñn]o de transici[óo]n/i);
assert.match(doc, /\(a\)\s+Recuperaci[óo]n inicial \(una sola vez\)/i);
assert.match(doc, /\(b\)\s+Pipeline permanente/i);
assert.match(doc, /validaci[óo]n\s+circular/i);
assert.match(doc, /nunca\*?\*?\s+vuelve\s+a\s+extraer\s+el\s+cuerpo\s+desde\s+`?fuente\.js`?/i);

// El grafo de entrada actual confirma que no se reintroduce lo retirado
// en PM17.
assert.match(doc, /seleccion-neutral-patch\.js/);
assert.match(doc, /0\s+coincidencias/i);

// PM25 P02 sigue arrastrado; los defectos B-H siguen pendientes.
assert.match(doc, /PM25 P02 contin[úu]a \*?\*?PARCIAL\/BLOQUEADO\*?\*?/i);
assert.match(doc, /defectos\s+B-H[\s\S]{1,40}permanecen\s+pendientes/i);

console.log('PM26_P03A_DOC_VERIFICADO=PASS');
console.log('PM26 P03a — diagnóstico experimental del detector de límite: contrato OK (no certifica ninguna integración)');
