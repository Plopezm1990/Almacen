import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { spawnSync, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { escanearArbol } from '../../tools/seguridad/verificar-secretos-e-identificadores.mjs';

// PM26 P08e: contrato de la precondicion de autorizacion backend legacy
// del Defecto L. Certifica que (1) el informe deja constancia del
// bloqueo real encontrado -- no existe hoy una fuente backend fiable que
// vincule al propietario con su empresa y local --, (2) el preflight
// (embebido e independiente, byte a byte identicos) exige de verdad una
// membresia activa y coherente antes de dejar aplicar la migracion,
// (3) ese guard es lo que rechaza el estado real de produccion, probado
// por control negativo en PostgreSQL local: sin el guard, 0 membresias
// pasarian, (4) la bateria de comportamiento ligada a la membresia se
// re-ejecuta de verdad, (5) no se hardcodea ningun identificador interno
// y (6) no se debilito ningun gate historico. No crea membresias, no
// aplica migraciones, no escribe en Supabase y no despliega nada.

const __filename = fileURLToPath(import.meta.url);
const RAIZ_REPO = path.resolve(path.dirname(__filename), '..', '..');
const CIERRE_P08D = '67dbb6e62a2e08774040d1963f45b6ea3784903b';

const rutaDoc = 'tests/pm26/P08E_PRECONDICION_MEMBRESIAS_LEGACY.md';
const rutaMigracion = 'tests/pm26/p08-defecto-l-produccion/migracion-propuesta.sql';
const rutaPreflight = 'tests/pm26/p08-defecto-l-produccion/preflight-independiente.sql';
const rutaValidador = 'tests/pm26/p08e-precondicion-membresias/validar-membresias.sh';
const rutaBateria = 'tests/pm26/p08e-precondicion-membresias/comportamiento-membresias.sql';

function leer(rel) {
  return fs.readFileSync(path.join(RAIZ_REPO, rel), 'utf8');
}
function sha256(rel) {
  return crypto.createHash('sha256').update(fs.readFileSync(path.join(RAIZ_REPO, rel))).digest('hex');
}
function norm(texto) {
  return texto.replace(/\s+/g, ' ');
}
function sqlEjecutable(texto) {
  return texto
    .split('\n')
    .filter((l) => !/^\s*--/.test(l))
    .join('\n');
}

const doc = leer(rutaDoc);
const migracion = leer(rutaMigracion);
const preflight = leer(rutaPreflight);
const validador = leer(rutaValidador);
const bateria = leer(rutaBateria);

// --- 1) Marcadores del informe. ---
for (const marcador of [
  'PM26_P08E_ESTADO=BLOQUEADO_DOCUMENTADO_GUARD_APLICADO',
  'PM26_P08E_FUENTE_BACKEND_FIABLE_EXISTE=NO',
  'PM26_P08E_MEMBRESIAS_ACTIVAS_EN_PRODUCCION=0',
  'PM26_P08E_LA_TIENE_LOCAL_FUNCIONA_HOY=NO',
  'PM26_P08E_TABLAS_EMPRESAS_O_LOCALES=NO_EXISTEN',
  'PM26_P08E_CATALOGO_LOCALES_EN_KV=NO_EXISTE',
  'PM26_P08E_ALTERNATIVA_SELECCIONADA=BOOTSTRAP_ADMINISTRATIVO_MEMBRESIAS',
  'PM26_P08E_ALTERNATIVA_BLOQUEADA_POR_FALTA_DE_CATALOGO=SI',
  'PM26_P08E_PREFLIGHT_EXIGE_MEMBRESIA_ACTIVA=SI',
  'PM26_P08E_PREFLIGHT_EXIGE_COBERTURA_POR_PROPIETARIO=SI',
  'PM26_P08E_CERO_MEMBRESIAS_FALLA_EN_PRUEBAS=SI',
  'PM26_P08E_SIN_IDENTIFICADORES_HARDCODEADOS=SI',
  'PM26_P08E_COMPATIBLE_CON_PARCHE_P08D=SI',
  'PM26_P08E_MEMBRESIA_CREADA=NO',
  'PM26_P08E_MIGRACION_APLICADA=NO',
  'PM26_P08E_ESCRITURA_EN_PRODUCCION_QA_TPV=NO',
  'PM26_P08E_DESPLEGADO_EN_NETLIFY=NO',
  'PM26_P08E_MAIN_RELEASE_TOCADOS=NO',
  'PM26_P08E_PR_38_CERRADA_O_FUSIONADA=NO',
  'PM26_P08E_DEFECTO_L_CORREGIDO_EN_PRODUCCION=NO',
]) {
  assert.ok(doc.includes(marcador), `falta el marcador ${marcador} en el informe`);
}
// El bloqueo tiene que estar dicho, no solo marcado: el informe debe
// comparar alternativas y no proponer confiar en el navegador.
const docNorm = norm(doc);
for (const [etiqueta, patron] of [
  ['la alternativa A, bootstrap administrativo, es la seleccionada', /\| A \| [^|]*[Bb]ootstrap administrativo[^|]*\|[^|]*\|[^|]*Seleccionada/],
  ['la B, es_propietario_activo, esta rechazada', /\| B \|[^|]*es_propietario_activo[^|]*\|[^|]*\|[^|]*Rechazada/],
  ['la C, derivar de almacen_kv, esta rechazada por circular', /\| C \|[^|]*almacen_kv[^|]*\|[^|]*\|[^|]*Rechazada/],
  ['la D, confiar en el navegador, esta rechazada', /\| D \|[^|]*navegador[^|]*\|[^|]*\|[^|]*Rechazada/],
  ['la E, columnas en perfiles, esta rechazada', /\| E \|[^|]*perfiles[^|]*\|[^|]*\|[^|]*Rechazada/],
  ['por que A esta bloqueada hoy', /no existe ningún catálogo contra el que validarlos/i],
  ['no se fabrica la membresia', /Una membresía creada con valores inventados[^.]*\. \*\*No la creo\.\*\*/i],
  ['se declara el bloqueo, no se inventa autorizacion', /No se inventó ni se debilitó ninguna autorización/i],
  ['el repositorio no contendra los identificadores', /este repositorio no los contiene ni los contendrá/i],
]) {
  assert.match(docNorm, patron, `el informe debe recoger: ${etiqueta}`);
}
console.log('PM26_P08E_ESTADO_DOC_VERIFICADO=PASS');

// --- 2) El bloque de preflight sigue siendo byte a byte identico en los
// dos archivos: endurecer uno solo dejaria la migracion real sin guard. ---
function bloquePreflight(texto) {
  const i = texto.indexOf('-- PM26_P08_PREFLIGHT_INICIO');
  const j = texto.indexOf('-- PM26_P08_PREFLIGHT_FIN');
  assert.ok(i >= 0 && j > i, 'no se localizaron los marcadores del preflight');
  return texto.slice(i, j);
}
const bloqueMigracion = bloquePreflight(migracion);
const bloqueIndependiente = bloquePreflight(preflight);
assert.equal(
  bloqueMigracion,
  bloqueIndependiente,
  'el preflight embebido y el independiente deben seguir siendo byte a byte identicos'
);
console.log('PM26_P08E_PREFLIGHT_IDENTICO_VERIFICADO=PASS');

// --- 3) El guard de P08e existe, esta dentro del preflight y comprueba
// lo que realmente exige private.la_tiene_local. ---
function bloqueGuard(texto) {
  const i = texto.indexOf('-- PM26_P08E_GUARD_INICIO');
  const j = texto.indexOf('-- PM26_P08E_GUARD_FIN');
  assert.ok(i >= 0 && j > i, 'faltan los marcadores del guard de P08e');
  return texto.slice(i, j);
}
const guard = bloqueGuard(bloqueIndependiente);
const guardSQL = sqlEjecutable(guard);
assert.match(
  guardSQL,
  /select count\(\*\) into v_membresias from public\.membresias_usuario where activo = true;/,
  'el guard debe contar las membresias ACTIVAS'
);
assert.match(guardSQL, /if v_membresias = 0 then/, 'el guard debe abortar con 0 membresias activas');
assert.match(
  guardSQL,
  /PREFLIGHT_FALLO: membresias_usuario no tiene ninguna fila activa/,
  'el abort por 0 membresias debe ser explicito'
);
// Cobertura por propietario, con los tres requisitos que impone el
// helper: empresa no vacia, y todos_locales o un local concreto que no
// sea TODOS. Comprobar solo la existencia de la fila dejaria pasar una
// membresia que la_tiene_local rechazaria igualmente.
assert.match(guardSQL, /from public\.perfiles p/, 'la cobertura debe recorrer perfiles');
assert.match(guardSQL, /p\.activo = true and p\.rol = 'Propietario'/, 'solo cuentan los Propietarios activos');
assert.match(guardSQL, /nullif\(btrim\(m\.empresa_id\), ''\) is not null/, 'la empresa no puede estar vacia');
assert.match(guardSQL, /m\.todos_locales = true/, 'debe aceptar todos_locales');
assert.match(
  guardSQL,
  /upper\(btrim\(m\.local_id\)\) <> 'TODOS'/,
  "debe rechazar local_id='TODOS' sin todos_locales, igual que el helper"
);
assert.match(guardSQL, /propietario\(s\) activo\(s\) sin membresia activa y coherente/, 'el abort debe ser explicito');
// El guard NO puede crear ni modificar nada: es un preflight de lectura.
for (const prohibido of [/\binsert\s+into\b/i, /\bupdate\b\s+public\./i, /\bdelete\s+from\b/i, /\bgrant\b/i, /\brevoke\b/i, /\balter\b/i]) {
  assert.doesNotMatch(guardSQL, prohibido, `el guard de P08e debe ser de solo lectura -- encontrado ${prohibido}`);
}
console.log('PM26_P08E_GUARD_ESTRUCTURA_VERIFICADA=PASS');

// --- 4) Sin identificadores hardcodeados en el guard ni en el
// preflight: nada de UUIDs reales ni de nombres de empresa/local. ---
assert.doesNotMatch(
  bloqueIndependiente,
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
  'el preflight no debe contener ningun UUID'
);
// En la bateria si hay UUIDs, pero solo sinteticos (un digito repetido).
for (const uuid of bateria.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi) || []) {
  assert.match(uuid, /^(.)\1{7}-\1{4}-\1{4}-\1{4}-\1{12}$/, `la bateria contiene un UUID no sintetico: ${uuid}`);
}
console.log('PM26_P08E_SIN_IDENTIFICADORES_HARDCODEADOS_VERIFICADO=PASS');

// --- 5) Control negativo REAL en PostgreSQL: sin el guard, el estado
// actual de produccion (0 membresias) pasaria el preflight. Es la unica
// forma de demostrar que lo que rechaza ese estado es el guard y no otra
// comprobacion anterior que ya estuviera ahi. ---
function psql(args, entrada) {
  return spawnSync('sudo', ['-u', 'postgres', 'psql', ...args], {
    encoding: 'utf8',
    input: entrada,
    timeout: 180000,
  });
}
{
  const db = `pm26_p08e_ctr_${process.pid}`;
  const base = path.join(RAIZ_REPO, 'tests/pm26/p08-defecto-l-produccion');
  const limpiar = () => psql(['-c', `drop database if exists "${db}" with (force);`]);
  try {
    limpiar();
    assert.equal(psql(['-c', `create database "${db}";`]).status, 0, 'no se pudo crear la base temporal');
    for (const f of ['schema.sql', 'seed.sql']) {
      const r = psql(['-d', db, '-v', 'ON_ERROR_STOP=1', '-f', path.join(base, f)]);
      assert.equal(r.status, 0, `no se pudo aplicar ${f}: ${r.stderr}`);
    }
    // Estado real de produccion hoy.
    assert.equal(psql(['-d', db, '-v', 'ON_ERROR_STOP=1', '-c', 'delete from public.membresias_usuario;']).status, 0);

    // 5a) Con el guard: rechaza.
    const conGuard = psql(['-d', db, '-v', 'ON_ERROR_STOP=1', '-f', path.join(RAIZ_REPO, rutaPreflight)]);
    assert.notEqual(conGuard.status, 0, 'con el guard, 0 membresias debe abortar el preflight');
    assert.match(
      conGuard.stderr,
      /membresias_usuario no tiene ninguna fila activa/,
      'el abort debe venir del guard de P08e'
    );

    // 5b) Sin el guard (mutante): el mismo estado pasaria. Control
    //     negativo -- si esto tambien fallara, el guard seria redundante
    //     y la prueba 5a no demostraria nada.
    const mutante = preflight.replace(bloqueGuard(preflight), '');
    assert.notEqual(mutante, preflight, 'la mutacion no llego a quitar el guard -- prueba invalida');
    // Se pasa por stdin a proposito: escribirlo en disco exigiria que el
    // usuario postgres pudiera leer el temporal, y no hace falta.
    const sinGuard = psql(['-d', db, '-v', 'ON_ERROR_STOP=1'], mutante);
    assert.equal(
      sinGuard.status,
      0,
      `sin el guard, 0 membresias deberia pasar el preflight (control negativo): ${sinGuard.stderr}`
    );
    assert.match(sinGuard.stderr, /PREFLIGHT_CATALOGO=PASS/, 'el mutante debia llegar a declarar el catalogo OK');
  } finally {
    limpiar();
  }
  console.log('PM26_P08E_CONTROL_NEGATIVO_SIN_GUARD=PASS');
}

// --- 6) El validador solo admite PostgreSQL local y se re-ejecuta de
// verdad, con todos sus marcadores. ---
assert.match(validador, /PGHOST apunta a un host no local/, 'el validador debe rechazar un PGHOST remoto');
assert.match(validador, /drop database if exists/, 'el validador debe crear y destruir su propia base temporal');
assert.doesNotMatch(validador, /supabase\.co/i, 'el validador no debe referirse a ningun host remoto');

const marcadoresValidador = [
  'PM26_P08E_ENTORNO_LOCAL=PASS',
  'PM26_P08E_ESQUEMA_Y_SEED=PASS',
  'PM26_P08E_CERO_MEMBRESIAS_PREFLIGHT_RECHAZA=PASS',
  'PM26_P08E_CERO_MEMBRESIAS_MIGRACION_ABORTA=PASS',
  'PM26_P08E_PROPIETARIO_SIN_MEMBRESIA_RECHAZADO=PASS',
  'PM26_P08E_MEMBRESIA_INCOHERENTE_RECHAZADA=PASS',
  'PM26_P08E_MEMBRESIA_VALIDA_PREFLIGHT_PASA=PASS',
  'PM26_P08E_MIGRACION_APLICADA=PASS',
  'PM26_P08E_BATERIA_MEMBRESIAS=PASS',
  'PM26_P08E_REAPLICACION_RECHAZADA=PASS',
  'PM26_P08E_ROLLBACK_CONTROLADO=PASS',
  'PM26_P08E_GUARD_SIGUE_ACTIVO_TRAS_REVERTIR=PASS',
  'PM26_P08E_VALIDACION_COMPLETA=PASS',
];
{
  const r = spawnSync('bash', [path.join(RAIZ_REPO, rutaValidador)], {
    cwd: RAIZ_REPO,
    encoding: 'utf8',
    timeout: 600000,
  });
  if (r.status !== 0) {
    console.error(r.stdout);
    console.error(r.stderr);
  }
  assert.equal(r.status, 0, 'validar-membresias.sh debe terminar con exito');
  for (const marcador of marcadoresValidador) {
    assert.ok(r.stdout.includes(marcador), `falta el marcador ${marcador} en la salida real del validador`);
  }
}
console.log('PM26_P08E_VALIDADOR_REPRODUCIDO=PASS');

// --- 7) La bateria cubre los casos que exige la autorizacion, incluido
// el retrato exacto de la cuenta legacy: Propietario sin membresia. ---
for (const caso of ['M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7', 'M8']) {
  assert.ok(bateria.includes(`${caso}=PASS`), `la bateria debe poder reportar ${caso}=PASS`);
  assert.ok(bateria.includes(`${caso}=FAIL`), `la bateria debe poder reportar ${caso}=FAIL -- si no, no prueba nada`);
}
assert.match(
  bateria,
  /insert into public\.perfiles \(user_id, rol, activo\) values\s*\n?\s*\('66666666/,
  'la bateria debe incluir un Propietario SIN membresia (el estado legacy real)'
);
assert.match(
  bateria,
  /update public\.membresias_usuario set activo = false/,
  'la bateria debe probar que desactivar la membresia retira el acceso'
);
console.log('PM26_P08E_BATERIA_CUBRE_PRECONDICION=PASS');

// --- 8) Huellas documentadas. ---
for (const rel of [rutaMigracion, rutaPreflight, rutaValidador, rutaBateria]) {
  assert.ok(doc.includes(sha256(rel)), `el informe no contiene el SHA-256 real de ${rel}`);
}
// P08b apunta a las mismas huellas de los SQL: si divergieran, su tabla
// estaria certificando un archivo que ya no existe.
const docP08B = leer('tests/pm26/P08B_DEFECTO_L_CLIENTE_COORDINADO.md');
for (const rel of [rutaMigracion, rutaPreflight]) {
  assert.ok(docP08B.includes(sha256(rel)), `P08b no refleja el SHA-256 actual de ${rel}`);
}
console.log('PM26_P08E_HASHES_VERIFICADOS=PASS');

// --- 9) Nada aplicado, nada desplegado, nada fuera de sitio. ---
assert.ok(
  !fs.readdirSync(path.join(RAIZ_REPO, 'supabase/migrations')).some((n) => /prefiltro/i.test(n)),
  'no debe existir ninguna migracion real del Defecto L en supabase/migrations'
);
const tocadosFuera = execFileSync(
  'git',
  ['diff', '--name-only', CIERRE_P08D, '--', 'fuente.js', 'source-recovery', 'index.html', 'reset-pruebas-preview.js', '_headers', 'supabase'],
  { cwd: RAIZ_REPO, encoding: 'utf8' }
).trim();
assert.equal(tocadosFuera, '', `P08e no debe tocar el cliente ni supabase/ -- cambiados: ${tocadosFuera}`);
console.log('PM26_P08E_NADA_APLICADO_NI_DESPLEGADO=PASS');

// --- 10) Gates historicos intactos: P08e solo anade comprobaciones. ---
for (const [rel, patron, etiqueta] of [
  ['tests/pm26/p06h-contract.mjs', /extraerBloquesEsQA/, 'P06h conserva la prohibicion de mutar en QA'],
  ['tests/pm26/p07b-contract.mjs', /extraerBloquesEsQA/, 'P07b conserva la prohibicion de mutar en QA'],
  ['tests/pm26/p07c-contract.mjs', /CIERRE_HISTORICO/, 'P07c sigue anclado a su cierre historico'],
  ['tests/pm26/p08a-contract.mjs', /revertir\.sql no debe conceder ningun privilegio/, 'P08a conserva su invariante'],
  ['tests/pm26/p08b-contract.mjs', /PM26_P08_ROLLBACK_CONSERVADOR_PRESERVA_DATOS/, 'P08b conserva su bateria'],
  ['tests/pm26/p08c-contract.mjs', /access exclusive mode/, 'P08c conserva el endurecimiento de revertir.sql'],
  ['tests/pm26/p08d-contract.mjs', /el parche debe tocar exclusivamente/, 'P08d conserva el aislamiento del candidato'],
]) {
  assert.match(leer(rel), patron, `gate historico debilitado: ${etiqueta}`);
}
// Y la bateria historica de P08 sigue exigiendo lo suyo.
const validarP08 = leer('tests/pm26/p08-defecto-l-produccion/validar.sh');
assert.match(validarP08, /PM26_P08_ROLLBACK_CONSERVADOR_EXIGE_AUTORIZACION=PASS/);
console.log('PM26_P08E_GATES_HISTORICOS_INTACTOS=PASS');

// --- 11) Sin secretos ni identificadores internos. ---
{
  const archivosNuevos = [
    rutaDoc,
    rutaValidador,
    rutaBateria,
    rutaMigracion,
    rutaPreflight,
    'tests/pm26/P08B_DEFECTO_L_CLIENTE_COORDINADO.md',
    'tests/pm26/p08e-contract.mjs',
    '.github/workflows/pm26-p08e-precondicion-membresias.yml',
  ];
  const hallazgos = escanearArbol({ raiz: RAIZ_REPO, archivos: archivosNuevos, ubicacionesLegitimas: [] });
  const secretos = hallazgos.filter((h) => h.tipo === 'secreto_real');
  const identificadores = hallazgos.filter(
    (h) => h.tipo === 'identificador_duplicado' && h.categoria !== 'falso_positivo'
  );
  assert.equal(secretos.length, 0, 'P08e no debe introducir secretos reales');
  assert.equal(
    identificadores.length,
    0,
    'P08e no debe introducir identificadores internos -- encontrado en: ' +
      identificadores.map((h) => `${h.archivo}:${h.linea}`).join(', ')
  );
  console.log('PM26_P08E_SIN_SECRETOS_NI_IDENTIFICADORES=PASS');
}

console.log('PM26 P08e — precondición de autorización backend legacy: contrato OK');
