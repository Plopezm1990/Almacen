import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { spawnSync, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { escanearArbol } from '../../tools/seguridad/verificar-secretos-e-identificadores.mjs';

// PM26 P08d: contrato del candidato exacto de despliegue del Defecto L.
// Certifica que (1) existe un parche minimo que toca EXCLUSIVAMENTE
// fuente.js y source-recovery/fuente-recuperado.js, (2) ese parche no
// arrastra nada de los paquetes K/F/H acumulados en la rama tecnica,
// (3) aplica y revierte limpio sobre el SHA exacto de release dejando el
// arbol identico, (4) las comprobaciones de comportamiento detectan de
// verdad la ausencia de empresa/local, el borrado sin .select() y
// cualquier mutacion directa en una rama QA, y (5) las huellas
// documentadas son las reales. No aplica migraciones, no escribe en
// Supabase, no despliega y no modifica release ni main.

const __filename = fileURLToPath(import.meta.url);
const RAIZ_REPO = path.resolve(path.dirname(__filename), '..', '..');
const RELEASE_SHA = '93a570badba1c5375febfbddc1dffdbcef003dcd';

const rutaDoc = 'tests/pm26/P08D_CANDIDATO_RELEASE_DEFECTO_L.md';
const rutaPatch = 'tests/pm26/p08d-candidato-release/defecto-l-cliente.patch';
const rutaValidador = 'tests/pm26/p08d-candidato-release/validar-candidato.sh';

function leer(rel) {
  return fs.readFileSync(path.join(RAIZ_REPO, rel), 'utf8');
}
function sha256(rel) {
  return crypto.createHash('sha256').update(fs.readFileSync(path.join(RAIZ_REPO, rel))).digest('hex');
}
function sha256Texto(texto) {
  return crypto.createHash('sha256').update(Buffer.from(texto, 'utf8')).digest('hex');
}

const doc = leer(rutaDoc);
const patch = leer(rutaPatch);

// --- 1) Marcadores del informe. ---
for (const marcador of [
  'PM26_P08D_ESTADO=CANDIDATO_PREPARADO_NO_APLICADO_NO_DESPLEGADO',
  'PM26_P08D_BASE=RELEASE_93a570b',
  'PM26_P08D_PARCHE_SOLO_DOS_ARCHIVOS=SI',
  'PM26_P08D_SIN_ARRASTRE_RAMA_TECNICA=SI',
  'PM26_P08D_DEPENDENCIA_IMPRESCINDIBLE_ENCONTRADA=NO',
  'PM26_P08D_APPLY_CHECK=PASS',
  'PM26_P08D_APLICACION_LIMPIA=PASS',
  'PM26_P08D_REVERSION_LIMPIA=PASS',
  'PM26_P08D_BUILD_REPRODUCIBLE=PASS',
  'PM26_P08D_REGRESION_RELEASE_COMPLETA=PASS',
  'PM26_P08D_MUTACIONES_NEGATIVAS=PASS',
  'PM26_P08D_REQUIERE_MIGRACION_PREVIA=SI',
  'PM26_P08D_MIGRACION_APLICADA=NO',
  'PM26_P08D_DESPLEGADO_EN_NETLIFY=NO',
  'PM26_P08D_RELEASE_MAIN_MODIFICADOS=NO',
  'PM26_P08D_PR_38_CERRADA_O_FUSIONADA=NO',
  'PM26_P08D_DEFECTO_L_CORREGIDO_EN_PRODUCCION=NO',
]) {
  assert.ok(doc.includes(marcador), `falta el marcador ${marcador} en el informe`);
}
console.log('PM26_P08D_ESTADO_DOC_VERIFICADO=PASS');

// --- 2) El parche toca exclusivamente los dos archivos autorizados. ---
const archivosPatch = [...patch.matchAll(/^diff --git a\/(\S+) b\/(\S+)$/gm)].map((m) => m[1]);
assert.deepEqual(
  [...new Set(archivosPatch)].sort(),
  ['fuente.js', 'source-recovery/fuente-recuperado.js'],
  'el parche debe tocar exclusivamente fuente.js y source-recovery/fuente-recuperado.js'
);
// Y no puede crear, borrar ni renombrar archivos.
assert.doesNotMatch(patch, /^(new file mode|deleted file mode|rename from|rename to)/m, 'el parche no debe crear, borrar ni renombrar archivos');
console.log('PM26_P08D_PARCHE_ACOTADO_VERIFICADO=PASS');

// --- 3) Nada de la rama tecnica (K, F, H, senales QA) viaja en el parche. ---
const anadidas = patch.split('\n').filter((l) => l.startsWith('+') && !l.startsWith('+++')).join('\n');
for (const ajeno of [
  '__modoPruebasQA',
  '__qaNubeUrl',
  'pm11_crear_prefiltro_candidato',
  'pm11_eliminar_prefiltro_candidato',
  'origenSupabasePublicoPM26',
  'invocarFuncionPublicaPM26',
]) {
  assert.ok(!anadidas.includes(ajeno), `el parche arrastra contenido ajeno al Defecto L: ${ajeno}`);
}
console.log('PM26_P08D_SIN_ARRASTRE_VERIFICADO=PASS');

// --- 4) Comprobaciones de comportamiento y mutaciones negativas. ---
// Aisla los bloques "if (esQA) { ... }" contando llaves (mismo criterio
// que P06h/P07b/P08b/P08c). En el candidato basado en release no existe
// ninguna rama QA, asi que la comprobacion debe pasar por ausencia -- y
// la mutacion negativa de abajo demuestra que, si alguien introdujera
// una mutacion directa dentro de una rama QA, se detectaria.
function bloquesEsQA(texto) {
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
    bloques.push(texto.slice(inicio, i));
    desde = i;
  }
  return bloques;
}

// Aisla los argumentos de la llamada a crearLogicaPrefiltros. Es
// imprescindible acotarlo: "empresaId: empresaDelLocalActivo?.id || null"
// tambien aparece en otras llamadas de release (crearLogicaFacturasDirectas),
// asi que buscarlo en todo el archivo daria un falso positivo.
function bloqueLlamada(texto) {
  const marca = '= crearLogicaPrefiltros({';
  const i = texto.indexOf(marca);
  if (i < 0) return '';
  let j = i + marca.length;
  let profundidad = 1;
  while (profundidad > 0 && j < texto.length) {
    if (texto[j] === '{') profundidad++;
    else if (texto[j] === '}') profundidad--;
    j++;
  }
  return texto.slice(i, j);
}

function validarCandidato(texto, etiqueta = 'candidato') {
  const fallos = [];
  const exigir = (ok, motivo) => { if (!ok) fallos.push(motivo); };
  const llamada = bloqueLlamada(texto);
  exigir(/function crearLogicaPrefiltros\(\{ registrarAuditoria, empresaId, localId \}\)/.test(texto), 'firma sin empresa/local');
  exigir(/empresaId: empresaDelLocalActivo\?\.id \|\| null/.test(llamada), 'el call site no pasa la empresa activa');
  exigir(/localId: localActivoId \|\| null/.test(llamada), 'el call site no pasa el local activo');
  exigir(/empresa_id: empresaId, local_id: localId/.test(texto), 'el INSERT no envia empresa_id/local_id');
  exigir(/\.delete\(\)\.eq\("token", token\)\.select\(\)/.test(texto), 'el borrado no usa .select()');
  exigir(/!Array\.isArray\(data\) \|\| data\.length !== 1/.test(texto), 'el borrado no exige exactamente una fila');
  for (const bloque of bloquesEsQA(texto)) {
    exigir(
      !/\.from\("prefiltros_candidatos"\)\.(?:insert|delete)\(/.test(bloque),
      'hay una mutacion directa dentro de una rama QA'
    );
  }
  if (fallos.length) {
    const error = new Error(`${etiqueta}: ${fallos.join('; ')}`);
    error.fallos = fallos;
    throw error;
  }
  return true;
}

// Positivo: el candidato real, extraido del propio parche aplicado a release.
const candidatoReleaseFuente = execFileSync('git', ['show', `${RELEASE_SHA}:fuente.js`], {
  cwd: RAIZ_REPO,
  encoding: 'utf8',
  maxBuffer: 1024 * 1024 * 64,
});
// Reconstruye el texto parcheado aplicando las mismas sustituciones que
// el parche describe, sin depender de un worktree para esta parte.
function aplicarCambiosCandidato(texto) {
  return texto
    .replace(
      '  const { crearPrefiltro, listarPrefiltros, eliminarPrefiltro } = crearLogicaPrefiltros({ registrarAuditoria });',
      '  const { crearPrefiltro, listarPrefiltros, eliminarPrefiltro } = crearLogicaPrefiltros({\n    registrarAuditoria,\n    empresaId: empresaDelLocalActivo?.id || null,\n    localId: localActivoId || null\n  });'
    )
    .replace(
      'function crearLogicaPrefiltros({ registrarAuditoria }) {',
      'function crearLogicaPrefiltros({ registrarAuditoria, empresaId, localId }) {'
    )
    .replace(
      'estado: "pendiente" });',
      'estado: "pendiente", empresa_id: empresaId, local_id: localId });'
    )
    .replace(
      '    const { error } = await supabase.from("prefiltros_candidatos").delete().eq("token", token);\n    if (!error) registrarAuditoria("Eliminar prefiltro de candidato", candidatoNombre || token);\n    return !error;',
      '    const { data, error } = await supabase.from("prefiltros_candidatos").delete().eq("token", token).select();\n    if (error || !Array.isArray(data) || data.length !== 1) return false;\n    registrarAuditoria("Eliminar prefiltro de candidato", candidatoNombre || token);\n    return true;'
    );
}
const candidato = aplicarCambiosCandidato(candidatoReleaseFuente);
assert.ok(validarCandidato(candidato, 'candidato real'), 'el candidato debe pasar sus propias comprobaciones');

// El release SIN parchear debe fallar: prueba que la comprobacion no es vacia.
assert.throws(() => validarCandidato(candidatoReleaseFuente, 'release sin parchear'), /firma sin empresa\/local/);

// Mutaciones negativas exigidas.
const mutaciones = [
  [
    'sin empresa/local en el INSERT',
    (t) => t.replace('estado: "pendiente", empresa_id: empresaId, local_id: localId });', 'estado: "pendiente" });'),
    /el INSERT no envia empresa_id\/local_id/,
  ],
  [
    'borrado sin .select()',
    (t) => t.replace('.delete().eq("token", token).select();', '.delete().eq("token", token);'),
    /el borrado no usa \.select\(\)/,
  ],
  [
    'borrado sin exigir exactamente una fila',
    (t) => t.replace('if (error || !Array.isArray(data) || data.length !== 1) return false;', 'if (error) return false;'),
    /el borrado no exige exactamente una fila/,
  ],
  [
    'firma sin empresa/local',
    (t) => t.replace('function crearLogicaPrefiltros({ registrarAuditoria, empresaId, localId }) {', 'function crearLogicaPrefiltros({ registrarAuditoria }) {'),
    /firma sin empresa\/local/,
  ],
  [
    // Se muta el bloque COMPLETO de la llamada, no solo la linea: esa
    // linea suelta aparece tambien en otra llamada de release y mutarla
    // por separado editaria el sitio equivocado.
    'call site sin contexto de empresa',
    (t) =>
      t.replace(
        'crearLogicaPrefiltros({\n    registrarAuditoria,\n    empresaId: empresaDelLocalActivo?.id || null,\n    localId: localActivoId || null\n  });',
        'crearLogicaPrefiltros({\n    registrarAuditoria,\n    localId: localActivoId || null\n  });'
      ),
    /el call site no pasa la empresa activa/,
  ],
  [
    'mutacion directa dentro de una rama QA',
    (t) =>
      t.replace(
        '  async function listarPrefiltros() {',
        '  async function mutanteQA() {\n    if (esQA) {\n      await supabase.from("prefiltros_candidatos").insert({ token });\n    }\n  }\n  async function listarPrefiltros() {'
      ),
    /mutacion directa dentro de una rama QA/,
  ],
];
for (const [etiqueta, mutar, patronEsperado] of mutaciones) {
  const mutante = mutar(candidato);
  assert.notEqual(mutante, candidato, `la mutacion "${etiqueta}" no llego a cambiar nada -- prueba invalida`);
  assert.throws(
    () => validarCandidato(mutante, etiqueta),
    patronEsperado,
    `la comprobacion no detecta la mutacion: ${etiqueta}`
  );
}
console.log(`PM26_P08D_MUTACIONES_NEGATIVAS_VERIFICADAS=PASS (${mutaciones.length} mutaciones detectadas)`);

// --- 5) Huellas documentadas. ---
assert.ok(doc.includes(sha256(rutaPatch)), 'el informe no contiene el SHA-256 real del parche');
assert.ok(doc.includes(RELEASE_SHA), 'el informe debe identificar el SHA exacto de release');
const shaReleaseFuente = sha256Texto(candidatoReleaseFuente);
assert.ok(doc.includes(shaReleaseFuente), 'el informe no contiene el SHA-256 de fuente.js en release');
console.log('PM26_P08D_HASHES_VERIFICADOS=PASS');

// --- 6) El validador se re-ejecuta de verdad sobre un worktree desde release. ---
const marcadores = [
  'PM26_P08D_PARCHE_SOLO_DOS_ARCHIVOS=PASS',
  'PM26_P08D_SIN_ARRASTRE_K_F_H=PASS',
  'PM26_P08D_WORKTREE_DESDE_RELEASE=PASS',
  'PM26_P08D_APPLY_CHECK=PASS',
  'PM26_P08D_APLICACION_LIMPIA=PASS',
  'PM26_P08D_COMPORTAMIENTO_DEFECTO_L=PASS',
  'PM26_P08D_REVERSION_LIMPIA=PASS',
  'PM26_P08D_REAPLICACION_TRAS_REVERTIR=PASS',
  'PM26_P08D_BUILD_REPRODUCIBLE=PASS',
  'PM26_P08D_REGRESION_RELEASE_COMPLETA=PASS',
  'PM26_P08D_CANDIDATO_VALIDADO=PASS',
];
{
  const r = spawnSync('bash', [path.join(RAIZ_REPO, rutaValidador)], {
    cwd: RAIZ_REPO,
    encoding: 'utf8',
    timeout: 900000,
  });
  if (r.status !== 0) {
    console.error(r.stdout);
    console.error(r.stderr);
  }
  assert.equal(r.status, 0, 'validar-candidato.sh debe terminar con exito');
  for (const marcador of marcadores) {
    assert.ok(r.stdout.includes(marcador), `falta el marcador ${marcador} en la salida real del validador`);
  }
  // Las huellas que reporta el validador deben ser las documentadas.
  const mFuente = r.stdout.match(/PM26_P08D_SHA_FUENTE_PARCHEADA=([0-9a-f]{64})/);
  const mCanonica = r.stdout.match(/PM26_P08D_SHA_CANONICA_PARCHEADA=([0-9a-f]{64})/);
  assert.ok(mFuente && mCanonica, 'el validador debe reportar las huellas del arbol parcheado');
  assert.ok(doc.includes(mFuente[1]), 'el informe no contiene el SHA-256 real de fuente.js parcheada');
  assert.ok(doc.includes(mCanonica[1]), 'el informe no contiene el SHA-256 real de la fuente canonica parcheada');
}
console.log('PM26_P08D_VALIDADOR_REPRODUCIDO=PASS');

// --- 7) P08d no aplica nada ni toca lo que no debe. ---
assert.ok(
  !fs.readdirSync(path.join(RAIZ_REPO, 'supabase/migrations')).some((n) => /prefiltro/i.test(n)),
  'no debe existir ninguna migracion real del Defecto L en supabase/migrations'
);
const tocadosFuera = execFileSync(
  'git',
  ['diff', '--name-only', '5fe9c63da20f740b76e47d8dfef15ebe529e6ed3', '--', 'fuente.js', 'source-recovery', 'index.html', 'reset-pruebas-preview.js', '_headers', 'supabase'],
  { cwd: RAIZ_REPO, encoding: 'utf8' }
).trim();
assert.equal(tocadosFuera, '', `P08d no debe tocar el cliente de la rama tecnica ni supabase/ -- cambiados: ${tocadosFuera}`);
console.log('PM26_P08D_NADA_APLICADO_NI_DESPLEGADO=PASS');

// --- 8) Sin secretos ni identificadores internos. ---
{
  const archivosNuevos = [rutaDoc, rutaPatch, rutaValidador, 'tests/pm26/p08d-contract.mjs', '.github/workflows/pm26-p08d-candidato-release.yml'];
  const hallazgos = escanearArbol({ raiz: RAIZ_REPO, archivos: archivosNuevos, ubicacionesLegitimas: [] });
  const secretos = hallazgos.filter((h) => h.tipo === 'secreto_real');
  const identificadores = hallazgos.filter(
    (h) => h.tipo === 'identificador_duplicado' && h.categoria !== 'falso_positivo'
  );
  assert.equal(secretos.length, 0, 'P08d no debe introducir secretos reales');
  assert.equal(identificadores.length, 0, 'P08d no debe introducir identificadores internos');
  console.log('PM26_P08D_SIN_SECRETOS_NI_IDENTIFICADORES=PASS');
}

console.log('PM26 P08d — candidato exacto de despliegue del Defecto L: contrato OK');
