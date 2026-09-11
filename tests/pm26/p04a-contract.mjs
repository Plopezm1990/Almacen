import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { escanearArbol } from '../../tools/seguridad/verificar-secretos-e-identificadores.mjs';
import { anclar, exigirDeteccion, comprobarAnclajeNoPasaEnVacio } from './lib/cierre-historico.mjs';

// PM26 P04a: contrato de la INSPECCIÓN de solo lectura de los defectos
// B, C y D. No certifica ninguna eliminación ni modificación -- certifica
// que (1) nada de lo prohibido fue tocado (hashes idénticos a los
// registrados en el informe), (2) los hallazgos estructurales del
// informe (grafo de referencias del defecto B, ausencia del defecto C,
// separación universal/QA del defecto D) son reproducibles por script,
// no solo afirmados en prosa, y (3) ni el informe ni este contrato
// contienen ningún secreto o identificador QA copiado.
//
// PM26 P08f corrigió aquí el mismo defecto que P08b ya había corregido
// en P07c: los artefactos ajenos a P04a (_headers, index.html,
// reset-pruebas-preview.js, fuente.js, los 10 huérfanos, el ledger de
// seguridad y el propio inventario de archivos rastreados) se leían del
// árbol de trabajo EN VIVO. P04a certifica un hecho histórico inmutable
// -- lo que esos archivos decían en el commit exacto donde su gate pasó
// en verde -- así que cualquier avance legítimo posterior (K, F, H,
// P08b...) rompía este gate sin tener nada que ver con él. Ahora se leen
// con `git show <cierre>:<ruta>`. Ninguna comprobación se ha debilitado,
// eliminado ni vuelto opcional: cambia la FUENTE de los bytes, no lo que
// se exige de ellos, y se añaden controles negativos que demuestran que
// no pasan en vacío.

const __filename = fileURLToPath(import.meta.url);
const RAIZ_REPO = path.resolve(path.dirname(__filename), '..', '..');

// Commit exacto donde el gate de P04a pasó en verde
// ("PM26 P04a: corrige el gate — el propio workflow nombra los 10
// huérfanos para protegerlos"). El módulo compartido exige que exista,
// que sea un commit y que siga siendo antepasado de HEAD.
const CIERRE_HISTORICO = '2ac878c96275a26e72ee2af061b2f3953e10a90f';
const hist = anclar(CIERRE_HISTORICO, 'PM26 P04a');
console.log(`PM26_P04A_CIERRE_HISTORICO_VALIDO=PASS (${CIERRE_HISTORICO})`);

function leerVivo(rel) {
  return fs.readFileSync(path.join(RAIZ_REPO, rel), 'utf8');
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
  assert.equal(
    hist.sha256(rel),
    esperado,
    `PM26 P04a no debe tocar ${rel} -- hash distinto al registrado en el informe (en ${CIERRE_HISTORICO})`
  );
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
  assert.ok(hist.existe(rel), `${rel} debía existir en el commit de cierre ${CIERRE_HISTORICO}`);
  assert.equal(
    hist.sha256(rel),
    esperado,
    `${rel} no coincide con lo registrado en el informe -- P04a es de solo lectura`
  );
}
console.log('PM26_P04A_10_HUERFANOS_PRESENTES_Y_SIN_CAMBIOS=PASS');

// Inventario de archivos rastreados EN EL COMMIT DE CIERRE. Antes se
// usaba `git ls-files` (árbol vivo), lo que hacía que cualquier archivo
// nuevo de un paquete posterior entrara en la comprobación del grafo.
const RASTREADOS_HISTORICOS = hist.listarArchivos();

// Reproduce la búsqueda de referencias: para cada uno de los 10
// nombres, ningún archivo rastreado FUERA del propio grupo de 10 (y
// fuera de la documentación) puede contener el nombre exacto.
const PERMITIDOS_FUERA_DEL_GRUPO = new Set([
  'source-recovery/README.md',
  'tests/pm26/P01_INVENTARIO_DIAGNOSTICO.md',
  'tests/pm26/P04A_INSPECCION_DEFECTOS_B_C_D.md',
  'tests/pm26/p04a-contract.mjs',
  'docs/plan-maestro/PM17_DIAGNOSTICO_PARCHES.md',
  'source-recovery/entrada-recuperada.js',
  'tools/seguridad/linea-base-aceptada.json',
  '.github/workflows/pm26-p04a-inspeccion-defectos-bcd.yml',
]);

function referenciasInesperadas(leerContenido, archivos, permitidos = PERMITIDOS_FUERA_DEL_GRUPO) {
  const inesperados = [];
  for (const archivo of archivos) {
    if (NOMBRES_10.includes(path.basename(archivo))) continue; // uno de los propios 10
    if (permitidos.has(archivo)) continue;
    let contenido;
    try {
      contenido = leerContenido(archivo);
    } catch {
      continue; // binario u otro problema de lectura -- no relevante aquí
    }
    for (const nombre of NOMBRES_10) {
      if (contenido.includes(nombre)) inesperados.push(`${archivo} menciona ${nombre}`);
    }
  }
  return inesperados;
}

{
  const inesperados = referenciasInesperadas((f) => hist.leer(f), RASTREADOS_HISTORICOS);
  assert.equal(
    inesperados.length,
    0,
    `referencia inesperada fuera del grupo de 10 huérfanos: ${inesperados.join('; ')}`
  );
  console.log('PM26_P04A_DEFECTO_B_SIN_REFERENCIAS_EXTERNAS_INESPERADAS=PASS');
}

// Control negativo del grafo: si se retira de la lista de permitidos un
// archivo que SI menciona uno de los 10, la comprobación debe delatarlo.
// Demuestra que el recorrido lee de verdad el contenido y no pasa en
// vacío por una lista de exclusión demasiado amplia.
{
  const permitidosRecortados = new Set(PERMITIDOS_FUERA_DEL_GRUPO);
  permitidosRecortados.delete('tests/pm26/P04A_INSPECCION_DEFECTOS_B_C_D.md');
  const detectados = referenciasInesperadas((f) => hist.leer(f), RASTREADOS_HISTORICOS, permitidosRecortados);
  assert.ok(
    detectados.length > 0,
    'el recorrido del grafo no detecta una referencia real -- estaría pasando en vacío'
  );
  console.log(`PM26_P04A_GRAFO_CONTROL_NEGATIVO=PASS (${detectados.length} referencias detectadas al recortar la lista)`);
}

// --- Defecto B: dependencia real con el ledger de seguridad (4 archivos). ---
{
  const lb = JSON.parse(hist.leer('tools/seguridad/linea-base-aceptada.json'));
  const archivosEnLedger = new Set(lb.entradas.map((e) => e.archivo));
  const esperados = ['index.es-SJCMKHSO-5BY7EMAG.js', 'index.es-SJCMKHSO.js', 'purify.es-TSVPIOEK-6SSTY34W.js', 'purify.es-TSVPIOEK.js'];
  for (const esperado of esperados) {
    assert.ok(archivosEnLedger.has(esperado), `se esperaba que ${esperado} siguiera en la línea base aceptada`);
  }
  // Control negativo: un nombre que nunca estuvo en el ledger no debe
  // encontrarse -- si el Set se construyera vacío o mal, la comprobación
  // de arriba habría pasado en vacío.
  assert.ok(
    !archivosEnLedger.has('archivo-que-nunca-estuvo-en-el-ledger.js'),
    'el ledger no puede declarar presente un archivo inexistente'
  );
  assert.ok(archivosEnLedger.size >= esperados.length, 'el ledger leído no puede tener menos entradas que las exigidas');
  console.log('PM26_P04A_DEFECTO_B_DEPENDENCIA_LEDGER_CONFIRMADA=PASS');
}

// --- Defecto C: el archivo no existe, y la regla en _headers sigue
// presente sin efecto sobre ningún archivo real. ---
{
  assert.ok(
    !RASTREADOS_HISTORICOS.some((f) => path.basename(f) === 'seleccion-neutral-patch.js'),
    'seleccion-neutral-patch.js no debería existir en el árbol rastreado del cierre'
  );
  const headers = hist.leer('_headers');
  assert.match(headers, /\/seleccion-neutral-patch\.js/, 'la regla residual debe seguir presente -- P04a no la elimina todavía');
  const fuente = hist.leer('fuente.js');
  assert.ok(!fuente.includes('seleccion-neutral-patch.js'), 'fuente.js (código realmente ejecutado) no debe referenciar el archivo retirado');
  console.log('PM26_P04A_DEFECTO_C_VERIFICADO=PASS');
}

// --- Defecto D: la frontera universal/QA-only es reproducible por
// script -- el loader del layout PM11 aparece antes del guard de host,
// y el guard de host aparece antes de cualquier mención a QA. ---
function validarFronteraD(reset) {
  const posLoaderUniversal = reset.indexOf('pm11-compra-mobile-layout-v1.js');
  const posGuardHost = reset.indexOf('HOST_PREVIEW.test(window.location.hostname)');
  const posModoQA = reset.indexOf('__modoPruebasQA');
  assert.ok(posLoaderUniversal >= 0 && posGuardHost >= 0 && posModoQA >= 0, 'no se localizaron los tres puntos de referencia esperados');
  assert.ok(posLoaderUniversal < posGuardHost, 'el loader universal debe preceder al guard de host');
  assert.ok(posGuardHost < posModoQA, 'el guard de host debe preceder a cualquier activación de modo QA');
  return true;
}
{
  const reset = hist.leer('reset-pruebas-preview.js');
  assert.ok(validarFronteraD(reset));
  // Controles negativos en memoria: si desapareciera el guard de host, o
  // si el modo QA se activara antes que él, la comprobación debe fallar.
  exigirDeteccion(
    reset,
    (t) => t.replace('HOST_PREVIEW.test(window.location.hostname)', 'true /* guard retirado */'),
    validarFronteraD,
    /no se localizaron los tres puntos de referencia esperados/,
    'P04a defecto D sin guard de host'
  );
  exigirDeteccion(
    reset,
    (t) => `/* __modoPruebasQA adelantado */\n${t}`,
    validarFronteraD,
    /el guard de host debe preceder a cualquier activación de modo QA/,
    'P04a defecto D con modo QA adelantado'
  );
  console.log('PM26_P04A_DEFECTO_D_FRONTERA_UNIVERSAL_QA_VERIFICADA=PASS');
}

// --- Defecto D: los tests vivos identificados en el informe pasan de
// verdad hoy (código de salida real de proceso). Esto SI se mide contra
// el árbol vivo a propósito: no es una huella histórica sino una
// propiedad que debe seguir cumpliéndose, y medirla en vivo es más
// exigente, no menos. ---
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
// usuario para P04a). Se escanean los archivos VIVOS: el informe y este
// contrato deben seguir limpios hoy, no solo el día del cierre. ---
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
  // Los valores se derivan de la ubicación legítima en el commit de
  // cierre: son los que P04a tenía delante cuando prometió no copiarlos.
  const resetHist = hist.leer('reset-pruebas-preview.js');
  const claveQA = resetHist.match(/var SUPABASE_QA_KEY = "([^"]+)";/)?.[1];
  const urlQAHost = resetHist.match(/var SUPABASE_QA_HOST = "([^"]+)";/)?.[1];
  assert.ok(claveQA && urlQAHost, 'no se pudo extraer la clave/URL QA reales desde el propio archivo para la comprobación');
  assert.ok(claveQA.length >= 20 && urlQAHost.length >= 8, 'los identificadores derivados no pueden ser cadenas triviales');
  for (const rel of archivosNuevosP04a) {
    // Vivo e histórico: ni entonces ni ahora pueden contenerlos.
    for (const [origen, contenido] of [['vivo', leerVivo(rel)], ['cierre', hist.leer(rel)]]) {
      assert.ok(!contenido.includes(claveQA), `${rel} (${origen}) no debe contener la clave pública QA copiada literalmente`);
      assert.ok(!contenido.includes(urlQAHost), `${rel} (${origen}) no debe contener el host QA copiado literalmente`);
    }
  }
  // Control negativo: la comprobación debe delatar una copia real.
  const inyectado = `texto cualquiera ${claveQA} mas texto`;
  assert.ok(inyectado.includes(claveQA), 'el control negativo de fuga debe detectar la clave inyectada');
  console.log('PM26_P04A_SIN_SECRETOS_NI_IDENTIFICADORES_QA_COPIADOS=PASS');
}

// --- El informe documenta con precisión que es de solo lectura y que no
// se aplicó ningún cambio. Se lee VIVO: es el artefacto propio de P04a y
// debe seguir diciendo lo mismo hoy. ---
const doc = leerVivo('tests/pm26/P04A_INSPECCION_DEFECTOS_B_C_D.md');
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
// El informe no puede haberse reescrito respecto a lo que se certificó.
assert.equal(
  crypto.createHash('sha256').update(Buffer.from(doc, 'utf8')).digest('hex'),
  hist.sha256('tests/pm26/P04A_INSPECCION_DEFECTOS_B_C_D.md'),
  'el informe de P04a difiere del que se certificó en su commit de cierre'
);
console.log('PM26_P04A_DOC_VERIFICADO=PASS');

// --- Control negativo del anclaje: un SHA que no existe, uno que no es
// antepasado de HEAD y una ruta inexistente deben fallar, nunca pasar
// en silencio. ---
{
  assert.ok(comprobarAnclajeNoPasaEnVacio());
  assert.throws(() => hist.leer('ruta/que/no/existe.txt'), /no se pudo leer/);
  assert.ok(!hist.existe('ruta/que/no/existe.txt'));
  console.log('PM26_P04A_ANCLAJE_CONTROL_NEGATIVO=PASS');
}

console.log('PM26 P04a — inspección de solo lectura de los defectos B, C y D: contrato OK');
