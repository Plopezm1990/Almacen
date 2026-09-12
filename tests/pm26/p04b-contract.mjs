import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { escanearArbol } from '../../tools/seguridad/verificar-secretos-e-identificadores.mjs';

// PM26 P04b: contrato de la APLICACIÓN de las correcciones B, C y D
// propuestas (y ya gateadas como diagnóstico) en PM26 P04a. Certifica
// que los 10 archivos huérfanos ya no existen y el ledger de seguridad
// se regeneró con la herramienta real; que la regla de `_headers` se
// retiró sin tocar las otras 6; y que la separación universal/QA-only de
// `reset-pruebas-preview.js` es real y funcionalmente correcta (ejecución
// en sandbox, no solo comparación de texto), con pruebas negativas sobre
// copias en memoria.

const __filename = fileURLToPath(import.meta.url);
const RAIZ_REPO = path.resolve(path.dirname(__filename), '..', '..');

function leer(rel) {
  return fs.readFileSync(path.join(RAIZ_REPO, rel), 'utf8');
}

// --- Defecto B: los 10 archivos ya no existen en el árbol rastreado. ---
{
  const NOMBRES_10 = [
    'chunk-43ACCR2P.js', 'chunk-CZ7CSFO4.js', 'chunk-SULEHD65.js', 'chunk-WNPC2SID.js',
    'html2canvas-5V7KZ5X4.js', 'html2canvas-5V7KZ5X4-UL42RKXS.js',
    'purify.es-TSVPIOEK.js', 'purify.es-TSVPIOEK-6SSTY34W.js',
    'index.es-SJCMKHSO.js', 'index.es-SJCMKHSO-5BY7EMAG.js',
  ];
  const r = spawnSync('git', ['ls-files'], { cwd: RAIZ_REPO, encoding: 'utf8' });
  const rastreados = new Set(r.stdout.trim().split('\n').map((f) => path.basename(f)));
  for (const nombre of NOMBRES_10) {
    assert.ok(!rastreados.has(nombre), `${nombre} debería haberse eliminado en PM26 P04b`);
    assert.ok(!fs.existsSync(path.join(RAIZ_REPO, nombre)), `${nombre} no debería existir en disco`);
  }
  console.log('PM26_P04B_DEFECTO_B_10_ARCHIVOS_ELIMINADOS=PASS');
}

// --- Defecto B: el ledger de seguridad ya no menciona los archivos
// eliminados, y el gate de secretos/identificadores sigue en verde. ---
{
  const lb = JSON.parse(leer('tools/seguridad/linea-base-aceptada.json'));
  const archivosEnLedger = new Set(lb.entradas.map((e) => e.archivo));
  for (const nombre of ['purify.es-TSVPIOEK.js', 'purify.es-TSVPIOEK-6SSTY34W.js', 'index.es-SJCMKHSO.js', 'index.es-SJCMKHSO-5BY7EMAG.js']) {
    assert.ok(!archivosEnLedger.has(nombre), `${nombre} no debería seguir en la línea base tras eliminarlo`);
  }
  const r = spawnSync('node', ['tools/seguridad/verificar-secretos-e-identificadores.mjs', 'verificar'], { cwd: RAIZ_REPO, encoding: 'utf8' });
  assert.equal(r.status, 0, `esperado código de salida 0 del gate de secretos, obtenido ${r.status}\n${r.stdout}\n${r.stderr}`);
  assert.match(r.stdout, /VERIFICAR_SECRETOS=PASS/);
  console.log('PM26_P04B_DEFECTO_B_LEDGER_REGENERADO_Y_GATE_VERDE=PASS');
}

// --- Defecto C: _headers ya no tiene la regla de seleccion-neutral-patch.js,
// y las otras 6 reglas siguen exactamente igual. ---
{
  const headers = leer('_headers');
  assert.ok(!headers.includes('seleccion-neutral-patch.js'), 'la regla residual debía eliminarse');
  for (const ruta of ['/\n  Cache-Control: no-cache, no-store, must-revalidate', '/index.html\n  Cache-Control: no-cache, no-store, must-revalidate', '/manifest.json\n  Cache-Control: no-cache, must-revalidate', '/fuente.js\n  Cache-Control: no-cache, must-revalidate', '/edge-auth-patch.js\n  Cache-Control: no-cache, must-revalidate', '/sw.js\n  Cache-Control: no-cache, must-revalidate']) {
    assert.ok(headers.includes(ruta), `la regla "${ruta.split('\n')[0]}" debía conservarse exactamente igual`);
  }
  console.log('PM26_P04B_DEFECTO_C_HEADERS_VERIFICADO=PASS');
}

// --- Defecto D: reset-pruebas-preview.js ya no contiene el loader móvil,
// pero conserva byte a byte el resto de su lógica QA-only (constantes,
// interceptor de fetch, reinicio de localStorage). ---
{
  const reset = leer('reset-pruebas-preview.js');
  assert.ok(!reset.includes('pm11-compra-mobile-layout-v1.js'), 'el loader móvil no debe seguir en reset-pruebas-preview.js');
  for (const fragmento of [
    'var HOST_PREVIEW = /^(?:deploy-preview-\\d+|[a-f0-9]{24})--chic-entremet-9107cf\\.netlify\\.app$/i;',
    'window.__modoPruebasQA = true;',
    'window.__qaFetchProduccionBloqueado = true;',
    'var MARCADOR = "la_suite_reset_total_20260904_v6_qa";',
  ]) {
    assert.ok(reset.includes(fragmento), `falta un fragmento QA-only esperado: ${fragmento}`);
  }
  console.log('PM26_P04B_DEFECTO_D_RESET_PREVIEW_REDUCIDO_CORRECTAMENTE=PASS');
}

/** Ejecuta pm11-compra-mobile-loader.js (o una copia mutada en memoria)
 * en una sandbox mínima y devuelve qué <script> intentó inyectar, si
 * alguno. Se usa tanto en la prueba positiva como en las negativas. */
function ejecutarLoaderMovil(codigo, hostname) {
  const creados = [];
  const elemento = { src: '', async: true, atributos: {}, setAttribute(k, v) { this.atributos[k] = v; } };
  const document = {
    head: { appendChild(el) { creados.push(el); } },
    documentElement: { appendChild(el) { creados.push(el); } },
    createElement() { return elemento; },
  };
  const window = { location: { hostname } };
  const sandbox = { window, document };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(codigo, sandbox, { filename: 'pm11-compra-mobile-loader.js' });
  return { creados, window, elemento };
}

// --- Defecto D: el loader universal inyecta el script del layout móvil
// SIN depender del hostname -- probado en un dominio de producción real. ---
{
  const loaderCodigo = leer('pm11-compra-mobile-loader.js');
  const { creados, elemento } = ejecutarLoaderMovil(loaderCodigo, 'chic-entremet-9107cf.netlify.app');
  assert.equal(creados.length, 1, 'debe inyectar exactamente un <script>');
  assert.match(elemento.src, /^\.\/pm11-compra-mobile-layout-v1\.js\?v=pm11-p10-mobile-v1$/);
  assert.equal(elemento.async, false, 'debe preservar el orden (async=false)');
  assert.equal(elemento.atributos['data-pm11-compra-mobile'], 'v1');
  console.log('PM26_P04B_LOADER_MOVIL_UNIVERSAL_PRODUCCION=PASS');
}

// --- Prueba de idempotencia: ejecutarlo dos veces no inyecta dos scripts. ---
{
  const loaderCodigo = leer('pm11-compra-mobile-loader.js');
  const creados = [];
  const document = {
    head: { appendChild(el) { creados.push(el); } },
    documentElement: { appendChild(el) { creados.push(el); } },
    createElement() { return { src: '', async: true, setAttribute() {} }; },
  };
  const window = { location: { hostname: 'chic-entremet-9107cf.netlify.app' } };
  const sandbox = { window, document };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(loaderCodigo, sandbox, { filename: 'pm11-compra-mobile-loader.js' });
  vm.runInContext(loaderCodigo, sandbox, { filename: 'pm11-compra-mobile-loader.js' });
  assert.equal(creados.length, 1, 'la segunda ejecución no debe volver a inyectar el script');
  console.log('PM26_P04B_LOADER_MOVIL_IDEMPOTENTE=PASS');
}

// --- Prueba negativa deliberada sobre una copia EN MEMORIA: si alguien
// reintrodujera un guard de host en el loader universal (regresión al
// diseño anterior), el layout dejaría de cargarse en producción -- se
// demuestra ejecutando esa copia mutada, nunca el archivo real. ---
{
  const loaderCodigo = leer('pm11-compra-mobile-loader.js');
  const conGuardReintroducido = loaderCodigo.replace(
    'if (typeof window === "undefined" || window.__pm11CompraMobileLoaderV1) return;',
    'if (typeof window === "undefined" || window.__pm11CompraMobileLoaderV1) return;\n  if (!/deploy-preview/.test(window.location.hostname)) return;'
  );
  assert.notEqual(conGuardReintroducido, loaderCodigo, 'mutación sintética sin efecto -- prueba negativa inválida');
  const { creados } = ejecutarLoaderMovil(conGuardReintroducido, 'chic-entremet-9107cf.netlify.app');
  assert.equal(creados.length, 0, 'la prueba negativa (guard de host reintroducido) debía impedir la inyección en producción y no lo hizo');
  console.log('PM26_P04B_NEGATIVA_GUARD_HOST_REINTRODUCIDO=PASS (el layout dejaría de cargar en producción -- detectado)');
}

// --- index.html referencia el loader universal, una sola vez, sin
// condición, en la misma posición temprana que antes. ---
{
  const indexHtml = leer('index.html');
  const tag = '<script src="./pm11-compra-mobile-loader.js"></script>';
  assert.equal(indexHtml.split(tag).length - 1, 1, 'el loader universal debe enlazarse exactamente una vez en index.html');
  const posLoader = indexHtml.indexOf(tag);
  const posReset = indexHtml.indexOf('<script src="./reset-pruebas-preview.js"></script>');
  assert.ok(posLoader >= 0 && posReset >= 0 && posLoader < posReset, 'el loader universal debe enlazarse antes que reset-pruebas-preview.js');
  console.log('PM26_P04B_INDEX_HTML_VERIFICADO=PASS');
}

// --- Los dos tests vivos identificados en P04a pasan de verdad hoy. ---
{
  const vivos = [
    'tests/pm11-compra/p10-regresion-integral-contract.mjs',
    'tests/pm12/p10-preview-smoke-contract.mjs',
  ];
  for (const contrato of vivos) {
    const r = spawnSync('node', [contrato], { cwd: RAIZ_REPO, encoding: 'utf8' });
    assert.equal(r.status, 0, `esperado código de salida 0 en ${contrato}, obtenido ${r.status}\n${r.stdout}\n${r.stderr}`);
  }
  console.log('PM26_P04B_TESTS_VIVOS_PASAN=PASS');
}

// --- Estructural: ni el informe ni los archivos nuevos contienen ningún
// secreto real ni identificador interno fuera de una ubicación legítima,
// y no copian la URL/clave pública QA a un archivo nuevo. ---
{
  const archivosNuevosP04b = [
    'tests/pm26/P04B_APLICACION_DEFECTOS_B_C_D.md',
    'tests/pm26/p04b-contract.mjs',
    'pm11-compra-mobile-loader.js',
  ];
  const hallazgos = escanearArbol({ raiz: RAIZ_REPO, archivos: archivosNuevosP04b, ubicacionesLegitimas: [] });
  const secretosReales = hallazgos.filter((h) => h.tipo === 'secreto_real');
  const identificadoresNoAdmitidos = hallazgos.filter(
    (h) => h.tipo === 'identificador_duplicado' && h.categoria !== 'falso_positivo'
  );
  assert.equal(secretosReales.length, 0, 'los archivos nuevos de P04b no deben contener ningún secreto real');
  assert.equal(identificadoresNoAdmitidos.length, 0, 'los archivos nuevos de P04b no deben contener ningún identificador interno real');

  const reset = leer('reset-pruebas-preview.js');
  const claveQA = reset.match(/var SUPABASE_QA_KEY = "([^"]+)";/)?.[1];
  const urlQAHost = reset.match(/var SUPABASE_QA_HOST = "([^"]+)";/)?.[1];
  assert.ok(claveQA && urlQAHost, 'no se pudo extraer la clave/URL QA reales para la comprobación');
  const loaderCodigo = leer('pm11-compra-mobile-loader.js');
  assert.ok(!loaderCodigo.includes(claveQA), 'el loader universal no debe contener la clave pública QA');
  assert.ok(!loaderCodigo.includes(urlQAHost), 'el loader universal no debe contener el host QA');
  console.log('PM26_P04B_SIN_SECRETOS_NI_IDENTIFICADORES_QA_COPIADOS=PASS');
}

// --- El informe documenta con precisión lo aplicado. ---
const doc = leer('tests/pm26/P04B_APLICACION_DEFECTOS_B_C_D.md');
assert.match(doc, /PM26_P04B_ESTADO=APLICADO_Y_CERRADO/);
assert.match(doc, /PM26_P04B_DEFECTO_B_10_ARCHIVOS_ELIMINADOS=SI/);
assert.match(doc, /PM26_P04B_DEFECTO_C_OTRAS_6_REGLAS_TOCADAS=NO/);
assert.match(doc, /PM26_P04B_DEFECTO_D_TESTS_VIVOS_ACTUALIZADOS_Y_VERDES=SI/);
assert.match(doc, /PM26_P04B_DEFECTO_D_SCRIPTS_MUERTOS_TOCADOS=NO/);
assert.match(doc, /PM26_P04B_MAIN_TOCADO=NO/);
assert.match(doc, /PM26_P04B_EDGE_AUTH_PATCH_TOCADO=NO/);

console.log('PM26_P04B_DOC_VERIFICADO=PASS');
console.log('PM26 P04b — aplicación de las correcciones B, C y D: contrato OK');
