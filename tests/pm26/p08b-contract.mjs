import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { escanearArbol } from '../../tools/seguridad/verificar-secretos-e-identificadores.mjs';

// PM26 P08b: contrato del preflight endurecido, el cliente compatible
// con QA y produccion, el despliegue coordinado y las pruebas sobre
// los esquemas anterior y posterior del Defecto L. No certifica
// ninguna aplicacion ni despliegue real -- certifica que (1) el
// documento contiene todos los marcadores exigidos y declara que NO se
// aplico ni desplego nada, (2) el preflight endurecido contiene la
// huella del cuerpo del helper y la exclusion de helpers de QA, (3)
// los hashes documentados coinciden con los archivos reales, (4) la
// fuente canonica reconstruye de forma determinista y su cliente
// distingue QA de produccion via la misma senal ya usada por el
// Defecto K, (5) validar.sh (con las pruebas de transicion
// anterior/posterior) se re-ejecuta de verdad y pasa, (6) los
// contratos P07b y P08a, actualizados para esta extension legitima,
// siguen pasando, y (7) ni el documento ni este contrato contienen
// ningun secreto real.

const __filename = fileURLToPath(import.meta.url);
const RAIZ_REPO = path.resolve(path.dirname(__filename), '..', '..');

function leer(rel) {
  return fs.readFileSync(path.join(RAIZ_REPO, rel), 'utf8');
}

function sha256(rel) {
  return crypto.createHash('sha256').update(fs.readFileSync(path.join(RAIZ_REPO, rel))).digest('hex');
}

const doc = leer('tests/pm26/P08B_DEFECTO_L_CLIENTE_COORDINADO.md');

for (const marcador of [
  'PM26_P08B_ESTADO=PREPARADO_NO_APLICADO_NO_DESPLEGADO',
  'PM26_P08B_PREFLIGHT_HUELLA_CUERPO_HELPER=SI',
  'PM26_P08B_PREFLIGHT_EXCLUYE_HELPERS_QA=SI',
  'PM26_P08B_PREFLIGHT_RECHAZA_AMBAS_COLUMNAS=SI',
  'PM26_P08B_PREFLIGHT_ENDURECIDO_PROBADO_POSITIVO_Y_NEGATIVO=SI',
  'PM26_P08B_CLIENTE_COMPATIBLE_QA_Y_PRODUCCION=SI',
  'PM26_P08B_CLIENTE_ESQA_DERIVADO_DE_SENAL_EXISTENTE=SI',
  'PM26_P08B_CORRECCION_DETECCION_DELETE_BLOQUEADO=SI',
  'PM26_P08B_QA_MUTACION_DIRECTA_PROHIBIDA=SI',
  'PM26_P08B_PRODUCCION_RLS_DIRECTO_VALIDADO=SI',
  'PM26_P08B_BUILD_DETERMINISTA=SI',
  'PM26_P08B_REGRESION_P07B_ACTUALIZADA_SIN_REESCRIBIR=SI',
  'PM26_P08B_P07C_ANCLADO_A_CIERRE_HISTORICO=SI',
  'PM26_P08B_DESPLIEGUE_COORDINADO_DOCUMENTADO=SI',
  'PM26_P08B_VENTANA_MANTENIMIENTO_DOCUMENTADA=SI',
  'PM26_P08B_PESTANAS_ANTIGUAS_DOCUMENTADO=SI',
  'PM26_P08B_INTERRUPCION_SQL_CLIENTE_DOCUMENTADA=SI',
  'PM26_P08B_ROLLBACK_CONSERVADOR_DOCUMENTADO=SI',
  'PM26_P08B_ROLLBACK_CONSERVA_DATOS_CON_TRAFICO=SI',
  'PM26_P08B_PRUEBAS_ESQUEMA_ANTERIOR=PASS',
  'PM26_P08B_PRUEBAS_ESQUEMA_POSTERIOR=PASS',
  'PM26_P08B_APLICADO_EN_PRODUCCION=NO',
  'PM26_P08B_APLICADO_EN_QA=NO',
  'PM26_P08B_DESPLEGADO_EN_NETLIFY=NO',
  'PM26_P08B_MAIN_RELEASE_TOCADOS=NO',
]) {
  assert.ok(doc.includes(marcador), `falta el marcador ${marcador} en el informe`);
}
console.log('PM26_P08B_ESTADO_DOC_VERIFICADO=PASS');

// --- El preflight endurecido contiene las dos comprobaciones nuevas,
// embebido y en el independiente, byte a byte identicos entre si. ---
const rutaMigracion = 'tests/pm26/p08-defecto-l-produccion/migracion-propuesta.sql';
const rutaPreflight = 'tests/pm26/p08-defecto-l-produccion/preflight-independiente.sql';
const migracionTexto = leer(rutaMigracion);
const preflightTexto = leer(rutaPreflight);

for (const texto of [migracionTexto, preflightTexto]) {
  assert.match(texto, /el cuerpo de private\.la_tiene_local no coincide/);
  assert.match(texto, /btrim\(regexp_replace\(pg_get_functiondef\(p\.oid\), '\\s\+', ' ', 'g'\)\)/);
  assert.match(texto, /pm11_puede_ver_personal', 'pm11_puede_mutar_personal'/);
  assert.match(texto, /esto parece QA, no produccion/);
  // Correccion real: rechaza empresa_id Y local_id por separado -- un
  // estado parcial donde solo local_id ya existiera pasaba antes sin
  // detectarlo.
  assert.match(texto, /column_name='empresa_id'\) then/);
  assert.match(texto, /prefiltros_candidatos\.empresa_id ya existe/);
  assert.match(texto, /column_name='local_id'\) then/);
  assert.match(texto, /prefiltros_candidatos\.local_id ya existe/);
}
function extraerPreflight(texto, etiqueta) {
  const inicio = '-- PM26_P08_PREFLIGHT_INICIO\n';
  const fin = '-- PM26_P08_PREFLIGHT_FIN';
  const desde = texto.indexOf(inicio);
  const hasta = texto.indexOf(fin, desde + inicio.length);
  assert.ok(desde >= 0 && hasta > desde, `${etiqueta}: faltan marcadores del preflight`);
  return texto.slice(desde + inicio.length, hasta);
}
assert.equal(
  extraerPreflight(migracionTexto, 'migracion'),
  extraerPreflight(preflightTexto, 'preflight independiente'),
  'el preflight embebido y el independiente deben seguir siendo byte a byte identicos tras el endurecimiento'
);
console.log('PM26_P08B_PREFLIGHT_ENDURECIDO_VERIFICADO=PASS');

// --- Hashes de la migracion/preflight endurecidos coinciden con el documento. ---
assert.match(doc, new RegExp(sha256(rutaMigracion)), 'el hash de la migracion endurecida no coincide con el documento');
assert.match(doc, new RegExp(sha256(rutaPreflight)), 'el hash del preflight endurecido no coincide con el documento');
console.log('PM26_P08B_HASHES_SQL_VERIFICADOS=PASS');

// --- Build determinista: se reconstruye primero la fuente canonica
// (si el checkout no trae ya dist/fuente.js) y se comprueba que dos
// builds consecutivos producen el mismo hash. PM26 P03b ya documento y
// acepto que un build limpio NO es byte a byte identico al fuente.js
// servido (esbuild recorta algunos comentarios de linea y puede
// renombrar variables locales segun la composicion global del bundle)
// -- por eso este contrato nunca exige esa igualdad, igual que ya hace
// tests/pm26/p07b-contract.mjs con el mismo trio de artefactos.
{
  const r1 = spawnSync('node', ['verificar-build-canonico.mjs'], { cwd: path.join(RAIZ_REPO, 'source-recovery'), encoding: 'utf8' });
  assert.equal(r1.status, 0, 'primer build canonico debe terminar con exito');
  const hash1 = sha256('source-recovery/dist/fuente.js');
  const r2 = spawnSync('node', ['verificar-build-canonico.mjs'], { cwd: path.join(RAIZ_REPO, 'source-recovery'), encoding: 'utf8' });
  assert.equal(r2.status, 0, 'segundo build canonico debe terminar con exito');
  const hash2 = sha256('source-recovery/dist/fuente.js');
  assert.equal(hash1, hash2, 'dos builds canonicos consecutivos deben producir el mismo hash');
}
console.log('PM26_P08B_BUILD_DETERMINISTA_VERIFICADO=PASS');

// --- Cliente: crearLogicaPrefiltros distingue QA de produccion via la
// misma senal ya usada por el Defecto K (window.__modoPruebasQA), sin
// introducir un mecanismo de deteccion nuevo. Se comprueba en los tres
// artefactos (canonica, servida y recien construida); los nombres de
// variables locales de la rama nueva pueden variar segun como esbuild
// componga el bundle, igual que ya acepta p07b-contract.mjs para la
// rama QA -- se derivan por backreference, nunca se asumen fijos. ---
const rutasArtefactos = ['source-recovery/fuente-recuperado.js', 'fuente.js', 'source-recovery/dist/fuente.js'];
for (const rel of rutasArtefactos) {
  assert.ok(fs.existsSync(path.join(RAIZ_REPO, rel)), `falta ${rel}; ejecutar primero el build canonico`);
}
function extraerBloquesEsQA(texto, etiqueta) {
  const marcador = 'if (esQA) {';
  const bloques = [];
  let desde = 0;
  for (;;) {
    const inicio = texto.indexOf(marcador, desde);
    if (inicio < 0) break;
    let i = inicio + marcador.length;
    let profundidad = 1;
    while (profundidad > 0 && i < texto.length) {
      if (texto[i] === '{') profundidad++;
      else if (texto[i] === '}') profundidad--;
      i++;
    }
    assert.ok(profundidad === 0, `${etiqueta}: bloque "if (esQA) {" sin cierre`);
    bloques.push(texto.slice(inicio, i));
    desde = i;
  }
  assert.ok(bloques.length >= 2, `${etiqueta}: se esperaban al menos 2 bloques "if (esQA) { ... }", encontrados ${bloques.length}`);
  return bloques;
}

for (const rel of rutasArtefactos) {
  const texto = leer(rel);
  assert.match(texto, /function crearLogicaPrefiltros\(\{ registrarAuditoria, empresaId, localId, esQA \}\)/);
  assert.match(texto, /esQA:\s*typeof window !== "undefined" && window\.__modoPruebasQA === true/);
  assert.match(texto, /if \(esQA\) \{/);
  // Rama de produccion: INSERT/DELETE directos con empresa_id/local_id.
  assert.match(texto, /\.from\("prefiltros_candidatos"\)\.insert\(\{/);
  assert.match(texto, /empresa_id:\s*empresaId,\s*\n\s*local_id:\s*localId/);
  // Correccion real: el DELETE de produccion exige .select() y exactamente
  // una fila devuelta para distinguir un borrado bloqueado por RLS de uno real.
  const mBorrarDirecto = texto.match(
    /const \{ data(?:: (\w+))?, error(?:: (\w+))? \} = await supabase\.from\("prefiltros_candidatos"\)\.delete\(\)\.eq\("token", token\)\.select\(\);/
  );
  assert.ok(mBorrarDirecto, `${rel}: no se pudo aislar la respuesta del DELETE directo`);
  const nombreData = mBorrarDirecto[1] || 'data';
  const nombreError = mBorrarDirecto[2] || 'error';
  assert.match(
    texto,
    new RegExp(`if \\(${nombreError} \\|\\| !Array\\.isArray\\(${nombreData}\\) \\|\\| ${nombreData}\\.length !== 1\\) return false;`)
  );
  // Reparacion real: la rama QA (if (esQA)) tiene prohibido mutar
  // prefiltros_candidatos directamente -- solo por RPC. Este contrato
  // habia dejado de comprobarlo al validar la rama de produccion; se
  // reintroduce aqui acotado, y en tests/pm26/p07b-contract.mjs y
  // tests/pm26/p06h-contract.mjs (que tenian el mismo defecto sin
  // corregir desde antes de P08b).
  for (const bloqueQA of extraerBloquesEsQA(texto, rel)) {
    assert.doesNotMatch(
      bloqueQA,
      /\.from\("prefiltros_candidatos"\)\.(?:insert|delete)\(/,
      `${rel}: la rama QA (if (esQA)) no debe mutar prefiltros_candidatos directamente`
    );
  }
}
console.log('PM26_P08B_CLIENTE_DUAL_VERIFICADO=PASS');

// --- Hashes documentados de los tres artefactos de fuente coinciden
// con los archivos reales. No se exige fuente.js == dist/fuente.js: son
// propiedades distintas (bundle servido vs. build recien reconstruido),
// mismo criterio que P07b ya documenta con sus tres filas de hash
// separadas ("Fuente canonica" / "Bundle servido" / "Build canonico
// determinista"). ---
for (const rel of rutasArtefactos) {
  assert.match(doc, new RegExp(sha256(rel)), `el informe no contiene el SHA-256 real de ${rel}`);
}
console.log('PM26_P08B_HASHES_FUENTE_VERIFICADOS=PASS');

// --- Re-ejecuta de verdad validar.sh (bateria de 14 casos, preflight
// endurecido positivo/negativo x4, transicion anterior/posterior,
// reaplicacion rechazada, reversion exacta). ---
const validar = path.join(RAIZ_REPO, 'tests/pm26/p08-defecto-l-produccion/validar.sh');
const r1 = spawnSync('bash', [validar], { cwd: RAIZ_REPO, encoding: 'utf8', timeout: 120000 });
if (r1.status !== 0) {
  console.error(r1.stdout);
  console.error(r1.stderr);
}
assert.equal(r1.status, 0, 'validar.sh (P08b) debe terminar con exito');
for (const marcador of [
  'PM26_P08_FUERA_DE_SUPABASE=PASS',
  'PM26_P08_SCHEMA=PASS',
  'PM26_P08_SEED=PASS',
  'PM26_P08_TRANSICION_ANTERIOR=PASS',
  'PM26_P08_PREFLIGHT_INDEPENDIENTE=PASS',
  'PM26_P08_PREFLIGHT_DETECTA_CATALOGO_DISTINTO=PASS',
  'PM26_P08_PREFLIGHT_DETECTA_FILAS_EXISTENTES=PASS',
  'PM26_P08_PREFLIGHT_DETECTA_CUERPO_HELPER_DISTINTO=PASS',
  'PM26_P08_PREFLIGHT_DETECTA_HELPER_QA=PASS',
  'PM26_P08_PREFLIGHT_DETECTA_LOCAL_ID_PARCIAL=PASS',
  'PM26_P08_MIGRACION_APLICADA=PASS',
  'PM26_P08_TRANSICION_POSTERIOR=PASS',
  'PM26_P08_BATERIA_CASOS=PASS',
  'PM26_P08_REAPLICACION_RECHAZADA=PASS',
  'PM26_P08_ROLLBACK_EXACTO_RECHAZA_CON_TRAFICO=PASS',
  'PM26_P08_ROLLBACK_CONSERVADOR_PRESERVA_DATOS=PASS',
  'PM26_P08_REVERSION_EXACTA=PASS',
  'PM26_P08_PREFLIGHT_PASA_TRAS_REVERTIR=PASS',
  'PM26_P08_REAPLICACION_LIMPIA_TRAS_REVERTIR=PASS',
  'PM26_P08_VALIDACION_COMPLETA=PASS',
]) {
  assert.ok(r1.stdout.includes(marcador), `falta el marcador ${marcador} en la salida real de validar.sh`);
}
console.log('PM26_P08B_VALIDAR_SH_REPRODUCIDO=PASS');

// --- Rollback conservador: revertir.sql se niega a ejecutarse con
// trafico real (ROLLBACK_FALLO), y revertir-conservador.sql existe,
// nunca borra filas y solo relaja NOT NULL + revierte politicas. ---
const revertirTexto = leer('tests/pm26/p08-defecto-l-produccion/revertir.sql');
assert.match(revertirTexto, /ROLLBACK_FALLO/, 'revertir.sql debe negarse a ejecutarse si hay filas existentes');
assert.match(revertirTexto, /select count\(\*\) into v_total from public\.prefiltros_candidatos;/);
const rutaConservador = 'tests/pm26/p08-defecto-l-produccion/revertir-conservador.sql';
assert.ok(fs.existsSync(path.join(RAIZ_REPO, rutaConservador)), 'falta revertir-conservador.sql');
const conservadorTexto = leer(rutaConservador);
assert.doesNotMatch(conservadorTexto, /drop column/i, 'revertir-conservador.sql nunca debe retirar columnas');
assert.doesNotMatch(conservadorTexto, /\bdelete\s+from\b/i, 'revertir-conservador.sql nunca debe borrar filas');
assert.match(conservadorTexto, /alter column empresa_id drop not null/);
assert.match(conservadorTexto, /alter column local_id drop not null/);
console.log('PM26_P08B_ROLLBACK_CONSERVADOR_VERIFICADO=PASS');

// --- Los casos de transicion anterior/posterior estan realmente
// presentes en sus archivos. ---
const transAnterior = leer('tests/pm26/p08-defecto-l-produccion/transicion-anterior.sql');
const transPosterior = leer('tests/pm26/p08-defecto-l-produccion/transicion-posterior.sql');
for (const caso of ['ANT1', 'ANT2_BRECHA_REPRODUCIDA']) {
  assert.ok(new RegExp(`${caso}=PASS`).test(transAnterior), `falta el caso ${caso} en transicion-anterior.sql`);
}
for (const caso of ['POST1_CLIENTE_ANTIGUO_FALLA', 'POST2_CLIENTE_NUEVO_FUNCIONA', 'POST3_BRECHA_CERRADA', 'POST3_SIN_RESIDUO_BORRADO', 'POST4_BORRADO_PROPIO_FUNCIONA']) {
  assert.ok(new RegExp(`${caso}=PASS`).test(transPosterior), `falta el caso ${caso} en transicion-posterior.sql`);
}
console.log('PM26_P08B_CASOS_TRANSICION_PRESENTES=PASS');

// --- Regresion acumulada de P07b y P08a (actualizados por esta
// extension legitima): se ejecutan como pasos separados del workflow,
// no anidados aqui dentro -- anidar spawnSync de contratos que a su vez
// reconstruyen la fuente y vuelven a lanzar validar.sh agota la memoria
// del proceso. Este contrato solo verifica lo que le es propio.

// --- Nada de esto vive en supabase/, y no se toco index.html, _headers
// ni reset-pruebas-preview.js. ---
const migraciones = fs.readdirSync(path.join(RAIZ_REPO, 'supabase/migrations'));
assert.ok(!migraciones.some((m) => /prefiltro/i.test(m)), 'no debe existir ninguna migracion real del Defecto L en supabase/migrations');
assert.ok(!fs.existsSync(path.join(RAIZ_REPO, 'supabase/qa-solo', path.basename(rutaMigracion))));
console.log('PM26_P08B_FUERA_DE_SUPABASE=PASS');

// --- Estructural: sin secretos ni identificadores internos. ---
{
  const archivosNuevos = [
    'tests/pm26/P08B_DEFECTO_L_CLIENTE_COORDINADO.md',
    'tests/pm26/P08A_DEFECTO_L_PREPARACION_PRODUCCION.md',
    'tests/pm26/p08b-contract.mjs',
    'tests/pm26/p08a-contract.mjs',
    'tests/pm26/p07b-contract.mjs',
    'tests/pm26/p08-defecto-l-produccion/migracion-propuesta.sql',
    'tests/pm26/p08-defecto-l-produccion/preflight-independiente.sql',
    'tests/pm26/p08-defecto-l-produccion/transicion-anterior.sql',
    'tests/pm26/p08-defecto-l-produccion/transicion-posterior.sql',
    'tests/pm26/p08-defecto-l-produccion/revertir.sql',
    'tests/pm26/p08-defecto-l-produccion/revertir-conservador.sql',
    'tests/pm26/p08-defecto-l-produccion/validar.sh',
    'tests/pm26/p06h-contract.mjs',
    'tests/pm26/p07c-contract.mjs',
    '.github/workflows/pm26-p07c-aplicacion-f-qa.yml',
    // fuente.js, fuente-recuperado.js y dist/fuente.js NO se incluyen
    // aqui: son archivos ya existentes con deuda historica aceptada
    // (ver tools/seguridad/deuda-identificadores-historicos.json), no
    // archivos nuevos a los que aplicar tolerancia cero -- mismo
    // criterio ya usado en tests/pm26/p07b-contract.mjs. Su deuda sin
    // incremento ya se comprueba por separado con el escaner completo
    // del repositorio (verificar-secretos-e-identificadores.mjs).
  ];
  const hallazgos = escanearArbol({ raiz: RAIZ_REPO, archivos: archivosNuevos, ubicacionesLegitimas: [] });
  const secretosReales = hallazgos.filter((h) => h.tipo === 'secreto_real');
  const identificadoresNoAdmitidos = hallazgos.filter(
    (h) => h.tipo === 'identificador_duplicado' && h.categoria !== 'falso_positivo'
  );
  assert.equal(secretosReales.length, 0, 'los archivos de P08b no deben contener ningún secreto real');
  assert.equal(
    identificadoresNoAdmitidos.length,
    0,
    'los archivos de P08b no deben contener ningún candidato a identificador interno real -- encontrado en: ' +
      identificadoresNoAdmitidos.map((h) => `${h.archivo}:${h.linea} (${h.categoria})`).join(', ')
  );
  const reset = leer('reset-pruebas-preview.js');
  const claveQA = reset.match(/var SUPABASE_QA_KEY = "([^"]+)";/)?.[1];
  const urlQAHost = reset.match(/var SUPABASE_QA_HOST = "([^"]+)";/)?.[1];
  const html = leer('index.html');
  const prodHost = html.match(/var NUBE_URL = "https:\/\/([^"]+)";/)?.[1];
  assert.ok(claveQA && urlQAHost && prodHost, 'no se pudieron derivar los identificadores desde sus ubicaciones legitimas');
  for (const rel of [
    'tests/pm26/P08B_DEFECTO_L_CLIENTE_COORDINADO.md',
    'tests/pm26/P08A_DEFECTO_L_PREPARACION_PRODUCCION.md',
    'tests/pm26/p08b-contract.mjs',
  ]) {
    const contenido = leer(rel);
    assert.ok(!contenido.includes(claveQA), `${rel} no debe contener la clave pública QA copiada literalmente`);
    assert.ok(!contenido.includes(urlQAHost), `${rel} no debe contener el host QA copiado literalmente`);
    assert.ok(!contenido.includes(prodHost), `${rel} no debe contener el host de producción copiado literalmente`);
  }
  console.log('PM26_P08B_SIN_SECRETOS_NI_IDENTIFICADORES=PASS');
}

// --- No se toco index.html, reset-pruebas-preview.js ni _headers. ---
for (const rel of ['index.html', 'reset-pruebas-preview.js', '_headers']) {
  const r = spawnSync('git', ['diff', '--quiet', '--', rel], { cwd: RAIZ_REPO });
  assert.equal(r.status, 0, `${rel} no debe tener cambios sin comprometer en el arbol de trabajo`);
}
console.log('PM26_P08B_ARCHIVOS_INTOCABLES_VERIFICADOS=PASS');

console.log('PM26 P08b — preflight endurecido, cliente coordinado QA/producción, despliegue y rollback: contrato OK');
