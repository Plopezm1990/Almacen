import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { escanearArbol } from '../../tools/seguridad/verificar-secretos-e-identificadores.mjs';

// PM26 P05a: contrato del DIAGNÓSTICO de solo lectura del defecto E
// (publicación a producción acoplada a main). No certifica ninguna
// corrección -- certifica que (1) el informe documenta con precisión que
// no se aplicó ningún cambio de configuración de Netlify, (2) las tres
// opciones técnicas están presentas con sus riesgos y reversión, (3) el
// hecho nuevo verificado en vivo (SSO ya exigido en contextos
// no-producción) queda registrado, y (4) ni el informe ni este contrato
// contienen ningún secreto real.

const __filename = fileURLToPath(import.meta.url);
const RAIZ_REPO = path.resolve(path.dirname(__filename), '..', '..');

const RUTA_DOC = 'tests/pm26/P05A_DIAGNOSTICO_DEFECTO_E.md';
const doc = fs.readFileSync(path.join(RAIZ_REPO, RUTA_DOC), 'utf8');

// --- Estado inequívoco: diagnóstico, no corrección ---
assert.match(doc, /\*\*Solo lectura\. No se aplic[óo] ning[úu]n cambio\.\*\*/);
assert.match(doc, /PM26_P05A_ESTADO=DIAGNOSTICO_SOLO_LECTURA_COMPLETO/);
assert.match(doc, /PM26_P05A_CAMBIOS_APLICADOS=NO/);
assert.match(doc, /PM26_P05A_NETLIFY_MODIFICADO=NO/);
assert.match(doc, /PM26_P05A_NETLIFY_TOML_CREADO=NO/);
assert.match(doc, /PM26_P05A_MAIN_TOCADO=NO/);
assert.match(doc, /PM26_P05A_SUPABASE_QA_PRODUCCION_TOCADO=NO/);
assert.match(doc, /PM26_P05A_TPV_TOCADO=NO/);
assert.match(doc, /PM26_P05A_OPCION_ELEGIDA=NINGUNA_PENDIENTE_DE_DECISION_DEL_USUARIO/);
console.log('PM26_P05A_ESTADO_DOC_VERIFICADO=PASS');

// --- Las tres opciones técnicas están presentes, con riesgos y
// reversión donde corresponde, y ninguna se declara aplicada. ---
const opciones = [
  /### Opci[óo]n 1 — Rama de contexto de producci[óo]n dedicada/,
  /### Opci[óo]n 2 — Aprobaci[óo]n manual de despliegue sobre `main`/,
  /### Opci[óo]n 3 — Combinaci[óo]n/,
];
for (const patron of opciones) {
  assert.match(doc, patron, 'falta una opción técnica obligatoria en el informe: ' + patron);
}
assert.match(doc, /No confirmado\s*\n?\s*en esta ronda/, 'la Opción 2 debe declarar explícitamente que su disponibilidad no está confirmada');
assert.match(doc, /\*\*Reversi[óo]n\*\*: trivial/i);
console.log('PM26_P05A_TRES_OPCIONES_PRESENTES=PASS');

// --- El hecho nuevo verificado en vivo (SSO ya exigido en contextos
// no-producción, no en producción) queda documentado con precisión. ---
assert.match(doc, /requiresSSOTeamLogin`?:?\s*`?true`?/i);
assert.match(doc, /non_production/);
assert.match(doc, /el contexto `production` \*?\*?no\*?\*? tiene esa\s*\n?\s*exigencia/i);
assert.match(doc, /Hecho nuevo respecto a P01/i);
console.log('PM26_P05A_HECHO_SSO_DOCUMENTADO=PASS');

// --- No se afirma haber verificado backend real donde solo hubo lectura
// de plataforma: el documento no debe declarar que la Opción 2 está
// confirmada disponible. ---
assert.doesNotMatch(doc, /Opci[óo]n 2[\s\S]{0,200}confirmada disponible/i);

// --- El informe referencia el flujo real de publicación paso a paso,
// no solo en prosa suelta. ---
assert.match(doc, /## 3\. Flujo de publicaci[óo]n actual, paso a paso/);
assert.match(doc, /Netlify detecta el push/i);
assert.match(doc, /sin ning[úu]n paso de aprobaci[óo]n\s*\n?\s*manual/i);
console.log('PM26_P05A_FLUJO_DOCUMENTADO=PASS');

// --- No existe netlify.toml en el repo (reconfirmado estructuralmente,
// no solo afirmado en el informe). ---
assert.ok(!fs.existsSync(path.join(RAIZ_REPO, 'netlify.toml')), 'PM26 P05a no debe crear netlify.toml');
console.log('PM26_P05A_SIN_NETLIFY_TOML=PASS');

// --- Estructural: ni el informe ni este contrato contienen ningún
// secreto real ni identificador interno fuera de una ubicación
// legítima. ---
{
  const archivosNuevosP05a = [RUTA_DOC, 'tests/pm26/p05a-contract.mjs'];
  const hallazgos = escanearArbol({ raiz: RAIZ_REPO, archivos: archivosNuevosP05a, ubicacionesLegitimas: [] });
  const secretosReales = hallazgos.filter((h) => h.tipo === 'secreto_real');
  const identificadoresNoAdmitidos = hallazgos.filter(
    (h) => h.tipo === 'identificador_duplicado' && h.categoria !== 'falso_positivo'
  );
  assert.equal(secretosReales.length, 0, 'los archivos nuevos de P05a no deben contener ningún secreto real');
  assert.equal(
    identificadoresNoAdmitidos.length,
    0,
    'los archivos nuevos de P05a no deben contener ningún candidato a identificador interno real -- encontrado en: ' +
      identificadoresNoAdmitidos.map((h) => `${h.archivo}:${h.linea} (${h.categoria})`).join(', ')
  );
  const reset = fs.readFileSync(path.join(RAIZ_REPO, 'reset-pruebas-preview.js'), 'utf8');
  const claveQA = reset.match(/var SUPABASE_QA_KEY = "([^"]+)";/)?.[1];
  const urlQAHost = reset.match(/var SUPABASE_QA_HOST = "([^"]+)";/)?.[1];
  assert.ok(claveQA && urlQAHost, 'no se pudo extraer la clave/URL QA reales desde el propio archivo para la comprobación');
  for (const rel of archivosNuevosP05a) {
    const contenido = fs.readFileSync(path.join(RAIZ_REPO, rel), 'utf8');
    assert.ok(!contenido.includes(claveQA), `${rel} no debe contener la clave pública QA copiada literalmente`);
    assert.ok(!contenido.includes(urlQAHost), `${rel} no debe contener el host QA copiado literalmente`);
  }
  console.log('PM26_P05A_SIN_SECRETOS_NI_IDENTIFICADORES_QA_COPIADOS=PASS');
}

console.log('PM26 P05a — diagnóstico de solo lectura del defecto E: contrato OK');
