import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { escanearArbol } from '../../tools/seguridad/verificar-secretos-e-identificadores.mjs';

// PM26 P07c: contrato reproducible del cierre real de F en QA. Las
// comprobaciones vivas se ejecutaron desde el chat y quedaron registradas en
// JSON/Markdown; este contrato no se conecta a Supabase ni Netlify y no escribe.

const __filename = fileURLToPath(import.meta.url);
const RAIZ_REPO = path.resolve(path.dirname(__filename), '..', '..');

const rutas = {
  doc: 'tests/pm26/P07C_APLICACION_F_QA_Y_PREVIEW.md',
  evidencia: 'tests/pm26/P07C_EVIDENCIA_QA.json',
  contrato: 'tests/pm26/p07c-contract.mjs',
  workflow: '.github/workflows/pm26-p07c-aplicacion-f-qa.yml',
  sql: 'supabase/qa-solo/pm26_p06h_aislamiento_prefiltros_candidatos.sql',
  preflight: 'tests/pm26/p06h-f-aislado/preflight-catalogo.sql',
};

function leer(rel) {
  return fs.readFileSync(path.join(RAIZ_REPO, rel), 'utf8');
}

function sha256(rel) {
  return crypto.createHash('sha256').update(fs.readFileSync(path.join(RAIZ_REPO, rel))).digest('hex');
}

const doc = leer(rutas.doc);
const evidencia = JSON.parse(leer(rutas.evidencia));
const sql = leer(rutas.sql);
const preflight = leer(rutas.preflight);

for (const marcador of [
  'PM26_P07C_ESTADO=CERRADO_CON_LIMITACION_VISUAL_SSO',
  'PM26_P07C_PROYECTO=L&A_SUITE_QA',
  'PM26_P07C_PREFLIGHT_ANTES=PASS',
  'PM26_P07C_APPLY_MIGRATION=SUCCESS',
  'PM26_P07C_MIGRACION_REGISTRADA_UNA_VEZ=SI',
  'PM26_P07C_PREFLIGHT_DESPUES=RECHAZADO_COMO_ESPERADO',
  'PM26_P07C_CATALOGO_Y_GRANTS=PASS',
  'PM26_P07C_PRUEBAS_FUNCIONALES_QA=14_DE_14_PASS',
  'PM26_P07C_FILAS_RESIDUALES=0',
  'PM26_P07C_OBJETOS_NO_OBJETIVO_SIN_CAMBIOS=SI',
  'PM26_P07C_PREVIEW=READY_SHA_EXACTO',
  'PM26_P07C_PREVIEW_UI=NO_VERIFICABLE_POR_SSO_GOOGLE_502',
  'PM26_P07C_EDGE_FUNCTIONS_DESPLEGADAS=NO',
  'PM26_P07C_PRODUCCION_TPV_MAIN_RELEASE_TOCADOS=NO',
]) {
  assert.ok(doc.includes(marcador), `falta el marcador ${marcador}`);
}
console.log('PM26_P07C_DOCUMENTO_Y_ESTADO=PASS');

assert.equal(evidencia.schemaVersion, 1);
assert.equal(evidencia.paquete, 'PM26-P07c');
assert.equal(evidencia.destino, 'L&A Suite QA');
assert.equal(evidencia.fuente.commit, 'a20e37d8ac74e49a31c5a9243d1256e88428366e');
assert.equal(evidencia.fuente.tree, '4c12baa76fdaf6d1572848e98bf62f5aeb322d5e');
assert.equal(evidencia.fuente.parent, '1ee5b10cc9b129f3c5ef33f28db39dea9899f969');
assert.equal(evidencia.fuente.sqlSha256, sha256(rutas.sql));
assert.equal(evidencia.fuente.preflightSha256, sha256(rutas.preflight));
for (const hash of [evidencia.fuente.sqlSha256, evidencia.fuente.preflightSha256]) {
  assert.ok(doc.includes(hash), `el documento debe contener el hash ${hash}`);
}
console.log('PM26_P07C_FUENTE_PUBLICADA_Y_HASHES=PASS');

assert.deepEqual(evidencia.migracion, {
  preflightAntes: 'PASS',
  applyMigration: 'SUCCESS',
  version: '20260910175504',
  name: 'pm26_p07c_aislamiento_prefiltros_candidatos_qa',
  count: 1,
  preflightDespues: 'RECHAZADO_COMO_ESPERADO',
});
assert.ok(doc.includes(evidencia.migracion.version));
assert.ok(doc.includes(evidencia.migracion.name));
console.log('PM26_P07C_APLICACION_UNICA_REGISTRADA=PASS');

assert.deepEqual(evidencia.catalogo.columnasNotNull, ['empresa_id', 'local_id']);
assert.equal(evidencia.catalogo.rls, true);
assert.equal(evidencia.catalogo.policy, 'prefiltros_candidatos_select_gestion');
assert.equal(evidencia.catalogo.policyRole, 'authenticated');
assert.equal(evidencia.catalogo.rpcSecurityDefiner, 2);
assert.equal(evidencia.catalogo.rpcSearchPathVacio, 2);
assert.deepEqual(evidencia.catalogo.rpcExecute, {
  public: false,
  anon: false,
  authenticated: true,
  service_role: false,
});
assert.equal(evidencia.catalogo.authenticatedDirectMutations, false);
assert.equal(evidencia.catalogo.anonTablePrivileges, false);
assert.equal(evidencia.catalogo.rowCount, 0);

assert.match(sql, /add column empresa_id text not null/);
assert.match(sql, /add column local_id text not null/);
assert.match(sql, /for select to authenticated\s+using \(private\.pm11_puede_ver_personal\(empresa_id, local_id\)\)/s);
assert.equal((sql.match(/language plpgsql security definer\s+set search_path to ''/g) || []).length, 2);
assert.equal(
  (sql.match(/revoke all on function public\.pm11_(?:crear|eliminar)_prefiltro_candidato\([^;]+\) from public, anon, authenticated, service_role;/g) || []).length,
  2
);
assert.equal(
  (sql.match(/grant execute on function public\.pm11_(?:crear|eliminar)_prefiltro_candidato\([^;]+\) to authenticated;/g) || []).length,
  2
);
assert.match(sql, /revoke insert, update, delete on public\.prefiltros_candidatos from authenticated, anon, public;/);
console.log('PM26_P07C_CATALOGO_GRANTS_Y_SQL=PASS');

assert.equal(evidencia.pruebasFuncionales.total, 14);
assert.equal(evidencia.pruebasFuncionales.passed, 14);
assert.equal(evidencia.pruebasFuncionales.residualRows, 0);
for (const [clave, valor] of Object.entries(evidencia.pruebasFuncionales)) {
  if (!['total', 'passed', 'residualRows'].includes(clave)) assert.equal(valor, true, `${clave} debe ser true`);
}
console.log('PM26_P07C_FUNCIONAL_QA_14_DE_14=PASS');

assert.deepEqual(evidencia.unaffectedFingerprints, {
  columns: '813dc4d06569f7430f41eb05f79d6f0f',
  indexes: '9d05da57749a5029a0de7ef8a76f5f59',
  policies: 'f2ab89a581cd141c90feaa265ff520ea',
  triggers: 'a8d3db545254d7886cccb762defc8c9e',
  functions: '4e13253006cf43c01e1ced2f7d7e3a4d',
  constraints: 'c7d70a8874394003a0e1f3bf2c724345',
  relationAcl: '1bbedbd3578d133371c1578f48f0ed15',
});
for (const hash of Object.values(evidencia.unaffectedFingerprints)) {
  assert.ok(doc.includes(hash), `falta la huella no objetivo ${hash}`);
}
console.log('PM26_P07C_OBJETOS_NO_OBJETIVO_IDENTICOS=PASS');

assert.equal(evidencia.preview.pullRequest, 38);
assert.equal(evidencia.preview.draft, true);
assert.equal(evidencia.preview.context, 'deploy-preview');
assert.equal(evidencia.preview.state, 'ready');
assert.equal(evidencia.preview.commitMatches, true);
assert.equal(evidencia.preview.manualDeploy, false);
assert.equal(evidencia.preview.functionsDeployed, 0);
assert.equal(evidencia.preview.edgeFunctionsDeployed, 0);
assert.equal(evidencia.preview.headerRules, 6);
assert.equal(evidencia.preview.interactiveObservation, 'BLOCKED_BY_TEAM_SSO_GOOGLE_502');
assert.ok(doc.includes(evidencia.preview.deployId));

for (const rel of [
  'source-recovery/fuente-recuperado.js',
  'fuente.js',
  'source-recovery/dist/fuente.js',
  'index.html',
  'reset-pruebas-preview.js',
  '_headers',
]) {
  assert.ok(doc.includes(sha256(rel)), `el documento no contiene el hash actual de ${rel}`);
}
const html = leer('index.html');
const reset = leer('reset-pruebas-preview.js');
assert.ok(html.indexOf('reset-pruebas-preview.js') < html.indexOf('window.NUBE_URL = NUBE_URL'));
assert.match(reset, /window\.__modoPruebasQA = true;/);
assert.match(reset, /window\.__qaFetchProduccionBloqueado = true;/);
assert.match(reset, /QA_BLOCKED_PRODUCTION_SUPABASE/);
console.log('PM26_P07C_PREVIEW_READY_SHA_Y_BARRERAS=PASS');

assert.deepEqual(evidencia.alcance, {
  productionWrites: 0,
  tpvWrites: 0,
  mainTouched: false,
  releaseTouched: false,
  productionDeploy: false,
  edgeFunctionDeploy: false,
});
assert.ok(!fs.readdirSync(path.join(RAIZ_REPO, 'supabase/migrations')).some((nombre) => /prefiltro/i.test(nombre)));

function extraerPreflight(texto, etiqueta) {
  const inicio = '-- PM26_P06H_PREFLIGHT_INICIO\n';
  const fin = '-- PM26_P06H_PREFLIGHT_FIN';
  const desde = texto.indexOf(inicio);
  const hasta = texto.indexOf(fin, desde + inicio.length);
  assert.ok(desde >= 0 && hasta > desde, `${etiqueta}: faltan marcadores del preflight`);
  return texto.slice(desde + inicio.length, hasta);
}
assert.equal(extraerPreflight(preflight, 'preflight'), extraerPreflight(sql, 'migracion'));
assert.match(preflight, /^rollback;/m);
console.log('PM26_P07C_PREFLIGHT_IDENTICO_Y_REAPLICACION_CERRADA=PASS');

const nuevos = [rutas.doc, rutas.evidencia, rutas.contrato, rutas.workflow];
const resetFuente = leer('reset-pruebas-preview.js');
const htmlFuente = leer('index.html');
const qaHost = resetFuente.match(/var SUPABASE_QA_HOST = "([^"]+)";/)?.[1];
const qaKey = resetFuente.match(/var SUPABASE_QA_KEY = "([^"]+)";/)?.[1];
const prodHost = htmlFuente.match(/var NUBE_URL = "https:\/\/([^"]+)";/)?.[1];
assert.ok(qaHost && qaKey && prodHost);
for (const rel of nuevos) {
  const contenido = leer(rel);
  assert.ok(!contenido.includes(qaHost), `${rel} no debe copiar el host QA`);
  assert.ok(!contenido.includes(qaKey), `${rel} no debe copiar la clave QA`);
  assert.ok(!contenido.includes(prodHost), `${rel} no debe copiar el host productivo`);
}
const hallazgos = escanearArbol({ raiz: RAIZ_REPO, archivos: nuevos, ubicacionesLegitimas: [] });
assert.equal(hallazgos.filter((h) => h.tipo === 'secreto_real').length, 0, 'P07c no debe publicar secretos');
assert.equal(
  hallazgos.filter((h) => h.tipo === 'identificador_duplicado' && h.categoria !== 'falso_positivo').length,
  0,
  'P07c no debe duplicar identificadores internos'
);
console.log('PM26_P07C_SIN_SECRETOS_NI_IDENTIFICADORES=PASS');

console.log('PM26 P07c — F aplicada en QA y preview validado: contrato OK');
