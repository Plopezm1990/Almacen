import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { spawnSync, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { escanearArbol } from '../../tools/seguridad/verificar-secretos-e-identificadores.mjs';

// PM26 P08g: contrato del catalogo backend de empresas/locales y la
// plantilla de bootstrap de membresia real. Certifica que (1) el
// informe deja constancia de que esto resuelve la precondicion
// bloqueada en P08e sin debilitarla, (2) el catalogo propuesto activa
// RLS sin ninguna politica y revoca explicitamente todo privilegio de
// authenticated/anon/public -- solo una via administrativa puede
// escribirlo o leerlo, (3) la bateria de comportamiento (control
// negativo real en PostgreSQL local aislado) demuestra ese bloqueo,
// incluida la via administrativa que si puede y la FK que ni ella
// puede saltarse, (4) la plantilla de bootstrap no contiene ningun
// identificador real, solo marcadores <<...>>, (5) el validador local
// se re-ejecuta de verdad y con el catalogo y la membresia sintetica ya
// creados el preflight de P08e sigue pasando sin modificacion, y (6) no
// se debilito ningun gate historico. No aplica el catalogo ni la
// plantilla en ningun entorno real, no crea ninguna membresia real y no
// recibe ni contiene ningun identificador real.

const __filename = fileURLToPath(import.meta.url);
const RAIZ_REPO = path.resolve(path.dirname(__filename), '..', '..');
const CIERRE_P08F = 'a8032bc9b53efe70fa0d4ecec47888cb3f13765c';

const rutaDoc = 'tests/pm26/P08G_CATALOGO_Y_BOOTSTRAP_MEMBRESIA.md';
const rutaCatalogo = 'tests/pm26/p08g-catalogo-membresia/catalogo-empresas-locales-propuesta.sql';
const rutaPlantilla = 'tests/pm26/p08g-catalogo-membresia/bootstrap-membresia-plantilla.sql';
const rutaBateria = 'tests/pm26/p08g-catalogo-membresia/comportamiento-catalogo.sql';
const rutaValidador = 'tests/pm26/p08g-catalogo-membresia/validar-catalogo.sh';
const rutaPreflight = 'tests/pm26/p08-defecto-l-produccion/preflight-independiente.sql';

function leer(rel) {
  return fs.readFileSync(path.join(RAIZ_REPO, rel), 'utf8');
}
function sha256(rel) {
  return crypto.createHash('sha256').update(fs.readFileSync(path.join(RAIZ_REPO, rel))).digest('hex');
}
function sqlEjecutable(texto) {
  return texto
    .split('\n')
    .filter((l) => !/^\s*--/.test(l))
    .join('\n');
}

const doc = leer(rutaDoc);
const catalogo = leer(rutaCatalogo);
const plantilla = leer(rutaPlantilla);
const bateria = leer(rutaBateria);
const validador = leer(rutaValidador);

// --- 1) Marcadores del informe. ---
for (const marcador of [
  'PM26_P08G_ESTADO=PREPARADO_NO_APLICADO',
  'PM26_P08G_CATALOGO_DISEÑADO=SI',
  'PM26_P08G_CATALOGO_RLS_SIN_POLITICAS=SI',
  'PM26_P08G_CATALOGO_ESCRITURA_SOLO_ADMINISTRATIVA=SI',
  'PM26_P08G_CATALOGO_LECTURA_SOLO_ADMINISTRATIVA=SI',
  'PM26_P08G_PLANTILLA_SIN_IDENTIFICADORES_REALES=SI',
  'PM26_P08G_SESION_NO_VE_IDENTIFICADORES_REALES=SI',
  'PM26_P08G_BATERIA_COMPORTAMIENTO_EJECUTADA=SI',
  'PM26_P08G_VALIDADOR_LOCAL_REPRODUCIDO=SI',
  'PM26_P08G_PREFLIGHT_P08E_NO_DEBILITADO=SI',
  'PM26_P08G_CATALOGO_APLICADO_EN_SUPABASE=NO',
  'PM26_P08G_MEMBRESIA_CREADA=NO',
  'PM26_P08G_ESCRITURA_EN_PRODUCCION_QA_TPV=NO',
  'PM26_P08G_MIGRACION_DEFECTO_L_APLICADA=NO',
  'PM26_P08G_PARCHE_P08D_DESPLEGADO=NO',
  'PM26_P08G_DESPLEGADO_EN_NETLIFY=NO',
  'PM26_P08G_MAIN_RELEASE_TOCADOS=NO',
  'PM26_P08G_PR_38_CERRADA_O_FUSIONADA=NO',
  'PM26_P08G_DEFECTO_L_CORREGIDO_EN_PRODUCCION=NO',
]) {
  assert.ok(doc.includes(marcador), `falta el marcador ${marcador} en el informe`);
}
console.log('PM26_P08G_DOC_MARCADORES_VERIFICADOS=PASS');

// --- 2) El catalogo propuesto: RLS activada, cero politicas, revoke
// explicito de authenticated/anon/public en las dos tablas, sin
// depender de la migracion del Defecto L, fuera de supabase/migrations. ---
const catalogoSQL = sqlEjecutable(catalogo);
assert.match(catalogoSQL, /create table if not exists public\.empresas/, 'debe crear public.empresas');
assert.match(catalogoSQL, /create table if not exists public\.locales/, 'debe crear public.locales');
assert.match(
  catalogoSQL,
  /empresa_id text not null references public\.empresas\(id\)/,
  'locales.empresa_id debe referenciar empresas por FK'
);
assert.match(catalogoSQL, /alter table public\.empresas enable row level security/, 'RLS activada en empresas');
assert.match(catalogoSQL, /alter table public\.locales enable row level security/, 'RLS activada en locales');
assert.doesNotMatch(catalogoSQL, /create policy/, 'el catalogo no debe tener ninguna politica -- solo RLS+revoke');
assert.match(
  catalogoSQL,
  /revoke all on public\.empresas from authenticated, anon, public/,
  'debe revocar explicitamente todo privilegio en empresas'
);
assert.match(
  catalogoSQL,
  /revoke all on public\.locales from authenticated, anon, public/,
  'debe revocar explicitamente todo privilegio en locales'
);
for (const prohibido of [/\bgrant\b.*\bauthenticated\b/i, /\bgrant\b.*\banon\b/i]) {
  assert.doesNotMatch(catalogoSQL, prohibido, `el catalogo no debe conceder nada a authenticated/anon -- encontrado ${prohibido}`);
}
console.log('PM26_P08G_CATALOGO_ESTRUCTURA_VERIFICADA=PASS');

// --- 3) La plantilla de bootstrap: solo marcadores <<...>>, ningun
// identificador real, ambas variantes presentes e idempotentes. ---
for (const marcador of ['<<EMPRESA_ID>>', '<<EMPRESA_NOMBRE>>', '<<LOCAL_ID>>', '<<LOCAL_NOMBRE>>', '<<UUID_PROPIETARIO>>']) {
  assert.ok(plantilla.includes(marcador), `falta el marcador ${marcador} en la plantilla`);
}
assert.doesNotMatch(
  plantilla,
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
  'la plantilla no debe contener ningun UUID -- ni siquiera sintetico, solo el marcador'
);
assert.match(plantilla, /insert into public\.empresas \(id, nombre, activo\)/, 'debe insertar la empresa');
assert.match(plantilla, /on conflict \(id\) do nothing/, 'el insert de empresas debe ser idempotente');
assert.match(plantilla, /insert into public\.locales \(id, empresa_id, nombre, activo\)/, 'debe insertar el local');
assert.match(plantilla, /Variante A/, 'debe ofrecer la variante todos_locales');
assert.match(plantilla, /Variante B/, 'debe ofrecer la variante de un local concreto');
assert.match(
  plantilla,
  /select '<<UUID_PROPIETARIO>>', '<<EMPRESA_ID>>', null, true, 'Propietario', true/,
  'la variante A debe insertar todos_locales=true con local_id null'
);
assert.match(
  plantilla,
  /-- select '<<UUID_PROPIETARIO>>', '<<EMPRESA_ID>>', '<<LOCAL_ID>>', false, 'Propietario', true/,
  'la variante B debe estar comentada por defecto'
);
assert.match(
  plantilla,
  /where not exists \(\s*\n\s*select 1 from public\.membresias_usuario/,
  'el insert de membresia debe ser idempotente via where not exists'
);
// Las 3 verificaciones finales, cada una filtrando por los marcadores.
assert.match(plantilla, /select \* from public\.empresas where id = '<<EMPRESA_ID>>'/);
assert.match(plantilla, /select \* from public\.locales where id = '<<LOCAL_ID>>'/);
assert.match(
  plantilla,
  /select \* from public\.membresias_usuario\s*\n\s*where user_id = '<<UUID_PROPIETARIO>>' and empresa_id = '<<EMPRESA_ID>>' and activo = true/
);
console.log('PM26_P08G_PLANTILLA_SIN_IDENTIFICADORES_VERIFICADA=PASS');

// --- 4) La bateria cubre los 5 casos, cada uno con reporte de exito y
// de fallo (no puede pasar de forma vacia). ---
for (const caso of ['C1', 'C2', 'C3', 'C4', 'C5']) {
  assert.ok(bateria.includes(`${caso}=PASS`), `la bateria debe poder reportar ${caso}=PASS`);
  assert.ok(bateria.includes(`${caso}=FAIL`), `la bateria debe poder reportar ${caso}=FAIL -- si no, no prueba nada`);
}
assert.match(bateria, /set role authenticated/, 'C1/C2/C3 deben probar bajo el rol authenticated');
assert.match(bateria, /insert into public\.empresas \(id, nombre\) values \('EMPRESA_TEST'/, 'C4 debe probar la via administrativa');
assert.match(
  bateria,
  /insert into public\.locales \(id, empresa_id, nombre\) values \('LOCAL_HUERFANO', 'EMPRESA_INEXISTENTE'/,
  'C5 debe probar la FK contra una empresa inexistente'
);
assert.match(bateria, /delete from public\.locales where id in \('LOCAL_TEST', 'LOCAL_HUERFANO'\)/, 'la bateria debe autolimpiarse');
console.log('PM26_P08G_BATERIA_CUBRE_CASOS=PASS');

// --- 5) El validador solo admite PostgreSQL local, usa stdin (nunca -f
// contra el arbol de trabajo) y nunca ejecuta la plantilla real -- solo
// la sintetica sustituida por sed. ---
assert.match(validador, /PGHOST apunta a un host no local/, 'el validador debe rechazar un PGHOST remoto');
assert.match(validador, /drop database if exists/, 'el validador debe crear y destruir su propia base temporal');
assert.doesNotMatch(validador, /supabase\.co/i, 'el validador no debe referirse a ningun host remoto');
assert.doesNotMatch(validador, /psql .*-f\s/, 'el validador no debe usar psql -f contra el arbol de trabajo');
for (const sint of ['EEEEEEEE', 'LLLLLLLL', '99999999-9999-9999-9999-999999999999']) {
  assert.ok(validador.includes(sint), `el validador debe usar el valor sintetico ${sint}`);
}
console.log('PM26_P08G_VALIDADOR_ESTRUCTURA_VERIFICADA=PASS');

// --- 6) El validador se re-ejecuta de verdad, con todos sus
// marcadores, contra PostgreSQL local aislado. ---
const marcadoresValidador = [
  'PM26_P08G_ENTORNO_LOCAL=PASS',
  'PM26_P08G_ESQUEMA_Y_SEED=PASS',
  'PM26_P08G_CATALOGO_NO_EXISTE_ANTES=PASS',
  'PM26_P08G_CATALOGO_APLICADO=PASS',
  'PM26_P08G_BATERIA_CATALOGO=PASS',
  'PM26_P08G_CATALOGO_REAPLICACION_IDEMPOTENTE=PASS',
  'PM26_P08G_PLANTILLA_APLICADA=PASS',
  'PM26_P08G_PLANTILLA_CREA_EXACTAMENTE_UNA_FILA_CADA_UNA=PASS',
  'PM26_P08G_PLANTILLA_REAPLICACION_IDEMPOTENTE=PASS',
  'PM26_P08G_PREFLIGHT_P08E_SIGUE_PASANDO=PASS',
  'PM26_P08G_VALIDACION_COMPLETA=PASS',
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
  assert.equal(r.status, 0, 'validar-catalogo.sh debe terminar con exito');
  for (const marcador of marcadoresValidador) {
    assert.ok(r.stdout.includes(marcador), `falta el marcador ${marcador} en la salida real del validador`);
  }
}
console.log('PM26_P08G_VALIDADOR_REPRODUCIDO=PASS');

// --- 7) Control negativo: sin RLS+revoke, la via administrativa seguiria
// pudiendo escribir igual, pero un authenticated con GRANT SELECT si
// podria leer el catalogo -- demuestra que es el revoke (no otra cosa)
// lo que bloquea la lectura de authenticated (C3). ---
{
  const db = `pm26_p08g_ctr_${process.pid}`;
  const base = path.join(RAIZ_REPO, 'tests/pm26/p08-defecto-l-produccion');
  function psql(args, entrada) {
    return spawnSync('sudo', ['-u', 'postgres', 'psql', ...args], {
      encoding: 'utf8',
      input: entrada,
      timeout: 180000,
    });
  }
  const limpiar = () => psql(['-c', `drop database if exists "${db}" with (force);`]);
  try {
    limpiar();
    assert.equal(psql(['-c', `create database "${db}";`]).status, 0, 'no se pudo crear la base temporal');
    for (const f of ['schema.sql', 'seed.sql']) {
      const r = psql(['-d', db, '-v', 'ON_ERROR_STOP=1'], fs.readFileSync(path.join(base, f), 'utf8'));
      assert.equal(r.status, 0, `no se pudo aplicar ${f}: ${r.stderr}`);
    }
    const r1 = psql(['-d', db, '-v', 'ON_ERROR_STOP=1'], catalogo);
    assert.equal(r1.status, 0, `no se pudo aplicar el catalogo: ${r1.stderr}`);

    // 7a) Con el catalogo tal cual: authenticated no puede leer.
    const salidaConRevoke = psql(
      ['-d', db, '-v', 'ON_ERROR_STOP=1'],
      "set role authenticated; select count(*) from public.empresas; reset role;"
    );
    assert.notEqual(salidaConRevoke.status, 0, 'con el revoke, authenticated no debe poder leer empresas');
    assert.match(salidaConRevoke.stderr, /permission denied/, 'el rechazo debe ser por permiso denegado');

    // 7b) Mutante: si se concede SELECT a authenticated (deshaciendo el
    // revoke), la misma consulta pasaria -- control negativo real: si
    // esto tambien fallara, el revoke seria redundante y 7a no
    // demostraria nada.
    const mutanteSQL = catalogo.replace(
      'revoke all on public.empresas from authenticated, anon, public;',
      'grant select on public.empresas to authenticated;'
    );
    assert.notEqual(mutanteSQL, catalogo, 'la mutacion no llego a cambiar el revoke -- prueba invalida');
    limpiar();
    assert.equal(psql(['-c', `create database "${db}";`]).status, 0);
    for (const f of ['schema.sql', 'seed.sql']) {
      psql(['-d', db, '-v', 'ON_ERROR_STOP=1'], fs.readFileSync(path.join(base, f), 'utf8'));
    }
    const r2 = psql(['-d', db, '-v', 'ON_ERROR_STOP=1'], mutanteSQL);
    assert.equal(r2.status, 0, `no se pudo aplicar el catalogo mutado: ${r2.stderr}`);
    const salidaMutante = psql(
      ['-d', db, '-v', 'ON_ERROR_STOP=1'],
      "set role authenticated; select count(*) from public.empresas; reset role;"
    );
    assert.equal(
      salidaMutante.status,
      0,
      `sin el revoke de SELECT, authenticated deberia poder leer (control negativo): ${salidaMutante.stderr}`
    );
  } finally {
    limpiar();
  }
}
console.log('PM26_P08G_CONTROL_NEGATIVO_REVOKE=PASS');

// --- 8) Sin identificadores hardcodeados fuera de la bateria (que solo
// usa sinteticos de un digito repetido) ni en la plantilla (que no debe
// tener ninguno, ni siquiera sintetico). ---
for (const uuid of bateria.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi) || []) {
  assert.match(uuid, /^(.)\1{7}-\1{4}-\1{4}-\1{4}-\1{12}$/, `la bateria contiene un UUID no sintetico: ${uuid}`);
}
console.log('PM26_P08G_SIN_IDENTIFICADORES_HARDCODEADOS=PASS');

// --- 9) Huellas documentadas. ---
for (const rel of [rutaCatalogo, rutaPlantilla, rutaBateria, rutaValidador]) {
  assert.ok(doc.includes(sha256(rel)), `el informe no contiene el SHA-256 real de ${rel}`);
}
console.log('PM26_P08G_HASHES_VERIFICADOS=PASS');

// --- 10) Nada aplicado, nada desplegado, nada fuera de sitio; sin tocar
// el cliente, supabase/, ni la migracion o preflight de P08. ---
assert.ok(
  !fs.readdirSync(path.join(RAIZ_REPO, 'supabase/migrations')).some((n) => /prefiltro/i.test(n)),
  'no debe existir ninguna migracion real del Defecto L en supabase/migrations'
);
const tocadosFuera = execFileSync(
  'git',
  [
    'diff',
    '--name-only',
    CIERRE_P08F,
    '--',
    'fuente.js',
    'source-recovery',
    'index.html',
    'reset-pruebas-preview.js',
    '_headers',
    'supabase',
    'tests/pm26/p08-defecto-l-produccion/migracion-propuesta.sql',
    'tests/pm26/p08-defecto-l-produccion/preflight-independiente.sql',
  ],
  { cwd: RAIZ_REPO, encoding: 'utf8' }
).trim();
assert.equal(tocadosFuera, '', `P08g no debe tocar el cliente, supabase/, ni la migracion/preflight de P08 -- cambiados: ${tocadosFuera}`);
console.log('PM26_P08G_NADA_APLICADO_NI_DESPLEGADO=PASS');

// --- 11) Gates historicos intactos. ---
for (const [rel, patron, etiqueta] of [
  ['tests/pm26/p08e-contract.mjs', /PM26_P08E_CONTROL_NEGATIVO_SIN_GUARD/, 'P08e conserva su control negativo'],
  ['tests/pm26/p08d-contract.mjs', /el parche debe tocar exclusivamente/, 'P08d conserva el aislamiento del candidato'],
  ['tests/pm26/p08f-contract.mjs', /PM26_P08F_PASOS_PROTECTORES_ANCLADOS/, 'P08f conserva el anclaje historico'],
]) {
  assert.match(leer(rel), patron, `gate historico debilitado: ${etiqueta}`);
}
const docP08E = leer('tests/pm26/P08E_PRECONDICION_MEMBRESIAS_LEGACY.md');
assert.match(docP08E, /PM26_P08E_CATALOGO_CON_AUTORIDAD_REAL_EXISTE=NO/, 'P08e debe seguir documentando que el catalogo con autoridad real no existe todavia (P08g solo lo prepara, no lo aplica)');
console.log('PM26_P08G_GATES_HISTORICOS_INTACTOS=PASS');

// --- 12) Sin secretos ni identificadores internos. ---
{
  const archivosNuevos = [
    rutaDoc,
    rutaCatalogo,
    rutaPlantilla,
    rutaBateria,
    rutaValidador,
    'tests/pm26/p08g-contract.mjs',
    '.github/workflows/pm26-p08g-catalogo-membresia.yml',
  ];
  const hallazgos = escanearArbol({ raiz: RAIZ_REPO, archivos: archivosNuevos, ubicacionesLegitimas: [] });
  const secretos = hallazgos.filter((h) => h.tipo === 'secreto_real');
  const identificadores = hallazgos.filter(
    (h) => h.tipo === 'identificador_duplicado' && h.categoria !== 'falso_positivo'
  );
  assert.equal(secretos.length, 0, 'P08g no debe introducir secretos reales');
  assert.equal(
    identificadores.length,
    0,
    'P08g no debe introducir identificadores internos -- encontrado en: ' +
      identificadores.map((h) => `${h.archivo}:${h.linea}`).join(', ')
  );
  console.log('PM26_P08G_SIN_SECRETOS_NI_IDENTIFICADORES=PASS');
}

console.log('PM26 P08g — catálogo backend y plantilla de bootstrap: contrato OK');
