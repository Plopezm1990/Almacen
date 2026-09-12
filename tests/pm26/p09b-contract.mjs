import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// PM26 P09b: contrato de DIAGNOSTICO, no de correccion. Deriva las
// dependencias Supabase desde el release publicado y las contrasta con un
// snapshot saneado obtenido por consultas de solo lectura. No usa red, no
// contiene identificadores internos y no ejecuta SQL.

const __filename = fileURLToPath(import.meta.url);
const RAIZ = path.resolve(path.dirname(__filename), '..', '..');
const SNAPSHOT = path.join(RAIZ, 'tests/pm26/p09b-compatibilidad-release-produccion/snapshot-saneado.json');
const DOC = path.join(RAIZ, 'tests/pm26/P09B_COMPATIBILIDAD_RELEASE_PRODUCCION.md');
const snapshot = JSON.parse(fs.readFileSync(SNAPSHOT, 'utf8'));
const releaseSha = snapshot.release.commit;

function ordenados(valores) {
  return [...new Set(valores)].sort();
}

function iguales(actual, esperado, mensaje) {
  assert.deepEqual(ordenados(actual), ordenados(esperado), mensaje);
}

function gitShow(ruta) {
  return execFileSync('git', ['show', `${releaseSha}:${ruta}`], {
    cwd: RAIZ,
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  });
}

function bloqueObjeto(texto, nombre) {
  const inicio = texto.indexOf(`var ${nombre} = {`);
  assert.notEqual(inicio, -1, `falta el mapa ${nombre} en release`);
  const fin = texto.indexOf('};', inicio);
  assert.notEqual(fin, -1, `el mapa ${nombre} no termina`);
  return texto.slice(inicio, fin + 2);
}

function relacionesDesdeRelease(index, fuente) {
  const relaciones = [];
  for (const texto of [index, fuente]) {
    for (const m of texto.matchAll(/\.from\(\s*['\"]([^'\"]+)['\"]\s*\)/g)) relaciones.push(m[1]);
  }
  for (const nombre of ['TABLAS_POR_FILA', 'TABLAS_EMPRESA', 'TABLAS_EMPRESA_LOCAL']) {
    const bloque = bloqueObjeto(index, nombre);
    for (const m of bloque.matchAll(/:\s*['\"]([^'\"]+)['\"]/g)) relaciones.push(m[1]);
  }
  return ordenados(relaciones);
}

function rpcDesdeRelease(index, fuente) {
  const salida = [];
  for (const texto of [index, fuente]) {
    for (const m of texto.matchAll(/\.rpc\(\s*['\"]([^'\"]+)['\"]/g)) salida.push(m[1]);
  }
  return ordenados(salida);
}

function edgeDesdeRelease(fuente) {
  return ordenados([...fuente.matchAll(/\/functions\/v1\/([a-z0-9-]+)/g)].map((m) => m[1]));
}

function llamadasEdge(fuente, slug) {
  const aguja = `/functions/v1/${slug}`;
  const llamadas = [];
  let desde = 0;
  while (true) {
    const pos = fuente.indexOf(aguja, desde);
    if (pos === -1) break;
    const finBody = fuente.indexOf('body:', pos);
    const fin = finBody === -1 || finBody > pos + 1200 ? pos + 1200 : finBody;
    llamadas.push(fuente.slice(pos, fin));
    desde = pos + aguja.length;
  }
  return llamadas;
}

function enviaAuthorization(fuente, slug) {
  const llamadas = llamadasEdge(fuente, slug);
  assert.ok(llamadas.length > 0, `no se encontro la llamada Edge ${slug}`);
  return llamadas.every((llamada) => /\bAuthorization\s*:/.test(llamada));
}

function normalizarFirmas(valor) {
  if (!valor) return [];
  if (Array.isArray(valor[0])) return valor.map(ordenados);
  return [ordenados(valor)];
}

function firmaCompatible(parametros, firmas) {
  const actual = JSON.stringify(ordenados(parametros));
  return normalizarFirmas(firmas).some((firma) => JSON.stringify(firma) === actual);
}

function extraerObjetoDesde(texto, inicio) {
  if (inicio === -1 || texto[inicio] !== '{') return '';
  let profundidad = 0;
  let comilla = '';
  let escape = false;
  for (let i = inicio; i < texto.length; i++) {
    const c = texto[i];
    if (comilla) {
      if (escape) escape = false;
      else if (c === '\\') escape = true;
      else if (c === comilla) comilla = '';
      continue;
    }
    if (c === "'" || c === '"' || c === '`') { comilla = c; continue; }
    if (c === '{') profundidad++;
    if (c === '}' && --profundidad === 0) return texto.slice(inicio, i + 1);
  }
  return '';
}

function extraerObjetoArgumentos(texto, desde) {
  const coma = texto.indexOf(',', desde);
  if (coma === -1) return '';
  const resto = texto.slice(coma + 1).match(/^\s*([A-Za-z_$][\w$]*|\{)/);
  if (!resto) return '';
  if (resto[1] === '{') {
    return extraerObjetoDesde(texto, coma + 1 + resto[0].lastIndexOf('{'));
  }

  // Algunas llamadas construyen el payload en una constante cercana y pasan
  // su nombre a rpc(). Resolvemos exclusivamente el ultimo objeto literal
  // declarado antes de la llamada; no evaluamos JavaScript.
  const nombre = resto[1];
  const prefijo = texto.slice(0, desde);
  const declaracion = new RegExp(`(?:const|let|var)\\s+${nombre}\\s*=\\s*\\{`, 'g');
  let ultima = null;
  for (const candidata of prefijo.matchAll(declaracion)) ultima = candidata;
  if (!ultima) return '';
  const inicio = ultima.index + ultima[0].lastIndexOf('{');
  return extraerObjetoDesde(texto, inicio);
}

function parametrosRpc(textos, nombre) {
  const resultado = [];
  for (const texto of textos) {
    const regex = new RegExp(`\\.rpc\\(\\s*['\"]${nombre}['\"]`, 'g');
    for (const m of texto.matchAll(regex)) {
      const objeto = extraerObjetoArgumentos(texto, m.index + m[0].length);
      assert.ok(objeto, `no se pudieron leer los parametros de ${nombre}`);
      const claves = ordenados([...objeto.matchAll(/\b(p_[a-z0-9_]+)\s*:/gi)].map((x) => x[1]));
      if (claves.length) resultado.push(claves);
    }
  }
  assert.ok(resultado.length, `no se encontraron parametros para ${nombre}`);
  return resultado;
}

function selfTest() {
  const index = `var TABLAS_POR_FILA = { a: "uno" };\nvar TABLAS_EMPRESA = { b: "dos" };\nvar TABLAS_EMPRESA_LOCAL = { c: "tres" };\ncliente.from("cuatro");`;
  const fuente = `cliente.from("cinco"); cliente.rpc("hacer", { p_id: 1, p_datos: { x: 2 } }); fetch("https://ejemplo/functions/v1/privada", { headers: { Authorization: "Bearer x" }, body: "x" });`;
  iguales(relacionesDesdeRelease(index, fuente), ['uno', 'dos', 'tres', 'cuatro', 'cinco'], 'fallo del parser de relaciones');
  iguales(rpcDesdeRelease(index, fuente), ['hacer'], 'fallo del parser de RPC');
  iguales(parametrosRpc([fuente], 'hacer')[0], ['p_datos', 'p_id'], 'fallo del parser de parametros');
  const conVariable = `const params = { p_operation_id: 1, p_lineas: [] }; cliente.rpc("venta", params);`;
  iguales(parametrosRpc([conVariable], 'venta')[0], ['p_lineas', 'p_operation_id'], 'fallo del parser de variable de parametros');
  assert.equal(enviaAuthorization(fuente, 'privada'), true);
  console.log('PM26_P09B_PARSER_SELF_TEST=PASS');
}

if (process.env.PM26_P09B_SELF_TEST === '1') {
  selfTest();
  process.exit(0);
}

execFileSync('git', ['cat-file', '-e', `${releaseSha}^{commit}`], { cwd: RAIZ });
const index = gitShow(snapshot.release.entrada);
const fuente = gitShow(snapshot.release.fuente);
const doc = fs.readFileSync(DOC, 'utf8');

const relaciones = relacionesDesdeRelease(index, fuente);
const rpc = rpcDesdeRelease(index, fuente);
const edge = edgeDesdeRelease(fuente);

assert.equal(relaciones.length, snapshot.resultado_esperado.relaciones_requeridas);
assert.equal(rpc.length, snapshot.resultado_esperado.rpc_requeridas);
assert.equal(edge.length, snapshot.resultado_esperado.edge_requeridas);

const relacionesProd = new Set(snapshot.produccion.relaciones);
const ausentes = relaciones.filter((nombre) => !relacionesProd.has(nombre));
assert.equal(ausentes.length, snapshot.resultado_esperado.relaciones_ausentes_produccion);
iguales(ausentes, snapshot.qa.relaciones_candidatas, 'QA no cubre exactamente las relaciones ausentes de produccion');

const incompatiblesRpc = [];
for (const nombre of rpc) {
  const llamadas = parametrosRpc([index, fuente], nombre);
  const firmasProd = snapshot.produccion.rpc[nombre];
  const compatible = llamadas.every((parametros) => firmaCompatible(parametros, firmasProd));
  if (!compatible) incompatiblesRpc.push(nombre);
  const firmaQa = snapshot.qa.rpc_candidatas[nombre];
  assert.ok(firmaQa, `QA no contiene RPC candidata para ${nombre}`);
  assert.ok(llamadas.every((parametros) => firmaCompatible(parametros, firmaQa)), `la firma QA no coincide con release para ${nombre}`);
}
assert.equal(incompatiblesRpc.length, snapshot.resultado_esperado.rpc_incompatibles_produccion);

const edgeIncompatibles = edge.filter((slug) => {
  const contrato = snapshot.produccion.edge_functions[slug];
  assert.equal(contrato?.existe, true, `Edge Function ausente: ${slug}`);
  return contrato.requiere_authorization && !enviaAuthorization(fuente, slug);
});
assert.equal(edgeIncompatibles.length, snapshot.resultado_esperado.edge_incompatibles_por_authorization);
iguales(edgeIncompatibles, ['entrevista-personal', 'enviar-notificacion', 'importar-albaran', 'importar-nomina'], 'clasificacion Edge inesperada');

assert.match(doc, /DIAGNOSTICO VERIFICADO, SIN CORRECCION/i);
assert.match(doc, /no\s+autoriza\s+ni\s+aplica\s+migraciones/i);
assert.match(doc, /no\s+certifica\s+que\s+producci[óo]n\s+sea\s+compatible/i);
assert.match(doc, /21 relaciones/i);
assert.match(doc, /11 ausentes/i);
assert.match(doc, /13 RPC incompatibles/i);
assert.match(doc, /4 de 6 integraciones Edge/i);

for (const archivo of [JSON.stringify(snapshot), doc, fs.readFileSync(__filename, 'utf8')]) {
  assert.doesNotMatch(archivo, /sb_(?:publishable|secret)_[A-Za-z0-9_-]{10,}/i);
  assert.doesNotMatch(archivo, /(?<![a-z0-9])[a-z0-9]{20}(?![a-z0-9])/);
}

console.log('PM26_P09B_RELEASE_SHA_VERIFICADO=PASS');
console.log('PM26_P09B_21_RELACIONES_DERIVADAS=PASS');
console.log('PM26_P09B_11_RELACIONES_AUSENTES_PRODUCCION=PASS');
console.log('PM26_P09B_13_RPC_INCOMPATIBLES_PRODUCCION=PASS');
console.log('PM26_P09B_EDGE_AUTH_4_DE_6_INCOMPATIBLES=PASS');
console.log('PM26_P09B_QA_CONTIENE_CANDIDATOS=PASS');
console.log('PM26 P09b — diagnostico reproducible OK; no certifica correccion');
