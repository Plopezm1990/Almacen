import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { spawnSync, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { escanearArbol } from '../../tools/seguridad/verificar-secretos-e-identificadores.mjs';

// PM26 P08c: contrato del endurecimiento final previo a produccion.
// Certifica que (1) revertir.sql adquiere ACCESS EXCLUSIVE ANTES de
// contar y lo mantiene hasta el COMMIT, sin dejar ninguna ventana
// entre el conteo y la retirada de columnas, (2) la prueba real de
// concurrencia con dos sesiones PostgreSQL se re-ejecuta de verdad y
// pasa, dos veces de forma independiente, (3) revertir-conservador.sql
// esta declarado y protegido como procedimiento excepcional y manual
// que REABRE el Defecto L y exige autorizacion explicita, (4) ninguna
// frase de esta cadena afirma que restaurar las politicas antiguas
// cierre o conserve el aislamiento, y (5) no se debilito ningun gate
// historico. No aplica ni despliega nada: todo se ejecuta contra un
// PostgreSQL local aislado.

const __filename = fileURLToPath(import.meta.url);
const RAIZ_REPO = path.resolve(path.dirname(__filename), '..', '..');
const CIERRE_P08B = 'ab1ba8aaaef05ad3908e6c311af3eec9362cf755';

function leer(rel) {
  return fs.readFileSync(path.join(RAIZ_REPO, rel), 'utf8');
}
function sha256(rel) {
  return crypto.createHash('sha256').update(fs.readFileSync(path.join(RAIZ_REPO, rel))).digest('hex');
}
// Normaliza espacios para poder buscar frases que en el Markdown estan
// partidas en varias lineas.
function norm(texto) {
  return texto.replace(/\s+/g, ' ');
}
// Quita los comentarios de linea SQL para comprobar unicamente lo que
// realmente se ejecuta.
function sqlEjecutable(texto) {
  return texto
    .split('\n')
    .filter((l) => !/^\s*--/.test(l))
    .join('\n');
}
// Al reves: deja solo el texto de los comentarios, sin los guiones, para
// poder buscar frases que estan partidas en varias lineas.
function textoComentario(texto) {
  return norm(
    texto
      .split('\n')
      .filter((l) => /^\s*--/.test(l))
      .map((l) => l.replace(/^\s*--\s?/, ''))
      .join(' ')
  );
}

const rutaDoc = 'tests/pm26/P08C_ENDURECIMIENTO_FINAL_PREVIO_PRODUCCION.md';
const rutaRevertir = 'tests/pm26/p08-defecto-l-produccion/revertir.sql';
const rutaConservador = 'tests/pm26/p08-defecto-l-produccion/revertir-conservador.sql';
const rutaConcurrencia = 'tests/pm26/p08-defecto-l-produccion/concurrencia-revertir.sh';

const doc = leer(rutaDoc);
const revertir = leer(rutaRevertir);
const conservador = leer(rutaConservador);
const concurrencia = leer(rutaConcurrencia);

// --- 1) Marcadores del informe. ---
for (const marcador of [
  'PM26_P08C_ESTADO=ENDURECIDO_NO_APLICADO_NO_DESPLEGADO',
  'PM26_P08C_REVERTIR_TRANSACCION_EXPLICITA=SI',
  'PM26_P08C_REVERTIR_TIMEOUTS=SI',
  'PM26_P08C_REVERTIR_ACCESS_EXCLUSIVE_ANTES_DEL_CONTEO=SI',
  'PM26_P08C_REVERTIR_BLOQUEO_HASTA_COMMIT=SI',
  'PM26_P08C_REVERTIR_ABORTA_SIN_BLOQUEO=SI',
  'PM26_P08C_REVERTIR_ABORTA_CON_FILAS=SI',
  'PM26_P08C_CARRERA_CONTEO_DROP_ELIMINADA=SI',
  'PM26_P08C_PRUEBA_CONCURRENTE_DOS_SESIONES=PASS',
  'PM26_P08C_CONTROL_NEGATIVO_ORDEN_ANTIGUO=PASS',
  'PM26_P08C_DOS_REPRODUCCIONES_INDEPENDIENTES=PASS',
  'PM26_P08C_CONSERVADOR_EXCEPCIONAL_Y_MANUAL=SI',
  'PM26_P08C_CONSERVADOR_EXIGE_AUTORIZACION_EXPLICITA=SI',
  'PM26_P08C_CONSERVADOR_REABRE_DEFECTO_L_DOCUMENTADO=SI',
  'PM26_P08C_CONSERVADOR_NO_ES_ROLLBACK_AUTOMATICO=SI',
  'PM26_P08C_AVANCE_CONTROLADO_PRIORIZADO=SI',
  'PM26_P08C_FRASES_ENGANOSAS_CORREGIDAS=SI',
  'PM26_P08C_SOLO_POSTGRES_LOCAL_AISLADO=SI',
  'PM26_P08C_GATES_HISTORICOS_NO_DEBILITADOS=SI',
  'PM26_P08C_APLICADO_EN_PRODUCCION=NO',
  'PM26_P08C_APLICADO_EN_QA=NO',
  'PM26_P08C_DESPLEGADO_EN_NETLIFY=NO',
  'PM26_P08C_MAIN_RELEASE_TOCADOS=NO',
  'PM26_P08C_PR_CERRADA_O_FUSIONADA=NO',
  'PM26_P08C_DEFECTO_L_CORREGIDO_EN_PRODUCCION=NO',
]) {
  assert.ok(doc.includes(marcador), `falta el marcador ${marcador} en el informe`);
}
console.log('PM26_P08C_ESTADO_DOC_VERIFICADO=PASS');

// --- 2) revertir.sql: bloqueo antes del conteo, sin ventana posible. ---
const revertirSQL = sqlEjecutable(revertir);
assert.match(revertirSQL, /^begin;$/m, 'revertir.sql debe abrir una transaccion explicita');
assert.match(revertirSQL, /^commit;$/m, 'revertir.sql debe cerrar la transaccion explicitamente');
assert.match(revertirSQL, /set local lock_timeout = '5s';/, 'revertir.sql debe acotar lock_timeout');
assert.match(revertirSQL, /set local statement_timeout = '30s';/, 'revertir.sql debe acotar statement_timeout');
assert.match(
  revertirSQL,
  /lock table public\.prefiltros_candidatos in access exclusive mode;/,
  'revertir.sql debe adquirir ACCESS EXCLUSIVE sobre la tabla'
);
assert.match(
  revertirSQL,
  /when lock_not_available then/,
  'revertir.sql debe capturar el fallo de adquisicion del bloqueo para dar un mensaje claro'
);
assert.match(revertirSQL, /ROLLBACK_FALLO: no se pudo adquirir ACCESS EXCLUSIVE/, 'el abort por bloqueo debe ser explicito');
assert.match(revertirSQL, /ROLLBACK_FALLO: prefiltros_candidatos tiene % filas/, 'el abort por filas existentes debe ser explicito');

// El orden es la garantia real: bloquear -> contar -> sustituir
// politicas -> retirar columnas, todo en la misma transaccion.
const iLock = revertirSQL.indexOf('lock table public.prefiltros_candidatos in access exclusive mode');
const iConteo = revertirSQL.indexOf('select count(*) into v_total from public.prefiltros_candidatos;');
const iPolitica = revertirSQL.indexOf('drop policy if exists');
const iColumna = revertirSQL.indexOf('drop column if exists empresa_id');
const iCommit = revertirSQL.indexOf('\ncommit;');
assert.ok(iLock > 0, 'no se localizo el LOCK TABLE');
assert.ok(iConteo > iLock, 'el conteo debe ir DESPUES de adquirir ACCESS EXCLUSIVE -- si no, la carrera sigue abierta');
assert.ok(iPolitica > iConteo, 'la sustitucion de politicas debe ir despues del conteo');
assert.ok(iColumna > iPolitica, 'la retirada de columnas debe ir despues de sustituir las politicas');
assert.ok(iCommit > iColumna, 'el bloqueo debe mantenerse hasta el COMMIT, con todo el trabajo dentro');

// El guard vive dentro de sus marcadores y contiene el bloqueo y el conteo.
const guard = revertir.slice(
  revertir.indexOf('-- PM26_P08C_GUARD_INICIO'),
  revertir.indexOf('-- PM26_P08C_GUARD_FIN')
);
assert.ok(guard.length > 0, 'faltan los marcadores del guard de P08c');
assert.match(guard, /lock table public\.prefiltros_candidatos in access exclusive mode;/);
assert.match(guard, /select count\(\*\) into v_total from public\.prefiltros_candidatos;/);

// Invariante historica de P08a: esta reversion no toca privilegios.
assert.doesNotMatch(revertir, /\bgrant\b/i, 'revertir.sql no debe conceder ningun privilegio (invariante de P08a)');
assert.doesNotMatch(revertir, /\brevoke\b/i, 'revertir.sql no debe revocar ningun privilegio (invariante de P08a)');
console.log('PM26_P08C_REVERTIR_ENDURECIDO_VERIFICADO=PASS');

// --- 3) revertir-conservador.sql: excepcional, manual, autorizado. ---
const conservadorSQL = sqlEjecutable(conservador);
assert.match(conservadorSQL, /ROLLBACK_CONSERVADOR_BLOQUEADO/, 'debe abortar si no hay autorizacion declarada');
assert.match(
  conservadorSQL,
  /current_setting\('pm26\.autorizacion_reapertura_defecto_l', true\)/,
  'la autorizacion debe leerse de la sesion, no del archivo'
);
assert.match(conservadorSQL, /<> 'CONFIRMADA'/, 'solo el valor CONFIRMADA debe permitir continuar');
// La declaracion de autorizacion NO puede vivir dentro del archivo: si
// estuviera, el procedimiento dejaria de ser manual.
assert.doesNotMatch(
  conservadorSQL,
  /set\s+(local\s+)?pm26\.autorizacion_reapertura_defecto_l/i,
  'el archivo no debe auto-declarar la autorizacion -- tiene que ponerla a mano quien lo ejecute'
);
// Sigue sin destruir datos.
assert.doesNotMatch(conservadorSQL, /drop column/i, 'revertir-conservador.sql nunca debe retirar columnas');
assert.doesNotMatch(conservadorSQL, /\bdelete\s+from\b/i, 'revertir-conservador.sql nunca debe eliminar filas');
assert.match(conservadorSQL, /alter column empresa_id drop not null/);
assert.match(conservadorSQL, /alter column local_id drop not null/);

const conservadorNorm = textoComentario(conservador);
for (const [etiqueta, patron] of [
  ['excepcional y manual', /PROCEDIMIENTO EXCEPCIONAL Y EXCLUSIVAMENTE MANUAL/i],
  ['no automatico', /NO forma parte de ningun procedimiento automatico/i],
  ['reabre el Defecto L', /REABRE el Defecto L/],
  ['riesgo entre empresas y locales', /riesgo de acceso entre empresas y locales/i],
  ['autorizacion explicita y separada', /autorizacion explicita y separada/i],
  ['avance controlado preferente', /VIA SEGURA PREFERENTE: AVANCE CONTROLADO/i],
]) {
  assert.match(conservadorNorm, patron, `revertir-conservador.sql debe declarar: ${etiqueta}`);
}
// Y debe decir explicitamente que conservar datos no es conservar aislamiento.
assert.match(conservadorNorm, /Conservar los datos NO es conservar el aislamiento/i);
console.log('PM26_P08C_CONSERVADOR_ENDURECIDO_VERIFICADO=PASS');

// --- 4) Ninguna frase afirma que restaurar las politicas conserve o
// cierre el aislamiento. La frase original se cita en las correcciones,
// asi que se comprueba que la AFIRMACION concreta ya no existe y que
// las correcciones estan presentes. ---
const docP08B = leer('tests/pm26/P08B_DEFECTO_L_CLIENTE_COORDINADO.md');
assert.ok(
  !norm(docP08B).includes('(ya incluido en el script) cierra inmediatamente el aislamiento revertido'),
  'la afirmacion corregida no debe seguir viva en P08b'
);
for (const [etiqueta, patron] of [
  ['la reversion elimina la proteccion', /no conserva el aislamiento: lo elimina/i],
  ['via segura preferente documentada', /V[ií]a segura preferente: avance controlado/i],
  ['conservador marcado como excepcional', /Procedimiento excepcional y exclusivamente manual/i],
]) {
  assert.match(norm(docP08B), patron, `P08b debe decir: ${etiqueta}`);
}
assert.match(
  textoComentario(revertir),
  /restaurar las 3 politicas originales NO conserva el aislamiento -- lo ELIMINA/i,
  'revertir.sql debe advertir en su cabecera que restaurar las politicas elimina el aislamiento'
);
console.log('PM26_P08C_FRASES_ENGANOSAS_CORREGIDAS_VERIFICADO=PASS');

// --- 5) Hashes documentados de los artefactos endurecidos. ---
for (const rel of [rutaRevertir, rutaConservador, rutaConcurrencia]) {
  assert.ok(doc.includes(sha256(rel)), `el informe no contiene el SHA-256 real de ${rel}`);
}
console.log('PM26_P08C_HASHES_VERIFICADOS=PASS');

// --- 6) La prueba de concurrencia solo admite PostgreSQL local. ---
assert.match(concurrencia, /PGHOST apunta a un host no local/, 'la prueba debe rechazar un PGHOST remoto');
assert.match(concurrencia, /drop database if exists/, 'la prueba debe crear y destruir su propia base temporal');
assert.doesNotMatch(concurrencia, /supabase\.co/i, 'la prueba no debe referirse a ningun host remoto');

// --- 7) Se re-ejecuta de verdad, dos veces de forma independiente. ---
const marcadoresConcurrencia = [
  'PM26_P08C_CONC_ENTORNO_LOCAL=PASS',
  'PM26_P08C_CONC_ESQUEMA_MIGRADO=PASS',
  'PM26_P08C_CONC1_REVERSION_ABORTA_CON_INSERT_EN_VUELO=PASS',
  'PM26_P08C_CONC1_SIN_DANO_NI_REVERSION_PARCIAL=PASS',
  'PM26_P08C_CONC2_INSERT_BLOQUEADO_BAJO_ACCESS_EXCLUSIVE=PASS',
  'PM26_P08C_CONC2_CERO_FILAS_COLADAS=PASS',
  'PM26_P08C_CONC3_CONTROL_NEGATIVO_ORDEN_ANTIGUO_PIERDE_DATOS=PASS',
  'PM26_P08C_CONCURRENCIA_COMPLETA=PASS',
];
const scriptConcurrencia = path.join(RAIZ_REPO, rutaConcurrencia);
for (const intento of [1, 2]) {
  const r = spawnSync('bash', [scriptConcurrencia], { cwd: RAIZ_REPO, encoding: 'utf8', timeout: 300000 });
  if (r.status !== 0) {
    console.error(r.stdout);
    console.error(r.stderr);
  }
  assert.equal(r.status, 0, `la prueba de concurrencia debe pasar (reproduccion ${intento})`);
  for (const marcador of marcadoresConcurrencia) {
    assert.ok(r.stdout.includes(marcador), `falta ${marcador} en la reproduccion ${intento}`);
  }
}
console.log('PM26_P08C_CONCURRENCIA_REPRODUCIDA_DOS_VECES=PASS');

// --- 8) validar.sh cubre el rechazo por falta de autorizacion. ---
const validar = leer('tests/pm26/p08-defecto-l-produccion/validar.sh');
assert.match(validar, /PM26_P08_ROLLBACK_CONSERVADOR_EXIGE_AUTORIZACION=PASS/);
assert.match(validar, /ROLLBACK_CONSERVADOR_BLOQUEADO/);
assert.match(
  validar,
  /set pm26\.autorizacion_reapertura_defecto_l = 'CONFIRMADA';/,
  'la prueba positiva debe declarar la autorizacion fuera del archivo'
);
console.log('PM26_P08C_VALIDAR_SH_CUBRE_AUTORIZACION=PASS');

// --- 9) Gates historicos intactos: P08c solo anade comprobaciones. ---
for (const [rel, patron, etiqueta] of [
  ['tests/pm26/p06h-contract.mjs', /extraerBloquesEsQA/, 'P06h conserva la prohibicion de mutar en QA'],
  ['tests/pm26/p07b-contract.mjs', /extraerBloquesEsQA/, 'P07b conserva la prohibicion de mutar en QA'],
  ['tests/pm26/p07c-contract.mjs', /CIERRE_HISTORICO/, 'P07c sigue anclado a su cierre historico'],
  ['tests/pm26/p08a-contract.mjs', /revertir\.sql no debe conceder ningun privilegio/, 'P08a conserva su invariante'],
  ['tests/pm26/p08b-contract.mjs', /PM26_P08_ROLLBACK_CONSERVADOR_PRESERVA_DATOS/, 'P08b conserva su bateria'],
]) {
  assert.match(leer(rel), patron, `gate historico debilitado: ${etiqueta}`);
}
console.log('PM26_P08C_GATES_HISTORICOS_INTACTOS=PASS');

// --- 10) P08c no toca el cliente ni supabase/. ---
const tocadosCliente = execFileSync(
  'git',
  ['diff', '--name-only', CIERRE_P08B, '--', 'fuente.js', 'source-recovery', 'index.html', 'reset-pruebas-preview.js', '_headers'],
  { cwd: RAIZ_REPO, encoding: 'utf8' }
).trim();
assert.equal(tocadosCliente, '', `P08c no debe tocar el cliente ni la configuracion servida -- cambiados: ${tocadosCliente}`);
const tocadosSupabase = execFileSync('git', ['diff', '--name-only', CIERRE_P08B, '--', 'supabase'], {
  cwd: RAIZ_REPO,
  encoding: 'utf8',
}).trim();
assert.equal(tocadosSupabase, '', `P08c no debe tocar supabase/ -- cambiados: ${tocadosSupabase}`);
assert.ok(
  !fs.readdirSync(path.join(RAIZ_REPO, 'supabase/migrations')).some((n) => /prefiltro/i.test(n)),
  'no debe existir ninguna migracion real del Defecto L en supabase/migrations'
);
assert.ok(!fs.existsSync(path.join(RAIZ_REPO, 'supabase/qa-solo', 'revertir-conservador.sql')));
console.log('PM26_P08C_FUERA_DE_SUPABASE_Y_CLIENTE=PASS');

// --- 11) Sin secretos ni identificadores internos. ---
{
  const archivosNuevos = [
    rutaDoc,
    'tests/pm26/p08c-contract.mjs',
    rutaRevertir,
    rutaConservador,
    rutaConcurrencia,
    'tests/pm26/p08-defecto-l-produccion/validar.sh',
    'tests/pm26/P08B_DEFECTO_L_CLIENTE_COORDINADO.md',
    '.github/workflows/pm26-p08c-endurecimiento-final.yml',
  ];
  const hallazgos = escanearArbol({ raiz: RAIZ_REPO, archivos: archivosNuevos, ubicacionesLegitimas: [] });
  const secretos = hallazgos.filter((h) => h.tipo === 'secreto_real');
  const identificadores = hallazgos.filter(
    (h) => h.tipo === 'identificador_duplicado' && h.categoria !== 'falso_positivo'
  );
  assert.equal(secretos.length, 0, 'P08c no debe introducir secretos reales');
  assert.equal(
    identificadores.length,
    0,
    'P08c no debe introducir identificadores internos -- encontrado en: ' +
      identificadores.map((h) => `${h.archivo}:${h.linea}`).join(', ')
  );
  console.log('PM26_P08C_SIN_SECRETOS_NI_IDENTIFICADORES=PASS');
}

console.log('PM26 P08c — endurecimiento final previo a producción: contrato OK');
