import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { escanearArbol } from '../../tools/seguridad/verificar-secretos-e-identificadores.mjs';

// PM26 P02: verifica que el escáner centralizado de secretos e
// identificadores funciona de verdad -- comprueba el CÓDIGO DE SALIDA de
// procesos reales, nunca solo la presencia de un texto "PASS", y que la
// comparación contra los ledgers es EXACTA (archivo + categoría + cantidad
// + conjunto de huellas), no solo "¿ya se vio esta huella en algún sitio?".
// También verifica, de forma estructural (nunca por valor literal), que
// ni el documento de cierre ni el propio escáner ni este contrato
// contienen un candidato a identificador fuera de sus ubicaciones
// legítimas.

const __filename = fileURLToPath(import.meta.url);
const RAIZ_REPO = path.resolve(path.dirname(__filename), '..', '..');
const RUTA_ESCANER = path.join(RAIZ_REPO, 'tools/seguridad/verificar-secretos-e-identificadores.mjs');

/** Crea un directorio temporal aislado con los archivos dados y devuelve
 * su ruta más una función de limpieza. Nunca toca el repositorio ni git. */
function crearArbolAislado(archivos) {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'pm26-p02-'));
  for (const [rel, contenido] of Object.entries(archivos)) {
    const abs = path.join(raiz, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, contenido);
  }
  return { raiz, limpiar: () => fs.rmSync(raiz, { recursive: true, force: true }) };
}

function ejecutarEscaner(args, opciones = {}) {
  return spawnSync('node', [RUTA_ESCANER, ...args], { encoding: 'utf8', ...opciones });
}

// Candidato sintético con FORMA de project ref (20 alfanuméricos en
// minúsculas), construido con letras repetidas -- nunca copiado de ningún
// valor real visto en este repositorio ni parecido a una credencial.
const CANDIDATO_SINTETICO_A = 'a'.repeat(20);
const CANDIDATO_SINTETICO_B = 'b'.repeat(20);

// --- Prueba positiva: el repositorio real, en su estado actual, produce
// código de salida 0 sobre TODO el árbol. ---
{
  const r = ejecutarEscaner(['verificar'], { cwd: RAIZ_REPO });
  assert.equal(r.status, 0, `esperado código de salida 0 sobre el repositorio real, obtenido ${r.status}\n${r.stdout}\n${r.stderr}`);
  assert.match(r.stdout, /VERIFICAR_SECRETOS=PASS/);
  console.log('PM26_P02_PRUEBA_POSITIVA=PASS (código de salida 0 sobre el repositorio real completo)');
}

// --- Negativa 1: secreto real sintético -> fallo, sin imprimir el valor. ---
{
  const marcadorSintetico = 'eyJ' + 'X'.repeat(25) + '.' + 'Y'.repeat(15) + '.' + 'Z'.repeat(15);
  const { raiz, limpiar } = crearArbolAislado({ 'marcador-sintetico.txt': `token de prueba: ${marcadorSintetico}\n` });
  try {
    const r = ejecutarEscaner(['escanear-ruta', raiz]);
    assert.equal(r.status, 2, `esperado código de salida 2 con un secreto sintético presente, obtenido ${r.status}`);
    assert.doesNotMatch(r.stdout + r.stderr, new RegExp(marcadorSintetico.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), 'el mensaje de error no debe imprimir el valor del secreto');
  } finally {
    limpiar();
  }
  console.log('PM26_P02_NEGATIVA_1_SECRETO_REAL=PASS (código 2, valor no impreso)');
}

// --- Negativa 2: identificador sintético nuevo, fuera de cualquier ledger -> fallo. ---
{
  const { raiz, limpiar } = crearArbolAislado({
    'archivo.js': `const ref = "${CANDIDATO_SINTETICO_A}"; // candidato nuevo, sin registrar\n`,
  });
  const rutaLB = path.join(raiz, 'linea-base.json');
  const rutaDeuda = path.join(raiz, 'deuda.json');
  fs.writeFileSync(rutaLB, JSON.stringify({ entradas: [] }));
  fs.writeFileSync(rutaDeuda, JSON.stringify({ entradas: [] }));
  try {
    const r = ejecutarEscaner(['verificar', `--raiz=${raiz}`, `--linea-base=${rutaLB}`, `--deuda=${rutaDeuda}`, '--sin-git=true']);
    assert.notEqual(r.status, 0, `esperado código de salida distinto de cero para una aparición nueva, obtenido ${r.status}`);
    assert.match(r.stderr, /aparicion_nueva_fuera_de_ledger/);
    assert.doesNotMatch(r.stdout + r.stderr, new RegExp(CANDIDATO_SINTETICO_A), 'el mensaje de error no debe imprimir el valor del candidato');
  } finally {
    limpiar();
  }
  console.log('PM26_P02_NEGATIVA_2_APARICION_NUEVA=PASS');
}

// --- Negativa 3: segunda aparición del MISMO identificador conocido en el
// mismo archivo (misma huella, cantidad distinta) -> fallo. La comparación
// solo por huella no lo detectaría; la comparación por cantidad sí. ---
{
  const { raiz, limpiar } = crearArbolAislado({
    'archivo.js': `const ref = "${CANDIDATO_SINTETICO_B}";\n`,
  });
  const rutaLB = path.join(raiz, 'linea-base.json');
  const rutaDeuda = path.join(raiz, 'deuda.json');
  fs.writeFileSync(rutaLB, JSON.stringify({ entradas: [] }));
  fs.writeFileSync(rutaDeuda, JSON.stringify({ entradas: [] }));
  const regen1 = ejecutarEscaner(['regenerar-ledgers', `--raiz=${raiz}`, `--linea-base=${rutaLB}`, `--deuda=${rutaDeuda}`, '--sin-git=true']);
  assert.equal(regen1.status, 0, 'la primera generación del ledger debe tener éxito');

  const verificacionPrevia = ejecutarEscaner(['verificar', `--raiz=${raiz}`, `--linea-base=${rutaLB}`, `--deuda=${rutaDeuda}`, '--sin-git=true']);
  assert.equal(verificacionPrevia.status, 0, 'el ledger recién generado debe verificar en verde');

  // Añadimos una SEGUNDA aparición del mismo valor en el mismo archivo,
  // sin regenerar el ledger.
  fs.appendFileSync(path.join(raiz, 'archivo.js'), `const otraVez = "${CANDIDATO_SINTETICO_B}";\n`);
  try {
    const r = ejecutarEscaner(['verificar', `--raiz=${raiz}`, `--linea-base=${rutaLB}`, `--deuda=${rutaDeuda}`, '--sin-git=true']);
    assert.notEqual(r.status, 0, `esperado código de salida distinto de cero ante una repetición no registrada, obtenido ${r.status}`);
    assert.match(r.stderr, /cantidad_distinta/);
    assert.doesNotMatch(r.stdout + r.stderr, new RegExp(CANDIDATO_SINTETICO_B), 'el mensaje de error no debe imprimir el valor del identificador');
  } finally {
    limpiar();
  }
  console.log('PM26_P02_NEGATIVA_3_REPETICION_MISMO_ARCHIVO=PASS (la sola huella no basta -- la cantidad lo detecta)');
}

// --- Negativa 4: edición manual del ledger (cantidad o categoría
// alteradas a mano, sin que el árbol haya cambiado realmente) -> fallo. ---
{
  const { raiz, limpiar } = crearArbolAislado({
    'archivo.js': `const ref = "${CANDIDATO_SINTETICO_A}";\n`,
  });
  const rutaLB = path.join(raiz, 'linea-base.json');
  const rutaDeuda = path.join(raiz, 'deuda.json');
  fs.writeFileSync(rutaLB, JSON.stringify({ entradas: [] }));
  fs.writeFileSync(rutaDeuda, JSON.stringify({ entradas: [] }));
  ejecutarEscaner(['regenerar-ledgers', `--raiz=${raiz}`, `--linea-base=${rutaLB}`, `--deuda=${rutaDeuda}`, '--sin-git=true']);

  // Edición manual: se sube la cantidad registrada sin que el árbol tenga
  // en realidad una segunda aparición.
  const deudaDoc = JSON.parse(fs.readFileSync(rutaDeuda, 'utf8'));
  assert.equal(deudaDoc.entradas.length, 1);
  deudaDoc.entradas[0].cantidad = 5; // manipulación manual
  fs.writeFileSync(rutaDeuda, JSON.stringify(deudaDoc));
  try {
    const r = ejecutarEscaner(['verificar', `--raiz=${raiz}`, `--linea-base=${rutaLB}`, `--deuda=${rutaDeuda}`, '--sin-git=true']);
    assert.notEqual(r.status, 0, `esperado código de salida distinto de cero tras editar la cantidad a mano, obtenido ${r.status}`);
    assert.match(r.stderr, /cantidad_distinta/);
  } finally {
    limpiar();
  }
  console.log('PM26_P02_NEGATIVA_4A_CANTIDAD_MANIPULADA=PASS');
}
{
  const { raiz, limpiar } = crearArbolAislado({
    'archivo.js': `const ref = "${CANDIDATO_SINTETICO_A}";\n`,
  });
  const rutaLB = path.join(raiz, 'linea-base.json');
  const rutaDeuda = path.join(raiz, 'deuda.json');
  fs.writeFileSync(rutaLB, JSON.stringify({ entradas: [] }));
  fs.writeFileSync(rutaDeuda, JSON.stringify({ entradas: [] }));
  ejecutarEscaner(['regenerar-ledgers', `--raiz=${raiz}`, `--linea-base=${rutaLB}`, `--deuda=${rutaDeuda}`, '--sin-git=true']);

  // Edición manual: se reclasifica a mano de deuda a línea base sin que el
  // escáner lo haya decidido así.
  const deudaDoc = JSON.parse(fs.readFileSync(rutaDeuda, 'utf8'));
  const lbDoc = JSON.parse(fs.readFileSync(rutaLB, 'utf8'));
  const entrada = deudaDoc.entradas.pop();
  entrada.categoria = 'configuracion_publica_legitima'; // manipulación manual
  lbDoc.entradas.push(entrada);
  fs.writeFileSync(rutaDeuda, JSON.stringify(deudaDoc));
  fs.writeFileSync(rutaLB, JSON.stringify(lbDoc));
  try {
    const r = ejecutarEscaner(['verificar', `--raiz=${raiz}`, `--linea-base=${rutaLB}`, `--deuda=${rutaDeuda}`, '--sin-git=true']);
    assert.notEqual(r.status, 0, `esperado código de salida distinto de cero tras reclasificar a mano, obtenido ${r.status}`);
    // El escáner re-deriva la categoría real (identificador_interno_historico)
    // desde el contenido, así que la entrada movida a línea base ya no
    // coincide con nada en el árbol re-escaneado con esa categoría, y la
    // categoría real ya no aparece en la deuda -- ambos lados discrepan.
    assert.match(r.stderr, /registrado_en_ledger_pero_ya_no_aparece|aparicion_nueva_fuera_de_ledger/);
  } finally {
    limpiar();
  }
  console.log('PM26_P02_NEGATIVA_4B_CATEGORIA_MANIPULADA=PASS');
}

// --- Negativa 5: envolver el identificador en un comentario, una regex JS
// o un assert NO lo convierte en termino_tecnico -- sigue siendo
// identificador_interno_historico (o configuracion_publica_legitima si
// estuviera en una ubicación legítima, que aquí no lo está). ---
{
  const contenido = [
    `// patronesSecreto de ejemplo (autorreferencial, como en un contrato real)`,
    `const patronesSecreto = [`,
    `  /${CANDIDATO_SINTETICO_A}/,`,
    `];`,
    `assert.doesNotMatch(doc, /${CANDIDATO_SINTETICO_A}/, 'no debe publicarse: ' + '${CANDIDATO_SINTETICO_A}');`,
    '',
  ].join('\n');
  // Escaneamos el contenido directamente vía un archivo temporal aislado
  // (no el repositorio) para comprobar la clasificación real.
  const { raiz, limpiar } = crearArbolAislado({ 'contrato-simulado.mjs': contenido });
  try {
    const encontrados = escanearArbol({ raiz, archivos: ['contrato-simulado.mjs'], ubicacionesLegitimas: [] })
      .filter((h) => h.tipo === 'identificador_duplicado');
    assert.ok(encontrados.length >= 2, `se esperaban al menos 2 apariciones del candidato (regex + assert), se encontraron ${encontrados.length}`);
    for (const h of encontrados) {
      assert.notEqual(h.categoria, 'termino_tecnico', 'envolver un identificador real en una regex/assert no debe clasificarlo como termino_tecnico');
      assert.equal(h.categoria, 'identificador_interno_historico');
    }
  } finally {
    limpiar();
  }
  console.log('PM26_P02_NEGATIVA_5_REGEX_NO_ES_TERMINO_TECNICO=PASS');
}

// --- Prueba de control: un directorio temporal aislado SIN ningún
// marcador produce código de salida 0. ---
{
  const { raiz, limpiar } = crearArbolAislado({ 'limpio.txt': 'contenido sin nada sensible\n' });
  try {
    const r = ejecutarEscaner(['escanear-ruta', raiz]);
    assert.equal(r.status, 0, `esperado código de salida 0 sobre un directorio limpio, obtenido ${r.status}`);
  } finally {
    limpiar();
  }
  console.log('PM26_P02_PRUEBA_CONTROL=PASS (directorio aislado sin marcador -> salida 0)');
}

// --- Verificación ESTRUCTURAL (nunca por valor literal) de que el
// documento de cierre, el propio escáner y este contrato no contienen
// ningún candidato a identificador fuera de sus ubicaciones legítimas. En
// vez de comparar contra los tres project refs escritos a mano (lo que
// sería la misma duplicación que se está corrigiendo), se reutiliza el
// propio escáner sobre estos tres archivos. ---
{
  const archivosPM26 = [
    'tests/pm26/P02_REPARACION_GATES_SECRETOS.md',
    'tools/seguridad/verificar-secretos-e-identificadores.mjs',
    'tests/pm26/p02-contract.mjs',
  ];
  const hallazgos = escanearArbol({ raiz: RAIZ_REPO, archivos: archivosPM26, ubicacionesLegitimas: [] });
  const secretosReales = hallazgos.filter((h) => h.tipo === 'secreto_real');
  const identificadoresNoAdmitidos = hallazgos.filter(
    (h) => h.tipo === 'identificador_duplicado' && h.categoria !== 'falso_positivo'
  );
  assert.equal(secretosReales.length, 0, 'ni el documento, ni el escáner, ni este contrato deben contener un secreto real');
  assert.equal(
    identificadoresNoAdmitidos.length,
    0,
    'ni el documento, ni el escáner, ni este contrato deben contener un candidato a identificador real (project ref o clave publishable) fuera de una ubicación legítima -- encontrado en: ' +
      identificadoresNoAdmitidos.map((h) => `${h.archivo}:${h.linea} (${h.categoria})`).join(', ')
  );
  console.log('PM26_P02_SIN_IDENTIFICADORES_REALES_ESTRUCTURAL=PASS');
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
assert.match(doc, /archivos\s+adicionales/i);

// Las categorías de clasificación están documentadas, con la redefinición
// explícita de termino_tecnico (nunca un identificador real).
for (const categoria of ['secreto_real', 'configuracion_publica_legitima', 'termino_tecnico', 'falso_positivo', 'identificador_interno_historico']) {
  assert.match(doc, new RegExp('`' + categoria + '`'), `falta documentar la categoría ${categoria}`);
}
assert.match(doc, /nunca\*?\*?\s+un\s+project\s+ref\s+real/i);

// No se afirma "limpia" para la deuda -- se afirma "inventariada y clasificada".
assert.match(doc, /No se afirma que los .{1,15}archivos de deuda est[ée]n\s+"?limpios"?/i);
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
// Ninguna entrada de línea base usa termino_tecnico -- queda retirado de
// la clasificación de identificadores reales (redefinición de este lote).
for (const entrada of lineaBase.entradas) {
  assert.notEqual(entrada.categoria, 'identificador_interno_historico');
  assert.notEqual(entrada.categoria, 'secreto_real');
  assert.notEqual(entrada.categoria, 'termino_tecnico');
}

console.log('PM26_P02_DOC_VERIFICADO=PASS');
console.log('PM26_P02_LEDGERS_VERIFICADOS=PASS');
console.log('PM26 P02 — reparación de gates de secretos e identificadores: contrato OK');
