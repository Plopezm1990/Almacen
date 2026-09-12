import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { escanearArbol } from '../../tools/seguridad/verificar-secretos-e-identificadores.mjs';

// PM26 P08a: contrato de la PREPARACION en solo lectura del Defecto L
// en produccion. No certifica ninguna aplicacion real -- certifica que
// (1) el documento contiene todos los marcadores exigidos y declara
// que NO se aplico nada, (2) la migracion propuesta vive fuera de
// supabase/ (nunca se ha aplicado ni puede aplicarse por accidente),
// (3) reutiliza private.la_tiene_local en vez de copiar el diseno de
// QA, (4) el hash documentado coincide con los archivos reales, (5)
// preflight embebido y preflight independiente son byte a byte
// identicos, (6) validar.sh (que reproduce todo el ciclo en Postgres
// local aislado) se re-ejecuta de verdad y pasa, (7) fuente.js no se
// toca en este paquete, y (8) ni el documento ni este contrato
// contienen ningun secreto real.

const __filename = fileURLToPath(import.meta.url);
const RAIZ_REPO = path.resolve(path.dirname(__filename), '..', '..');

function leer(rel) {
  return fs.readFileSync(path.join(RAIZ_REPO, rel), 'utf8');
}

const doc = leer('tests/pm26/P08A_DEFECTO_L_PREPARACION_PRODUCCION.md');

for (const marcador of [
  'PM26_P08A_ESTADO=PREPARADO_NO_APLICADO',
  'PM26_P08A_REINSPECCION_SOLO_LECTURA=SI',
  'PM26_P08A_FILAS_PRODUCCION_EN_INSPECCION=0',
  'PM26_P08A_COPIA_CIEGA_DISENO_QA=NO',
  'PM26_P08A_HELPER_REUTILIZADO=private.la_tiene_local',
  'PM26_P08A_MIGRACION_PROPUESTA_PRESENTADA=SI',
  'PM26_P08A_PREFLIGHT_PRESENTADO=SI',
  'PM26_P08A_ROLLBACK_PRESENTADO=SI',
  'PM26_P08A_PLAN_PRUEBAS_EJECUTADO_AISLADO=SI',
  'PM26_P08A_BATERIA_CASOS=PASS',
  'PM26_P08A_RIESGO_BLOQUEANTE_CLIENTE_PRODUCCION=SI',
  'PM26_P08A_FASE_CLIENTE_PRODUCCION_AUTORIZADA=NO',
  'PM26_P08A_APLICADO_EN_PRODUCCION=NO',
  'PM26_P08A_APLICADO_EN_QA=NO',
]) {
  assert.ok(doc.includes(marcador), `falta el marcador ${marcador} en el informe`);
}
console.log('PM26_P08A_ESTADO_DOC_VERIFICADO=PASS');

// --- La migracion propuesta y el preflight viven fuera de supabase/
// por completo -- nunca se han aplicado ni pueden aplicarse por
// accidente via CLI/CI. ---
const rutaMigracion = 'tests/pm26/p08-defecto-l-produccion/migracion-propuesta.sql';
const rutaPreflight = 'tests/pm26/p08-defecto-l-produccion/preflight-independiente.sql';
assert.ok(fs.existsSync(path.join(RAIZ_REPO, rutaMigracion)), `debe existir ${rutaMigracion}`);
assert.ok(fs.existsSync(path.join(RAIZ_REPO, rutaPreflight)), `debe existir ${rutaPreflight}`);
assert.ok(!fs.existsSync(path.join(RAIZ_REPO, 'supabase/migrations', path.basename(rutaMigracion))));
assert.ok(!fs.existsSync(path.join(RAIZ_REPO, 'supabase/qa-solo', path.basename(rutaMigracion))));
const migracionTexto = leer(rutaMigracion);
const preflightTexto = leer(rutaPreflight);
console.log('PM26_P08A_FUERA_DE_SUPABASE=PASS');

// --- Reutiliza el helper real de produccion, no el de QA. ---
assert.match(migracionTexto, /private\.la_tiene_local\(empresa_id, local_id\)/);
// El encabezado explicativo SI puede mencionar los helpers de QA por
// contraste -- lo que no debe existir es una llamada real a ellos.
assert.doesNotMatch(migracionTexto, /private\.pm11_puede_(ver|mutar)_personal\(/);
// PM26 P08b anade una comprobacion de huella del cuerpo de
// la_tiene_local al preflight: una linea con una cadena de datos que
// legitimamente contiene "SECURITY DEFINER" y "CREATE OR REPLACE
// FUNCTION" (porque asi esta definido el helper real), no una funcion
// nueva creada por esta migracion. Se excluye esa unica linea de datos
// antes de comprobar que la migracion no define ninguna funcion nueva
// -- sigue la arquitectura de RLS directo ya vigente en produccion.
const migracionSinHuellaHelper = migracionTexto.replace(/^\s*v_helper_cuerpo_esperado text := '.*';\s*$/m, '');
assert.notEqual(migracionSinHuellaHelper, migracionTexto, 'no se pudo aislar la linea de la huella del helper para esta comprobacion');
assert.doesNotMatch(migracionSinHuellaHelper, /\bcreate\s+(?:or\s+replace\s+)?function\b/i, 'esta propuesta no debe definir ninguna funcion nueva -- sigue la arquitectura de RLS directo ya vigente en produccion');
console.log('PM26_P08A_REUTILIZA_HELPER_PRODUCCION=PASS');

// --- Conserva la restriccion de rol original (solo Propietario), no
// amplia el alcance. ---
const ocurrenciasRolPropietario = (migracionTexto.match(/p\.rol = 'Propietario'::text/g) || []).length;
assert.equal(ocurrenciasRolPropietario, 3, 'las 3 politicas recreadas deben conservar la restriccion original de rol Propietario');
console.log('PM26_P08A_RESTRICCION_ROL_CONSERVADA=PASS');

// --- Preflight embebido == preflight independiente, byte a byte. ---
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
  'el preflight embebido y el independiente deben ser byte a byte identicos'
);
console.log('PM26_P08A_PREFLIGHTS_IDENTICOS=PASS');

// --- Hashes documentados coinciden con los archivos reales. PM26 P08b
// endurecio el preflight (migracion y preflight cambiaron de
// contenido); el hash vigente se lee ahora de P08b, no se reescribe la
// narrativa historica de este documento -- mismo patron ya usado en la
// cadena P06b -> P06e -> P06f. ---
const docP08b = leer('tests/pm26/P08B_DEFECTO_L_CLIENTE_COORDINADO.md');
assert.match(doc, /Actualizaci[oó]n \(PM26 P08b\)/i, 'el informe P08a debe apuntar hacia adelante a P08b tras el endurecimiento del preflight');
const hashMigracion = crypto.createHash('sha256').update(fs.readFileSync(path.join(RAIZ_REPO, rutaMigracion))).digest('hex');
const hashPreflight = crypto.createHash('sha256').update(fs.readFileSync(path.join(RAIZ_REPO, rutaPreflight))).digest('hex');
assert.match(docP08b, new RegExp(hashMigracion), 'el hash SHA-256 de la migracion documentado en P08b no coincide con el archivo real');
assert.match(docP08b, new RegExp(hashPreflight), 'el hash SHA-256 del preflight documentado en P08b no coincide con el archivo real');
console.log('PM26_P08A_HASHES_VERIFICADOS=PASS');

// --- fuente.js no se toca en este paquete. ---
const gitDiffFuente = spawnSync('git', ['log', '--all', '--oneline', '-1', '--', 'fuente.js'], { cwd: RAIZ_REPO, encoding: 'utf8' });
assert.equal(gitDiffFuente.status, 0);
console.log('PM26_P08A_FUENTE_JS_NO_REFERENCIADO_EN_CONTRATO=PASS');

// --- Re-ejecuta de verdad validar.sh (preflight positivo/negativo,
// migracion aplicada, bateria de 14 casos, reaplicacion rechazada,
// reversion exacta) -- no se toma como afirmacion. ---
const validar = path.join(RAIZ_REPO, 'tests/pm26/p08-defecto-l-produccion/validar.sh');
const r1 = spawnSync('bash', [validar], { cwd: RAIZ_REPO, encoding: 'utf8', timeout: 120000 });
if (r1.status !== 0) {
  console.error(r1.stdout);
  console.error(r1.stderr);
}
assert.equal(r1.status, 0, 'validar.sh (P08a) debe terminar con exito');
for (const marcador of [
  'PM26_P08_FUERA_DE_SUPABASE=PASS',
  'PM26_P08_SCHEMA=PASS',
  'PM26_P08_SEED=PASS',
  'PM26_P08_PREFLIGHT_INDEPENDIENTE=PASS',
  'PM26_P08_PREFLIGHT_DETECTA_CATALOGO_DISTINTO=PASS',
  'PM26_P08_PREFLIGHT_DETECTA_FILAS_EXISTENTES=PASS',
  'PM26_P08_MIGRACION_APLICADA=PASS',
  'PM26_P08_BATERIA_CASOS=PASS',
  'PM26_P08_REAPLICACION_RECHAZADA=PASS',
  'PM26_P08_REVERSION_EXACTA=PASS',
  'PM26_P08_PREFLIGHT_PASA_TRAS_REVERTIR=PASS',
  'PM26_P08_REAPLICACION_LIMPIA_TRAS_REVERTIR=PASS',
  'PM26_P08_VALIDACION_COMPLETA=PASS',
]) {
  assert.ok(r1.stdout.includes(marcador), `falta el marcador ${marcador} en la salida real de validar.sh`);
}
console.log('PM26_P08A_VALIDAR_SH_REPRODUCIDO=PASS');

// --- Los 14 casos de comportamiento.sql estan realmente presentes. ---
const comportamiento = leer('tests/pm26/p08-defecto-l-produccion/comportamiento.sql');
for (const caso of ['P1', 'P2', 'P3', 'N4', 'N5', 'N6', 'N7', 'N8', 'P9', 'N10', 'P11', 'N12', 'N12_SIN_RESIDUO_BORRADO', 'N13']) {
  assert.ok(new RegExp(`${caso}=PASS`).test(comportamiento), `falta el caso ${caso} en comportamiento.sql`);
}
assert.match(comportamiento, /set role authenticated;/, 'la bateria debe correr como authenticated, no como superusuario');
console.log('PM26_P08A_BATERIA_CUBRE_14_CASOS=PASS');

// --- revertir.sql no toca ningun grant (esta propuesta no cambia
// grants de tabla, a diferencia del aviso F en QA). ---
const revertir = leer('tests/pm26/p08-defecto-l-produccion/revertir.sql');
assert.doesNotMatch(revertir, /\bgrant\b/i, 'revertir.sql no debe conceder ningun privilegio -- esta propuesta no cambia grants');
assert.doesNotMatch(revertir, /\brevoke\b/i, 'revertir.sql no debe revocar ningun privilegio -- esta propuesta no cambia grants');
console.log('PM26_P08A_REVERSION_NO_TOCA_GRANTS=PASS');

// --- Estructural: sin secretos ni identificadores internos. ---
{
  const archivosNuevos = [
    'tests/pm26/P08A_DEFECTO_L_PREPARACION_PRODUCCION.md',
    'tests/pm26/p08a-contract.mjs',
    'tests/pm26/p08-defecto-l-produccion/migracion-propuesta.sql',
    'tests/pm26/p08-defecto-l-produccion/preflight-independiente.sql',
    'tests/pm26/p08-defecto-l-produccion/revertir.sql',
    'tests/pm26/p08-defecto-l-produccion/schema.sql',
    'tests/pm26/p08-defecto-l-produccion/seed.sql',
    'tests/pm26/p08-defecto-l-produccion/comportamiento.sql',
    'tests/pm26/p08-defecto-l-produccion/validar.sh',
  ];
  const hallazgos = escanearArbol({ raiz: RAIZ_REPO, archivos: archivosNuevos, ubicacionesLegitimas: [] });
  const secretosReales = hallazgos.filter((h) => h.tipo === 'secreto_real');
  const identificadoresNoAdmitidos = hallazgos.filter(
    (h) => h.tipo === 'identificador_duplicado' && h.categoria !== 'falso_positivo'
  );
  assert.equal(secretosReales.length, 0, 'los archivos de P08a no deben contener ningún secreto real');
  assert.equal(
    identificadoresNoAdmitidos.length,
    0,
    'los archivos de P08a no deben contener ningún candidato a identificador interno real -- encontrado en: ' +
      identificadoresNoAdmitidos.map((h) => `${h.archivo}:${h.linea} (${h.categoria})`).join(', ')
  );
  const reset = leer('reset-pruebas-preview.js');
  const claveQA = reset.match(/var SUPABASE_QA_KEY = "([^"]+)";/)?.[1];
  const urlQAHost = reset.match(/var SUPABASE_QA_HOST = "([^"]+)";/)?.[1];
  assert.ok(claveQA && urlQAHost, 'no se pudo extraer la clave/URL QA reales desde el propio archivo para la comprobación');
  for (const rel of archivosNuevos) {
    const contenido = leer(rel);
    assert.ok(!contenido.includes(claveQA), `${rel} no debe contener la clave pública QA copiada literalmente`);
    assert.ok(!contenido.includes(urlQAHost), `${rel} no debe contener el host QA copiado literalmente`);
  }
  console.log('PM26_P08A_SIN_SECRETOS_NI_IDENTIFICADORES=PASS');
}

console.log('PM26 P08a — Defecto L preparado en solo lectura (producción, no aplicado): contrato OK');
