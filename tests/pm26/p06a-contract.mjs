import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { escanearArbol } from '../../tools/seguridad/verificar-secretos-e-identificadores.mjs';

// PM26 P06a: contrato del DIAGNÓSTICO de solo lectura de los avisos
// F, G y H. No certifica ninguna corrección -- certifica que (1) el
// informe documenta con precisión que no se aplicó ningún cambio, (2)
// el hallazgo estructural sobre prefiltros_candidatos (referenciada en
// fuente.js con el cliente estándar, a diferencia de las otras dos
// tablas del aviso F) es reproducible por script, no solo afirmado en
// prosa, (3) el bloqueo de herramienta para el aviso G queda
// documentado, y (4) ni el informe ni este contrato contienen ningún
// secreto real.

const __filename = fileURLToPath(import.meta.url);
const RAIZ_REPO = path.resolve(path.dirname(__filename), '..', '..');
const RUTA_DOC = 'tests/pm26/P06A_DIAGNOSTICO_AVISOS_FGH.md';
const doc = fs.readFileSync(path.join(RAIZ_REPO, RUTA_DOC), 'utf8');

// --- Estado inequívoco: diagnóstico, no corrección ---
assert.match(doc, /\*\*Solo lectura\. No se aplic[óo] ning[úu]n cambio\.\*\*/);
assert.match(doc, /PM26_P06A_ESTADO=DIAGNOSTICO_SOLO_LECTURA_COMPLETO/);
assert.match(doc, /PM26_P06A_CAMBIOS_APLICADOS=NO/);
assert.match(doc, /PM26_P06A_AVISO_F_ELEVADO_A_POSIBLE_DEFECTO_FUNCIONAL=PREFILTROS_CANDIDATOS/);
assert.match(doc, /PM26_P06A_AVISO_G_BLOQUEADO_POR_HERRAMIENTA=SI/);
assert.match(doc, /PM26_P06A_AVISO_H_PROPUESTA_PRESENTADA_SIN_APLICAR=SI/);
assert.match(doc, /PM26_P06A_QA_ESCRITURA=NO/);
assert.match(doc, /PM26_P06A_PRODUCCION_TOCADA=NO/);
assert.match(doc, /PM26_P06A_TPV_TOCADO=NO/);
assert.match(doc, /PM26_P06A_MAIN_TOCADO=NO/);
console.log('PM26_P06A_ESTADO_DOC_VERIFICADO=PASS');

// --- Reproducción estructural: prefiltros_candidatos está referenciada
// en fuente.js con el cliente estándar (sujeto a RLS); las otras dos
// tablas del aviso F no tienen ninguna referencia. ---
const fuente = fs.readFileSync(path.join(RAIZ_REPO, 'fuente.js'), 'utf8');

for (const tabla of ['operaciones_procesadas', 'prefiltro_limites']) {
  assert.ok(!fuente.includes(tabla), `${tabla} no debe estar referenciada en fuente.js -- si lo está, el informe debe revisarse`);
}
assert.ok(fuente.includes('prefiltros_candidatos'), 'prefiltros_candidatos debe estar referenciada en fuente.js');

for (const fn of ['crearPrefiltro', 'listarPrefiltros', 'eliminarPrefiltro']) {
  const ocurrencias = fuente.split(fn).length - 1;
  assert.ok(ocurrencias > 1, `${fn} debe aparecer más de una vez en fuente.js (definición + al menos una referencia/uso real) -- encontrado ${ocurrencias}`);
}
assert.match(fuente, /supabase\.from\("prefiltros_candidatos"\)\.insert\(/);
assert.match(fuente, /supabase\.from\("prefiltros_candidatos"\)\.select\(/);
assert.match(fuente, /supabase\.from\("prefiltros_candidatos"\)\.delete\(/);
assert.match(fuente, /window\.getSupabaseClient = async function\(\) \{\s*\n?\s*return window\.__nubeCliente;/);
console.log('PM26_P06A_HALLAZGO_PREFILTROS_CANDIDATOS_REPRODUCIBLE=PASS');

// --- El informe documenta con precisión el bloqueo de herramienta para
// el aviso G (Auth), sin afirmar disponibilidad falsa. ---
assert.match(doc, /Ninguna herramienta de escritura de Supabase disponible en esta sesi[óo]n\s*\n?\s*expone la configuraci[óo]n del servicio Auth/i);
assert.match(doc, /requiere una acci[óo]n del usuario directamente en\s*\n?\s*el panel de Supabase/i);
console.log('PM26_P06A_AVISO_G_DOCUMENTADO=PASS');

// --- Las tres opciones de diseño para prefiltros_candidatos están
// presentes, sin que el informe elija ninguna. ---
const alternativas = [
  /1\. Pol[íi]tica `authenticated` amplia/,
  /2\. Pol[íi]tica acotada por rol/,
  /3\. Pol[íi]tica acotada a trav[ée]s de la propia RPC autoritativa/,
];
for (const patron of alternativas) {
  assert.match(doc, patron, 'falta una alternativa de diseño obligatoria para prefiltros_candidatos: ' + patron);
}
assert.match(doc, /No se decidi[óo] ninguna de las alternativas de dise[ñn]o/);
console.log('PM26_P06A_ALTERNATIVAS_DISENO_PRESENTES=PASS');

// --- La propuesta de H no se declara aplicada. ---
assert.match(doc, /No se aplic[óo] ninguna migraci[óo]n, pol[íi]tica RLS, ni cambio de Auth/i);
assert.match(doc, /No se elimin[óo] ning[úu]n [íi]ndice/i);
console.log('PM26_P06A_AVISO_H_NO_APLICADO=PASS');

// --- Estructural: ni el informe ni este contrato contienen ningún
// secreto real ni identificador interno fuera de una ubicación
// legítima. ---
{
  const archivosNuevosP06a = [RUTA_DOC, 'tests/pm26/p06a-contract.mjs'];
  const hallazgos = escanearArbol({ raiz: RAIZ_REPO, archivos: archivosNuevosP06a, ubicacionesLegitimas: [] });
  const secretosReales = hallazgos.filter((h) => h.tipo === 'secreto_real');
  const identificadoresNoAdmitidos = hallazgos.filter(
    (h) => h.tipo === 'identificador_duplicado' && h.categoria !== 'falso_positivo'
  );
  assert.equal(secretosReales.length, 0, 'los archivos nuevos de P06a no deben contener ningún secreto real');
  assert.equal(
    identificadoresNoAdmitidos.length,
    0,
    'los archivos nuevos de P06a no deben contener ningún candidato a identificador interno real -- encontrado en: ' +
      identificadoresNoAdmitidos.map((h) => `${h.archivo}:${h.linea} (${h.categoria})`).join(', ')
  );
  const reset = fs.readFileSync(path.join(RAIZ_REPO, 'reset-pruebas-preview.js'), 'utf8');
  const claveQA = reset.match(/var SUPABASE_QA_KEY = "([^"]+)";/)?.[1];
  const urlQAHost = reset.match(/var SUPABASE_QA_HOST = "([^"]+)";/)?.[1];
  assert.ok(claveQA && urlQAHost, 'no se pudo extraer la clave/URL QA reales desde el propio archivo para la comprobación');
  for (const rel of archivosNuevosP06a) {
    const contenido = fs.readFileSync(path.join(RAIZ_REPO, rel), 'utf8');
    assert.ok(!contenido.includes(claveQA), `${rel} no debe contener la clave pública QA copiada literalmente`);
    assert.ok(!contenido.includes(urlQAHost), `${rel} no debe contener el host QA copiado literalmente`);
  }
  console.log('PM26_P06A_SIN_SECRETOS_NI_IDENTIFICADORES_QA_COPIADOS=PASS');
}

console.log('PM26 P06a — diagnóstico de solo lectura de los avisos F, G y H: contrato OK');
