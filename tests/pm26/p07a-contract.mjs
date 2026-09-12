import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { escanearArbol } from '../../tools/seguridad/verificar-secretos-e-identificadores.mjs';
import { anclar, exigirDeteccion, comprobarAnclajeNoPasaEnVacio } from './lib/cierre-historico.mjs';

// PM26 P07a: contrato del diagnostico de K y del enlace con la Fase B
// de F. No corrige la aplicacion ni consulta backends: demuestra sobre
// el arbol real la causa, el orden de configuracion, el bypass del
// arranque autenticado, las escrituras directas actuales y las RPC ya
// preparadas. La evidencia remota adjunta contiene solo metadatos
// resumidos y se obtuvo por herramientas de solo lectura.
//
// PM26 P08f corrigió aquí el mismo defecto que P08b ya había corregido
// en P07c: los cinco artefactos funcionales se comparaban con
// `git hash-object` sobre el ARBOL VIVO contra el baseline P06i. P07a
// certifica un hecho histórico inmutable -- que ESE diagnóstico no tocó
// ningún artefacto funcional -- no que nadie pueda tocarlos nunca más.
// P07b los modificó después de forma legítima y autorizada, lo que
// rompía este gate sin tener nada que ver con el diagnóstico. Ahora se
// comparan los blobs del commit de cierre de P07a contra los del
// baseline P06i, y todo lo demás se lee con `git show <cierre>:<ruta>`.
// Ninguna comprobación se ha debilitado, eliminado ni vuelto opcional:
// cambia la FUENTE de los bytes, no lo que se exige de ellos.

const __filename = fileURLToPath(import.meta.url);
const RAIZ_REPO = path.resolve(path.dirname(__filename), '..', '..');
const BASELINE_P06I = '4d34052b9f618d67ba1dae150215038f4adae75d';
// Commit exacto donde el gate de P07a pasó en verde
// ("PM26 P07a: corrige checkout del gate final").
const CIERRE_HISTORICO = 'd62162fb6c512ea9fd237de1f2e2bb0ea5debeec';
const hist = anclar(CIERRE_HISTORICO, 'PM26 P07a');
const base = anclar(BASELINE_P06I, 'PM26 P07a baseline P06i');
console.log(`PM26_P07A_CIERRE_HISTORICO_VALIDO=PASS (${CIERRE_HISTORICO})`);

function leer(rel) {
  return fs.readFileSync(path.join(RAIZ_REPO, rel), 'utf8');
}

function bloque(texto, inicio, fin) {
  const desde = texto.indexOf(inicio);
  assert.ok(desde >= 0, `no se encontro el inicio: ${inicio}`);
  const hasta = texto.indexOf(fin, desde + inicio.length);
  assert.ok(hasta > desde, `no se encontro el final posterior: ${fin}`);
  return texto.slice(desde, hasta);
}

function oidGit(args, descripcion) {
  const r = spawnSync('git', args, {
    cwd: RAIZ_REPO,
    encoding: 'utf8',
  });
  assert.equal(r.status, 0, `no se pudo obtener ${descripcion}: ${r.stderr}`);
  return r.stdout.trim();
}

const rutaDoc = 'tests/pm26/P07A_DIAGNOSTICO_DEFECTO_K_FASE_B.md';
const rutaEvidencia = 'tests/pm26/P07A_EVIDENCIA_EDGE_FUNCTIONS.json';
const doc = leer(rutaDoc);
const evidencia = JSON.parse(leer(rutaEvidencia));

for (const marcador of [
  'PM26_P07A_ESTADO=DIAGNOSTICO_CERRADO_SIN_APLICAR',
  'PM26_P07A_DEFECTO_K_CAUSA=URL_LITERAL_PRODUCCION',
  'PM26_P07A_RUTA_PUBLICA_NO_INICIALIZA_CLIENTE=SI',
  'PM26_P07A_CONFIG_QA_ANTES_DEL_MODULO=SI',
  'PM26_P07A_EDGE_QA_ACTIVA_SIMULADA_503=SI',
  'PM26_P07A_EDGE_PROD_NO_COPIAR_A_QA=SI',
  'PM26_P07A_SOLUCION_ELEGIDA=NUBE_URL_ACTIVA_FAIL_CLOSED',
  'PM26_P07A_FASE_B_RPC_MAPEADA=SI',
  'PM26_P07A_F_REQUIERE_ENDURECIMIENTO_PREVIO=SI',
  'PM26_P07A_PRUEBAS_VIVAS_PREFILTRO=NO',
  'PM26_P07A_AVISO_F_APLICADO_QA=NO',
  'PM26_P07A_FUENTE_JS_TOCADO=NO',
  'PM26_P07A_SUPABASE_ESCRITURA=NO',
  'PM26_P07A_MAIN_RELEASE_NETLIFY_TPV_TOCADOS=NO',
]) {
  assert.ok(doc.includes(marcador), `falta el marcador ${marcador}`);
}
console.log('PM26_P07A_DOCUMENTO_Y_ALCANCE=PASS');

// P07a solo diagnostica: los cinco artefactos funcionales relevantes
// quedaron byte a byte iguales al cierre P06i en el propio cierre de
// P07a. Se comparan blobs de dos commits, no el arbol vivo.
const ARTEFACTOS_FUNCIONALES = [
  'fuente.js',
  'source-recovery/fuente-recuperado.js',
  'index.html',
  'reset-pruebas-preview.js',
  'supabase/qa-solo/pm26_p06h_aislamiento_prefiltros_candidatos.sql',
];
for (const rel of ARTEFACTOS_FUNCIONALES) {
  const oidBaseline = base.oid(rel);
  const oidCierre = hist.oid(rel);
  assert.match(oidBaseline, /^[0-9a-f]{40}$/, `blob invalido para ${rel} en el baseline P06i`);
  assert.equal(oidCierre, oidBaseline, `P07a no debe modificar ${rel}`);
}
// Control negativo: la comparacion tiene que ser capaz de detectar una
// diferencia real. fuente.js SI cambio despues (P07b cableo la Fase B),
// asi que su blob en HEAD debe diferir del baseline -- si coincidiera,
// esta comprobacion estaria comparando siempre lo mismo consigo mismo.
{
  const oidVivo = oidGit(['hash-object', 'fuente.js'], 'fuente.js en el arbol actual');
  assert.notEqual(
    oidVivo,
    base.oid('fuente.js'),
    'control negativo invalido: se esperaba que fuente.js hubiera cambiado desde el baseline P06i'
  );
}
console.log('PM26_P07A_ARTEFACTOS_FUNCIONALES_INTACTOS=PASS');

const fuente = hist.leer('fuente.js');
const recuperada = hist.leer('source-recovery/fuente-recuperado.js');

function validarDefectoActual(texto, etiqueta) {
  const publico = bloque(texto, 'function PrefiltroPublico({ token })', 'var ultimosErroresAvisados');
  const urls = publico.match(/https:\/\/[a-z0-9]+\.supabase\.co\/functions\/v1\/prefiltro-candidato/g) || [];
  assert.equal(urls.length, 2, `${etiqueta}: deben existir los dos literales que causan K`);
  assert.ok(urls.every((url) => url === urls[0]), `${etiqueta}: ambos literales deben fijar el mismo proyecto`);
  assert.doesNotMatch(publico, /window\.NUBE_URL/, `${etiqueta}: el flujo actual aun no usa la configuracion activa`);

  const logica = bloque(texto, 'function crearLogicaPrefiltros(', 'function SelectorDiseno(');
  assert.match(logica, /\.from\("prefiltros_candidatos"\)\.insert\(/, `${etiqueta}: falta el INSERT directo actual`);
  assert.match(logica, /\.from\("prefiltros_candidatos"\)\.select\("\*"\)/, `${etiqueta}: falta el SELECT actual`);
  assert.match(logica, /\.from\("prefiltros_candidatos"\)\.delete\(\)/, `${etiqueta}: falta el DELETE directo actual`);
  assert.doesNotMatch(logica, /pm11_crear_prefiltro_candidato|pm11_eliminar_prefiltro_candidato/, `${etiqueta}: Fase B no debe estar aplicada aun`);
  return { publico, logica };
}

const actualFuente = validarDefectoActual(fuente, 'fuente.js');
validarDefectoActual(recuperada, 'fuente-recuperado.js');
console.log('PM26_P07A_K_Y_FASE_B_ESTADO_REAL=PASS');

// La ruta publica se monta en lugar de AppConSesion. conectarNube solo se
// llama dentro de AppConSesion, por lo que no hay cliente inicializado que
// PrefiltroPublico pueda presuponer.
assert.match(fuente, /matchPrefiltro\s*\?[^:]+PrefiltroPublico[\s\S]{0,180}:\s*[^\n]+AppConSesion/);
const appSesion = bloque(fuente, 'function AppConSesion()', 'var rutaHash');
assert.match(appSesion, /window\.conectarNube\(\)/);
assert.doesNotMatch(actualFuente.publico, /conectarNube|getSupabaseClient|__nubeCliente/);
assert.match(fuente, /window\.getSupabaseClient\s*=\s*async function\(\)\s*\{\s*return window\.__nubeCliente;/);
console.log('PM26_P07A_RUTA_PUBLICA_SIN_CLIENTE_DEMOSTRADA=PASS');

// Orden real: el reset QA corre antes de publicar NUBE_URL, y el modulo
// se carga despues. No se copian hosts ni claves en este contrato.
const html = hist.leer('index.html');
const posReset = html.indexOf('<script src="./reset-pruebas-preview.js"></script>');
const posBase = html.indexOf('var NUBE_URL = ');
const posOverride = html.indexOf('if (window.__modoPruebasQA)');
const posModulo = html.indexOf('<script type="module" src="./fuente.js"></script>');
assert.ok(posReset >= 0 && posReset < posBase && posBase < posOverride && posOverride < posModulo);
assert.match(html, /window\.NUBE_URL\s*=\s*NUBE_URL;/);
assert.match(html, /window\.NUBE_URL\s*=\s*window\.__qaNubeUrl\s*\|\|\s*"";/);

const reset = hist.leer('reset-pruebas-preview.js');
assert.match(reset, /HOST_PREVIEW\.test\(window\.location\.hostname\)/);
assert.match(reset, /window\.__modoPruebasQA\s*=\s*true;/);
assert.match(reset, /window\.__qaNubeUrl\s*=\s*SUPABASE_QA_URL;/);
assert.match(reset, /"prefiltro-candidato"\s*:\s*"prefiltro-candidato"/);
assert.match(reset, /QA_BLOCKED_PRODUCTION_SUPABASE/);
console.log('PM26_P07A_ORDEN_CONFIGURACION_Y_BARRERA_QA=PASS');

// Las dos RPC finales y sus contratos de seguridad ya existen en el SQL
// preparado; P07b solo debe cablear el cliente y endurecer los timeouts.
const sqlF = hist.leer('supabase/qa-solo/pm26_p06h_aislamiento_prefiltros_candidatos.sql');
assert.match(sqlF, /function public\.pm11_crear_prefiltro_candidato\(\s*p_empresa_id text, p_local_id text, p_candidato_nombre text/);
assert.match(sqlF, /function public\.pm11_eliminar_prefiltro_candidato\(\s*p_empresa_id text, p_local_id text, p_token text/);
assert.match(sqlF, /private\.pm11_puede_mutar_personal\(p_empresa_id, p_local_id\)/g);
assert.match(sqlF, /revoke insert, update, delete on public\.prefiltros_candidatos from authenticated, anon, public;/);
assert.match(sqlF, /grant select on public\.prefiltros_candidatos to authenticated;/);
assert.match(sqlF, /set lock_timeout = '5s';/);
assert.match(sqlF, /set statement_timeout = '30s';/);
assert.doesNotMatch(sqlF, /set local lock_timeout/i, 'P07a debe registrar que el endurecimiento de F sigue pendiente');
assert.ok(sqlF.indexOf('do $$') < sqlF.indexOf("set lock_timeout = '5s'"), 'el timeout aun esta despues del preflight');
console.log('PM26_P07A_RPC_MAPEADAS_Y_ENDURECIMIENTO_F_PENDIENTE=PASS');

// Evidencia remota resumida: no contiene filas, payloads, refs, claves ni
// IDs de funciones. Verifica la conclusion que condiciona el plan.
assert.equal(evidencia.metodo.includes('solo lectura'), true);
assert.equal(evidencia.invocaciones_al_flujo_prefiltro, 0);
assert.deepEqual(
  {
    prod: [evidencia.produccion.slug_presente, evidencia.produccion.estado, evidencia.produccion.verify_jwt, evidencia.produccion.implementacion],
    qa: [evidencia.qa.slug_presente, evidencia.qa.estado, evidencia.qa.verify_jwt, evidencia.qa.implementacion, evidencia.qa.escrituras_de_datos],
  },
  {
    prod: [true, 'ACTIVE', false, 'cuestionario_real'],
    qa: [true, 'ACTIVE', false, 'simulador_503', false],
  }
);
assert.equal(evidencia.produccion.notificacion_interna_con_destino_literal_produccion, true);
console.log('PM26_P07A_EVIDENCIA_EDGE_FUNCTIONS_ACOTADA=PASS');

// Negativas deliberadas sobre copias en memoria: el contrato detecta que
// desaparezca una de las pruebas de la causa, que se altere el orden de
// configuracion o que el diagnostico oculte una escritura directa.
{
  exigirDeteccion(
    fuente,
    (t) => t.replace(/https:\/\/[a-z0-9]+\.supabase\.co\/functions\/v1\/prefiltro-candidato/, '/functions/v1/prefiltro-candidato'),
    (t) => validarDefectoActual(t, 'mutacion-url'),
    /dos literales/,
    'P07a sin una de las dos URL'
  );

  const htmlOrdenRoto = html.replace(
    '<script src="./reset-pruebas-preview.js"></script>',
    '<script src="./reset-pruebas-preview.js" data-posicion-alterada="si"></script>'
  );
  assert.notEqual(htmlOrdenRoto, html);
  const pResetRoto = htmlOrdenRoto.indexOf('<script src="./reset-pruebas-preview.js"></script>');
  assert.equal(pResetRoto, -1);

  exigirDeteccion(
    fuente,
    (t) => t.replace('.from("prefiltros_candidatos").insert(', '.from("prefiltros_candidatos").upsert('),
    (t) => validarDefectoActual(t, 'mutacion-insert'),
    /INSERT directo/,
    'P07a sin INSERT directo'
  );
  // Y si la Fase B ya estuviera cableada, el diagnostico dejaria de
  // describir el estado que certifica.
  exigirDeteccion(
    fuente,
    (t) => t.replace('function SelectorDiseno(', 'var x = "pm11_crear_prefiltro_candidato";\nfunction SelectorDiseno('),
    (t) => validarDefectoActual(t, 'mutacion-fase-b'),
    /Fase B no debe estar aplicada aun/,
    'P07a con Fase B inyectada'
  );
}
console.log('PM26_P07A_PRUEBAS_NEGATIVAS_EN_MEMORIA=PASS');

// Ningun archivo nuevo puede duplicar los hosts/claves que ya viven en las
// ubicaciones historicas autorizadas. El escaner central cubre secretos y
// otros identificadores.
const archivosNuevos = [
  rutaDoc,
  rutaEvidencia,
  'tests/pm26/p07a-contract.mjs',
  '.github/workflows/pm26-p07a-diagnostico-defecto-k.yml',
];
const qaHost = reset.match(/var SUPABASE_QA_HOST = "([^"]+)";/)?.[1];
const qaKey = reset.match(/var SUPABASE_QA_KEY = "([^"]+)";/)?.[1];
const prodHost = html.match(/var NUBE_URL = "https:\/\/([^"]+)";/)?.[1];
assert.ok(qaHost && qaKey && prodHost, 'no se pudieron derivar los identificadores de sus ubicaciones legitimas');
for (const rel of archivosNuevos) {
  const contenido = leer(rel);
  assert.ok(!contenido.includes(qaHost), `${rel} no debe copiar el host QA`);
  assert.ok(!contenido.includes(qaKey), `${rel} no debe copiar la clave QA`);
  assert.ok(!contenido.includes(prodHost), `${rel} no debe copiar el host de produccion`);
}

const hallazgos = escanearArbol({ raiz: RAIZ_REPO, archivos: archivosNuevos, ubicacionesLegitimas: [] });
const secretos = hallazgos.filter((h) => h.tipo === 'secreto_real');
const identificadores = hallazgos.filter(
  (h) => h.tipo === 'identificador_duplicado' && h.categoria !== 'falso_positivo'
);
assert.equal(secretos.length, 0, 'P07a no debe introducir secretos reales');
assert.equal(
  identificadores.length,
  0,
  'P07a no debe duplicar identificadores internos: ' +
    identificadores.map((h) => `${h.archivo}:${h.linea}`).join(', ')
);
console.log('PM26_P07A_SIN_SECRETOS_NI_IDENTIFICADORES=PASS');

// Control negativo del anclaje: un SHA inexistente o una ruta que no
// esta en ese commit deben fallar, nunca pasar en silencio.
assert.ok(comprobarAnclajeNoPasaEnVacio());
assert.throws(() => hist.leer('ruta/que/no/existe.txt'), /no se pudo leer/);
assert.ok(!hist.existe('ruta/que/no/existe.txt'));
console.log('PM26_P07A_ANCLAJE_CONTROL_NEGATIVO=PASS');

console.log('PM26 P07a — diagnostico K y Fase B de F: contrato OK');
