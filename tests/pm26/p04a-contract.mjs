import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { escanearArbol } from '../../tools/seguridad/verificar-secretos-e-identificadores.mjs';

// PM26 P04a: contrato de la INSPECCIÓN de solo lectura de los defectos
// B, C y D. No certifica ninguna eliminación ni modificación -- certifica
// que (1) nada de lo prohibido fue tocado (hashes idénticos a los
// registrados en el informe), (2) los hallazgos estructurales del
// informe (grafo de referencias del defecto B, ausencia del defecto C,
// separación universal/QA del defecto D) son reproducibles por script,
// no solo afirmados en prosa, y (3) ni el informe ni este contrato
// contienen ningún secreto o identificador QA copiado.

const __filename = fileURLToPath(import.meta.url);
const RAIZ_REPO = path.resolve(path.dirname(__filename), '..', '..');

function sha256(rutaAbs) {
  return crypto.createHash('sha256').update(fs.readFileSync(rutaAbs)).digest('hex');
}

// --- Nada de lo prohibido fue tocado: hashes idénticos a los
// registrados en el momento de escribir el informe. ---
const HASHES_INTOCABLES = {
  '_headers': '9500dbac4e2ca8d97e23b821e2ab7a013bf2e124df8526a016f557599b4040d1',
  'reset-pruebas-preview.js': '839cfe2ed0ee025a645f64f9dd00f305bb735bb7bee83a6a9326cd7048557ee9',
  'index.html': 'ff15e09aec63328c288aa08bdddf2189e4e1c7dd2ccbcfb27ac8fe655620cdcb',
  'edge-auth-patch.js': '89bf517e8952e132ec4f8d9c71ace21875f77ff1ae7d49de951e09b865305302',
  'pm11-compra-mobile-layout-v1.js': 'ac3a2f8a3818fd8a1628a19d55ba9d63240f9324f102c5673b39f04d4aaffc7c',
};
for (const [rel, esperado] of Object.entries(HASHES_INTOCABLES)) {
  const real = sha256(path.join(RAIZ_REPO, rel));
  assert.equal(real, esperado, `PM26 P04a no debe tocar ${rel} -- hash distinto al registrado en el informe`);
}
console.log('PM26_P04A_INTOCABLES_HASH_VERIFICADOS=PASS');

// --- Defecto B: los 10 archivos siguen presentes, con el mismo hash que
// documenta el informe, y NINGUNO está referenciado fuera del propio
// grupo (reproducción estructural del grafo de la sección 1.3). ---
const HASHES_10_HUERFANOS = {
  'chunk-43ACCR2P.js': '541492525590388f0d1010255260d179d3c63e5651a8575cc8109385a7b36f99',
  'chunk-CZ7CSFO4.js': '83030edcc76942df399df7e666987079e4a925134c7a7c9fb918032f5d7ca970',
  'chunk-SULEHD65.js': 'd4c325af2847bcb5bb6de23eedfdaf74b2d4a660c42c1da295d4004de3e0c191',
  'chunk-WNPC2SID.js': 'ee7fe09c7062aff5b6339d51d44a03b3eb698559bae0b3655bdaccb806a7b671',
  'html2canvas-5V7KZ5X4.js': '99d13a41ca9083cba8a9089c3a8c722c543952e1cf28505bbce70ac7a3df3998',
  'html2canvas-5V7KZ5X4-UL42RKXS.js': '44e74583ebe23a3994f05629d917a6507cd9356c3c810c0e5a7fa5bb97b925f9',
  'purify.es-TSVPIOEK.js': '79300a99e47aa14ecbae71c0c9bec903bacda265e885bffb58961bea61dea7bd',
  'purify.es-TSVPIOEK-6SSTY34W.js': '7f89a5122b839941bd3377405419b62da888f083290afa57cf0963e6732b166b',
  'index.es-SJCMKHSO.js': '2c67512914599fc38296eed9396b3b6705b72576a82ed0ef27cc6d6b0212d87a',
  'index.es-SJCMKHSO-5BY7EMAG.js': '1332ca8a31063f882fc7b9c327b4c146536f2f38379dacb14cd1c91864e77186',
};
const NOMBRES_10 = Object.keys(HASHES_10_HUERFANOS);
for (const [rel, esperado] of Object.entries(HASHES_10_HUERFANOS)) {
  const real = sha256(path.join(RAIZ_REPO, rel));
  assert.equal(real, esperado, `${rel} cambió de contenido respecto al informe -- P04a es de solo lectura`);
}
console.log('PM26_P04A_10_HUERFANOS_PRESENTES_Y_SIN_CAMBIOS=PASS');

{
  // Reproduce la búsqueda de referencias: para cada uno de los 10
  // nombres, ningún archivo rastreado FUERA del propio grupo de 10 (y
  // fuera de la documentación) puede contener el nombre exacto.
  const r = spawnSync('git', ['ls-files'], { cwd: RAIZ_REPO, encoding: 'utf8' });
  const archivosRastreados = r.stdout.trim().split('\n').filter(Boolean);
  const permitidosFueraDelGrupo = new Set([
    'source-recovery/README.md',
    'tests/pm26/P01_INVENTARIO_DIAGNOSTICO.md',
    'tests/pm26/P04A_INSPECCION_DEFECTOS_B_C_D.md',
    'tests/pm26/p04a-contract.mjs',
    'docs/plan-maestro/PM17_DIAGNOSTICO_PARCHES.md',
    'source-recovery/entrada-recuperada.js',
    'tools/seguridad/linea-base-aceptada.json',
  ]);
  const inesperados = [];
  for (const archivo of archivosRastreados) {
    if (NOMBRES_10.includes(path.basename(archivo))) continue; // uno de los propios 10
    if (permitidosFueraDelGrupo.has(archivo)) continue;
    let contenido;
    try {
      contenido = fs.readFileSync(path.join(RAIZ_REPO, archivo), 'utf8');
    } catch {
      continue; // binario u otro problema de lectura -- no relevante aquí
    }
    for (const nombre of NOMBRES_10) {
      if (contenido.includes(nombre)) inesperados.push(`${archivo} menciona ${nombre}`);
    }
  }
  assert.equal(inesperados.length, 0, `referencia inesperada fuera del grupo de 10 huérfanos: ${inesperados.join('; ')}`);
  console.log('PM26_P04A_DEFECTO_B_SIN_REFERENCIAS_EXTERNAS_INESPERADAS=PASS');
}

// --- Defecto B: dependencia real con el ledger de seguridad (4 archivos). ---
{
  const lb = JSON.parse(fs.readFileSync(path.join(RAIZ_REPO, 'tools/seguridad/linea-base-aceptada.json'), 'utf8'));
  const archivosEnLedger = new Set(lb.entradas.map((e) => e.archivo));
  const esperados = ['index.es-SJCMKHSO-5BY7EMAG.js', 'index.es-SJCMKHSO.js', 'purify.es-TSVPIOEK-6SSTY34W.js', 'purify.es-TSVPIOEK.js'];
  for (const esperado of esperados) {
    assert.ok(archivosEnLedger.has(esperado), `se esperaba que ${esperado} siguiera en la línea base aceptada`);
  }
  console.log('PM26_P04A_DEFECTO_B_DEPENDENCIA_LEDGER_CONFIRMADA=PASS');
}

// --- Defecto C: el archivo no existe, y la regla en _headers sigue
// presente sin efecto sobre ningún archivo real. ---
{
  const r = spawnSync('git', ['ls-files'], { cwd: RAIZ_REPO, encoding: 'utf8' });
  const rastreados = r.stdout.trim().split('\n');
  assert.ok(!rastreados.some((f) => path.basename(f) === 'seleccion-neutral-patch.js'), 'seleccion-neutral-patch.js no debería existir en el árbol rastreado');
  const headers = fs.readFileSync(path.join(RAIZ_REPO, '_headers'), 'utf8');
  assert.match(headers, /\/seleccion-neutral-patch\.js/, 'la regla residual debe seguir presente -- P04a no la elimina todavía');
  const fuente = fs.readFileSync(path.join(RAIZ_REPO, 'fuente.js'), 'utf8');
  assert.ok(!fuente.includes('seleccion-neutral-patch.js'), 'fuente.js (código realmente ejecutado) no debe referenciar el archivo retirado');
  console.log('PM26_P04A_DEFECTO_C_VERIFICADO=PASS');
}

// --- Defecto D: la frontera universal/QA-only es reproducible por
// script -- el loader del layout PM11 aparece antes del guard de host,
// y el guard de host aparece antes de cualquier mención a QA. ---
{
  const reset = fs.readFileSync(path.join(RAIZ_REPO, 'reset-pruebas-preview.js'), 'utf8');
  const posLoaderUniversal = reset.indexOf('pm11-compra-mobile-layout-v1.js');
  const posGuardHost = reset.indexOf('HOST_PREVIEW.test(window.location.hostname)');
  const posModoQA = reset.indexOf('__modoPruebasQA');
  assert.ok(posLoaderUniversal >= 0 && posGuardHost >= 0 && posModoQA >= 0, 'no se localizaron los tres puntos de referencia esperados');
  assert.ok(posLoaderUniversal < posGuardHost, 'el loader universal debe preceder al guard de host');
  assert.ok(posGuardHost < posModoQA, 'el guard de host debe preceder a cualquier activación de modo QA');
  console.log('PM26_P04A_DEFECTO_D_FRONTERA_UNIVERSAL_QA_VERIFICADA=PASS');
}

// --- Defecto D: los tests vivos identificados en el informe pasan de
// verdad hoy (código de salida real de proceso). ---
{
  const vivos = [
    'tests/pm12/p10-preview-smoke-contract.mjs',
    'tests/pm11-compra/p10-regresion-integral-contract.mjs',
  ];
  for (const contrato of vivos) {
    const r = spawnSync('node', [contrato], { cwd: RAIZ_REPO, encoding: 'utf8' });
    assert.equal(r.status, 0, `esperado código de salida 0 en ${contrato} (test vivo citado en el informe), obtenido ${r.status}`);
  }
  console.log('PM26_P04A_DEFECTO_D_TESTS_VIVOS_PASAN=PASS');
}

// --- Estructural: ni el informe ni este contrato contienen ningún
// secreto real ni identificador interno fuera de una ubicación
// legítima -- y, específicamente, NO contienen la URL ni la clave
// pública QA de reset-pruebas-preview.js (condición explícita del
// usuario para P04a). ---
{
  const archivosNuevosP04a = [
    'tests/pm26/P04A_INSPECCION_DEFECTOS_B_C_D.md',
    'tests/pm26/p04a-contract.mjs',
  ];
  const hallazgos = escanearArbol({ raiz: RAIZ_REPO, archivos: archivosNuevosP04a, ubicacionesLegitimas: [] });
  const secretosReales = hallazgos.filter((h) => h.tipo === 'secreto_real');
  const identificadoresNoAdmitidos = hallazgos.filter(
    (h) => h.tipo === 'identificador_duplicado' && h.categoria !== 'falso_positivo'
  );
  assert.equal(secretosReales.length, 0, 'los archivos nuevos de P04a no deben contener ningún secreto real');
  assert.equal(
    identificadoresNoAdmitidos.length,
    0,
    'los archivos nuevos de P04a no deben contener ningún candidato a identificador interno real -- encontrado en: ' +
      identificadoresNoAdmitidos.map((h) => `${h.archivo}:${h.linea} (${h.categoria})`).join(', ')
  );
  const reset = fs.readFileSync(path.join(RAIZ_REPO, 'reset-pruebas-preview.js'), 'utf8');
  const claveQA = reset.match(/var SUPABASE_QA_KEY = "([^"]+)";/)?.[1];
  const urlQAHost = reset.match(/var SUPABASE_QA_HOST = "([^"]+)";/)?.[1];
  assert.ok(claveQA && urlQAHost, 'no se pudo extraer la clave/URL QA reales desde el propio archivo para la comprobación');
  for (const rel of archivosNuevosP04a) {
    const contenido = fs.readFileSync(path.join(RAIZ_REPO, rel), 'utf8');
    assert.ok(!contenido.includes(claveQA), `${rel} no debe contener la clave pública QA copiada literalmente`);
    assert.ok(!contenido.includes(urlQAHost), `${rel} no debe contener el host QA copiado literalmente`);
  }
  console.log('PM26_P04A_SIN_SECRETOS_NI_IDENTIFICADORES_QA_COPIADOS=PASS');
}

// --- El informe documenta con precisión que es de solo lectura y que no
// se aplicó ningún cambio. ---
const doc = fs.readFileSync(path.join(RAIZ_REPO, 'tests/pm26/P04A_INSPECCION_DEFECTOS_B_C_D.md'), 'utf8');
assert.match(doc, /PM26_P04A_ESTADO=INSPECCION_SOLO_LECTURA_COMPLETA/);
assert.match(doc, /PM26_P04A_ARCHIVOS_ELIMINADOS=0/);
assert.match(doc, /PM26_P04A_INDEX_HTML_TOCADO=NO/);
assert.match(doc, /PM26_P04A_HEADERS_TOCADO=NO/);
assert.match(doc, /PM26_P04A_RESET_PRUEBAS_PREVIEW_TOCADO=NO/);
assert.match(doc, /PM26_P04A_IDENTIFICADORES_QA_COPIADOS_A_ARCHIVOS_NUEVOS=NO/);
assert.match(doc, /PM26_P04A_P04B_APLICADO=NO/);
for (const nombre of NOMBRES_10) {
  assert.ok(doc.includes(nombre), `falta documentar ${nombre} en el informe`);
}

console.log('PM26_P04A_DOC_VERIFICADO=PASS');
console.log('PM26 P04a — inspección de solo lectura de los defectos B, C y D: contrato OK');
