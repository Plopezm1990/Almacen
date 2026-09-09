import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// PM26 P02: verifica que el escáner centralizado de secretos e
// identificadores funciona de verdad -- comprueba el CÓDIGO DE SALIDA de
// procesos reales, nunca solo la presencia de un texto "PASS". También
// verifica que el documento de cierre está completo y no publica ningún
// valor real.

const __filename = fileURLToPath(import.meta.url);
const RAIZ_REPO = path.resolve(path.dirname(__filename), '..', '..');
const RUTA_ESCANER = path.join(RAIZ_REPO, 'tools/seguridad/verificar-secretos-e-identificadores.mjs');

// --- Prueba positiva: el repositorio real, en su estado actual, produce
// código de salida 0. ---
{
  const r = spawnSync('node', [RUTA_ESCANER, 'verificar'], { cwd: RAIZ_REPO, encoding: 'utf8' });
  assert.equal(r.status, 0, `esperado código de salida 0 sobre el repositorio real, obtenido ${r.status}\n${r.stdout}\n${r.stderr}`);
  assert.match(r.stdout, /VERIFICAR_SECRETOS=PASS/);
  console.log('PM26_P02_PRUEBA_POSITIVA=PASS (código de salida 0 sobre el repositorio real)');
}

// --- Prueba negativa: un directorio temporal AISLADO (nunca el
// repositorio, nunca añadido a git) con un marcador sintético produce un
// código de salida distinto de cero. El marcador no se parece a una
// credencial real (letras repetidas) y el directorio se borra siempre,
// pase o falle la prueba. ---
{
  const dirTemporal = fs.mkdtempSync(path.join(os.tmpdir(), 'pm26-p02-prueba-negativa-'));
  try {
    // Marcador sintético con FORMA de JWT (eyJ + 3 segmentos), construido a
    // partir de letras repetidas -- nunca una credencial operativa real ni
    // copiado de ningún valor visto en el repositorio.
    const marcadorSintetico = 'eyJ' + 'X'.repeat(25) + '.' + 'Y'.repeat(15) + '.' + 'Z'.repeat(15);
    fs.writeFileSync(path.join(dirTemporal, 'marcador-sintetico.txt'), `token de prueba: ${marcadorSintetico}\n`);

    const r = spawnSync('node', [RUTA_ESCANER, 'escanear-ruta', dirTemporal], { encoding: 'utf8' });
    assert.notEqual(r.status, 0, `esperado código de salida distinto de cero con un marcador sintético presente, obtenido ${r.status}`);
    assert.equal(r.status, 2, `el escáner debe devolver específicamente el código 2 para un secreto real, obtenido ${r.status}`);
  } finally {
    fs.rmSync(dirTemporal, { recursive: true, force: true });
  }
  console.log('PM26_P02_PRUEBA_NEGATIVA=PASS (código de salida != 0 con marcador sintético, directorio temporal eliminado)');
}

// --- Prueba de control: un directorio temporal aislado SIN ningún
// marcador produce código de salida 0 (confirma que escanear-ruta no
// falla espuriamente). ---
{
  const dirTemporal = fs.mkdtempSync(path.join(os.tmpdir(), 'pm26-p02-prueba-control-'));
  try {
    fs.writeFileSync(path.join(dirTemporal, 'limpio.txt'), 'contenido sin nada sensible\n');
    const r = spawnSync('node', [RUTA_ESCANER, 'escanear-ruta', dirTemporal], { encoding: 'utf8' });
    assert.equal(r.status, 0, `esperado código de salida 0 sobre un directorio limpio, obtenido ${r.status}`);
  } finally {
    fs.rmSync(dirTemporal, { recursive: true, force: true });
  }
  console.log('PM26_P02_PRUEBA_CONTROL=PASS (directorio aislado sin marcador -> salida 0)');
}

// --- El documento de cierre está completo y preciso ---
const doc = fs.readFileSync('tests/pm26/P02_REPARACION_GATES_SECRETOS.md', 'utf8');

assert.match(doc, /PM26_P02_ESTADO=CERRADO/);
assert.match(doc, /PM26_P02_SECRETOS_REALES_ENCONTRADOS=0/);
assert.match(doc, /PM26_P02_ARCHIVOS_CORREGIDOS=5/);
assert.match(doc, /PM26_P02_HISTORIA_GIT_REESCRITA=NO/);
assert.match(doc, /PM26_P02_ROTACION_SOLICITADA_POR_REFS=NO/);
assert.match(doc, /PM26_P02_MAIN_TOCADO=NO/);
assert.match(doc, /PM26_P02_FUENTE_JS_TOCADO=NO/);
assert.match(doc, /PM26_P02_NETLIFY_SUPABASE_TOCADO=NO/);

// El defecto J original está citado.
assert.match(doc, /Defecto J/);
assert.match(doc, /solo(\s|>)+inspecciona(\s|>)+los(\s|>)+`?\.md`?/i);

// La discrepancia de alcance (5 -> ~100 archivos) queda registrada.
assert.match(doc, /63\s+archivos\s+adicionales/i);

// Las cinco categorías de clasificación están documentadas.
for (const categoria of ['secreto_real', 'configuracion_publica_legitima', 'termino_tecnico', 'falso_positivo', 'identificador_interno_historico']) {
  assert.match(doc, new RegExp('`' + categoria + '`'), `falta documentar la categoría ${categoria}`);
}

// No se afirma "limpios" para la deuda -- se afirma "inventariados y clasificados".
assert.match(doc, /No se afirma que los 63 archivos de deuda est[ée]n\s+"?limpios"?/i);
assert.match(doc, /inventariados y clasificados/i);

// Precisión sobre el historial de Git (instrucción 12).
assert.match(doc, /no se ha reescrito ni purgado el historial/i);
assert.match(doc, /no los elimina de\s+los commits anteriores/i);

// Precisión sobre rotación de claves (instrucción 13).
assert.match(doc, /No se solicita rotaci[óo]n de ninguna clave [úu]nicamente por la presencia de\s+project refs/i);

// Qué NO cambia: los cierres funcionales de PM24/PM25 no se reabren.
assert.match(doc, /siguen siendo\s+\*?\*?v[áa]lidos\*?\*?/i);
assert.match(doc, /no se re-ejecutan sus pruebas en vivo contra\s+QA real/i);

// PM25 P02 sigue arrastrado.
assert.match(doc, /PM25 P02 sigue \*?\*?PARCIAL\/BLOQUEADO/i);

// --- Sin valores reales publicados en el documento ni en el propio escáner ---
const escaner = fs.readFileSync(RUTA_ESCANER, 'utf8');
const patronesValorReal = [
  /flqercbgpgmmfaakrwkc/,
  /qjqorixtkilwsndqayyx/,
  /cqtghwiuxrqrxupyonqf/,
  /sb_publishable_[A-Za-z0-9_-]{10,}/,
  /sb_secret_[A-Za-z0-9_-]{10,}/i,
];
for (const patron of patronesValorReal) {
  assert.doesNotMatch(doc, patron, 'no debe publicarse un valor real en el documento de cierre: ' + patron);
  assert.doesNotMatch(escaner, patron, 'el propio escáner no debe contener ningún valor real: ' + patron);
}

// --- Los ledgers existen, tienen forma correcta y no contienen valores ---
const lineaBase = JSON.parse(fs.readFileSync('tools/seguridad/linea-base-aceptada.json', 'utf8'));
const deuda = JSON.parse(fs.readFileSync('tools/seguridad/deuda-identificadores-historicos.json', 'utf8'));
assert.ok(Array.isArray(lineaBase.entradas) && lineaBase.entradas.length > 0);
assert.ok(Array.isArray(deuda.entradas) && deuda.entradas.length > 0);
for (const entrada of [...lineaBase.entradas, ...deuda.entradas]) {
  assert.ok(typeof entrada.archivo === 'string');
  assert.ok(typeof entrada.categoria === 'string');
  assert.ok(Number.isInteger(entrada.cantidad) && entrada.cantidad > 0);
  assert.ok(Array.isArray(entrada.huellas) && entrada.huellas.every((h) => /^[0-9a-f]{16}$/.test(h)));
}
// Ninguna entrada de deuda usa una categoría admisible como línea base.
for (const entrada of deuda.entradas) {
  assert.equal(entrada.categoria, 'identificador_interno_historico');
}
// Ninguna entrada de línea base usa la categoría de deuda.
for (const entrada of lineaBase.entradas) {
  assert.notEqual(entrada.categoria, 'identificador_interno_historico');
  assert.notEqual(entrada.categoria, 'secreto_real');
}

console.log('PM26_P02_DOC_VERIFICADO=PASS');
console.log('PM26_P02_LEDGERS_VERIFICADOS=PASS');
console.log('PM26_P02_SIN_VALORES_REALES=PASS');
console.log('PM26 P02 — reparación de gates de secretos e identificadores: contrato OK');
