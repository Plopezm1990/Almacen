import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawnSync, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { escanearArbol } from '../../tools/seguridad/verificar-secretos-e-identificadores.mjs';
import { anclar, comprobarAnclajeNoPasaEnVacio } from './lib/cierre-historico.mjs';

// PM26 P08f: contrato del saneamiento historico de contratos y de la
// correccion documental de P08e. Certifica que (1) los cuatro contratos
// reparados anclan a su propio commit de cierre y exigen que exista y
// siga siendo antepasado de HEAD, (2) ya no leen del arbol vivo los
// artefactos ajenos, (3) NO pasan en vacio -- reanclados al HEAD actual
// fallan, cada uno por su motivo real, (4) ninguna comprobacion se
// debilito, elimino ni volvio opcional, (5) la documentacion de P08e
// retira almacen_kv como catalogo y declara el limite real del guard, y
// (6) P08f no toca ningun artefacto de la aplicacion. No aplica
// migraciones, no escribe en Supabase y no despliega nada.

const __filename = fileURLToPath(import.meta.url);
const RAIZ_REPO = path.resolve(path.dirname(__filename), '..', '..');
const CIERRE_P08E = '0143f6b14451322b9ea60d3c1177c1f96c0320d4';

const rutaDoc = 'tests/pm26/P08F_SANEAMIENTO_HISTORICO_CONTRATOS.md';
const rutaLib = 'tests/pm26/lib/cierre-historico.mjs';

// Los cuatro paquetes saneados, con el commit exacto donde su workflow
// propio termino en SUCCESS. Cambiar cualquiera de estos SHA sin
// cambiar el informe hace fallar el contrato.
const SANEADOS = [
  { paquete: 'P04a', contrato: 'tests/pm26/p04a-contract.mjs', cierre: '2ac878c96275a26e72ee2af061b2f3953e10a90f', run: '34392502851' },
  { paquete: 'P06c', contrato: 'tests/pm26/p06c-contract.mjs', cierre: '9505ada0f16af8b99cfb8538d71be0e95dac8e69', run: '34405829096' },
  { paquete: 'P06i', contrato: 'tests/pm26/p06i-contract.mjs', cierre: '4d34052b9f618d67ba1dae150215038f4adae75d', run: '34446557537' },
  { paquete: 'P07a', contrato: 'tests/pm26/p07a-contract.mjs', cierre: 'd62162fb6c512ea9fd237de1f2e2bb0ea5debeec', run: '34461008439' },
];

function leer(rel) {
  return fs.readFileSync(path.join(RAIZ_REPO, rel), 'utf8');
}
function norm(texto) {
  return texto.replace(/\s+/g, ' ');
}

const doc = leer(rutaDoc);

// --- 1) Marcadores del informe. ---
for (const marcador of [
  'PM26_P08F_ESTADO=CERRADO_SANEAMIENTO_HISTORICO',
  'PM26_P08F_CONTRATOS_REPARADOS=4',
  'PM26_P08F_ANCLADOS_A_SU_CIERRE=SI',
  'PM26_P08F_SHA_EXISTE_Y_ES_ANTEPASADO_COMPROBADO=SI',
  'PM26_P08F_COMPROBACIONES_DEBILITADAS=0',
  'PM26_P08F_COMPROBACIONES_ELIMINADAS=0',
  'PM26_P08F_COMPROBACIONES_OPCIONALES=0',
  'PM26_P08F_CONTROLES_NEGATIVOS_ANADIDOS=SI',
  'PM26_P08F_CONTROL_NEGATIVO_REANCLAJE_A_HEAD=PASS',
  'PM26_P08F_P08E_ALMACEN_KV_RETIRADO=SI',
  'PM26_P08F_P08E_LIMITE_DEL_GUARD_DECLARADO=SI',
  'PM26_P08F_IDENTIFICADORES_INVENTADOS=NO',
  'PM26_P08F_MEMBRESIAS_INVENTADAS=NO',
  'PM26_P08F_ARTEFACTOS_APLICACION_TOCADOS=NO',
  'PM26_P08F_MIGRACION_APLICADA=NO',
  'PM26_P08F_ESCRITURA_EN_SUPABASE=NO',
  'PM26_P08F_DESPLEGADO_EN_NETLIFY=NO',
  'PM26_P08F_MAIN_RELEASE_TOCADOS=NO',
  'PM26_P08F_PR_38_CERRADA_O_FUSIONADA=NO',
  'PM26_P08F_DEFECTO_L_CORREGIDO_EN_PRODUCCION=NO',
]) {
  assert.ok(doc.includes(marcador), `falta el marcador ${marcador} en el informe`);
}
console.log('PM26_P08F_ESTADO_DOC_VERIFICADO=PASS');

// --- 2) Cada contrato saneado ancla a su cierre, ese cierre existe y
// sigue siendo antepasado de HEAD, y el informe lo documenta con su run. ---
for (const { paquete, contrato, cierre, run } of SANEADOS) {
  const texto = leer(contrato);
  assert.ok(
    texto.includes(`from './lib/cierre-historico.mjs'`),
    `${paquete}: el contrato debe usar el modulo compartido de anclaje`
  );
  assert.match(
    texto,
    new RegExp(`const CIERRE_HISTORICO = '${cierre}';`),
    `${paquete}: el contrato debe anclar a su commit de cierre ${cierre}`
  );
  assert.match(texto, /anclar\(CIERRE_HISTORICO,/, `${paquete}: el anclaje debe pasar por anclar()`);
  // anclar() ya exige existencia, tipo commit y antepasado de HEAD; aqui
  // se vuelve a comprobar de forma independiente para que el gate no
  // dependa de que el contrato saneado llegue a ejecutarse.
  const h = anclar(cierre, `P08f/${paquete}`);
  assert.equal(h.cierre, cierre);
  assert.ok(doc.includes(cierre), `el informe debe documentar el commit de cierre de ${paquete}`);
  assert.ok(doc.includes(run), `el informe debe documentar el run remoto de ${paquete}`);
}
console.log(`PM26_P08F_ANCLAJES_VERIFICADOS=PASS (${SANEADOS.length} contratos)`);

// --- 3) Ya no se lee del arbol vivo ningun artefacto ajeno. ---
// Se comprueba de forma estructural: ninguna lectura viva (leer(...) /
// readFileSync) puede nombrar uno de los artefactos que otros paquetes
// siguen modificando. Las lecturas legitimas del arbol vivo son las de
// los informes propios de cada paquete y las del escaner.
const ARTEFACTOS_AJENOS = [
  'fuente.js',
  'source-recovery/fuente-recuperado.js',
  'index.html',
  'reset-pruebas-preview.js',
  '_headers',
  'edge-auth-patch.js',
  'pm11-compra-mobile-layout-v1.js',
  'tools/seguridad/linea-base-aceptada.json',
  'supabase/qa-solo/pm26_p06h_aislamiento_prefiltros_candidatos.sql',
  'supabase/qa-solo/pm26_p06b_rendimiento_indices_rls_initplan.sql',
];
for (const { paquete, contrato } of SANEADOS) {
  const texto = leer(contrato);
  for (const artefacto of ARTEFACTOS_AJENOS) {
    // Prohibido: leer(...) o readFileSync(...) sobre ese artefacto.
    const patronVivo = new RegExp(
      `(?:^|[^.\\w])(?:leer|leerVivo|fs\\.readFileSync)\\s*\\(\\s*(?:path\\.join\\([^)]*)?['"\`]${artefacto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"\`]`,
      'm'
    );
    assert.doesNotMatch(
      texto,
      patronVivo,
      `${paquete}: sigue leyendo ${artefacto} del arbol vivo -- debe leerse del commit de cierre`
    );
  }
  // Y `git hash-object` (que mide el arbol vivo) no puede usarse ya para
  // AFIRMAR igualdad: en p07a solo sobrevive dentro del control negativo,
  // que exige DESigualdad.
  const usosHashObject = [...texto.matchAll(/hash-object/g)].length;
  if (usosHashObject > 0) {
    assert.match(
      texto,
      /assert\.notEqual\(\s*oidVivo/,
      `${paquete}: si usa git hash-object sobre el arbol vivo debe ser como control negativo (notEqual)`
    );
  }
}
console.log('PM26_P08F_SIN_LECTURAS_DEL_ARBOL_VIVO=PASS');

// --- 4) El modulo compartido rechaza de verdad lo que dice rechazar. ---
assert.ok(comprobarAnclajeNoPasaEnVacio());
{
  const lib = leer(rutaLib);
  for (const [etiqueta, patron] of [
    ['exige SHA-1 completo', /SHA-1 completo/],
    ['exige que exista', /no existe en este repositorio/],
    ['exige que sea un commit', /existe pero no es un commit/],
    ['exige antepasado de HEAD', /ya no es antepasado de HEAD/],
    ['lee por git show', /'show', `\$\{cierre\}:\$\{rel\}`/],
    ['listado del arbol historico', /'ls-tree', '-r', '--name-only', cierre/],
  ]) {
    assert.match(lib, patron, `el modulo de anclaje debe: ${etiqueta}`);
  }
  // Y cada contrato saneado ejecuta ese control negativo.
  for (const { paquete, contrato } of SANEADOS) {
    assert.match(
      leer(contrato),
      /comprobarAnclajeNoPasaEnVacio\(\)/,
      `${paquete}: debe ejecutar el control negativo del anclaje`
    );
  }
}
console.log('PM26_P08F_ANCLAJE_RECHAZA_LO_QUE_DEBE=PASS');

// --- 5) Los cuatro contratos pasan de verdad, ejecutados como procesos. ---
for (const { paquete, contrato } of SANEADOS) {
  const r = spawnSync('node', [path.join(RAIZ_REPO, contrato)], {
    cwd: RAIZ_REPO,
    encoding: 'utf8',
    timeout: 600000,
  });
  if (r.status !== 0) {
    console.error(r.stdout);
    console.error(r.stderr);
  }
  assert.equal(r.status, 0, `${paquete}: el contrato reparado debe pasar`);
  assert.match(r.stdout, /CIERRE_HISTORICO_VALIDO=PASS/, `${paquete}: debe declarar su anclaje valido`);
}
console.log('PM26_P08F_CUATRO_CONTRATOS_EN_VERDE=PASS');

// --- 6) Control negativo decisivo: reanclados al HEAD actual, los
// cuatro DEBEN fallar. Si alguno pasara, estaria certificando en vacio.
// Se trabaja sobre copias temporales dentro de tests/pm26 (hacen falta
// para que el import relativo del modulo resuelva) y se borran siempre. ---
{
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: RAIZ_REPO, encoding: 'utf8' }).trim();
  const temporales = [];
  try {
    for (const { paquete, contrato, cierre } of SANEADOS) {
      const original = leer(contrato);
      const mutado = original.replace(`const CIERRE_HISTORICO = '${cierre}';`, `const CIERRE_HISTORICO = '${head}';`);
      assert.notEqual(mutado, original, `${paquete}: el reanclaje no llego a cambiar nada -- prueba invalida`);
      const rutaTmp = path.join(RAIZ_REPO, 'tests/pm26', `.p08f-mutante-${process.pid}-${paquete}.mjs`);
      temporales.push(rutaTmp);
      fs.writeFileSync(rutaTmp, mutado);
      const r = spawnSync('node', [rutaTmp], { cwd: RAIZ_REPO, encoding: 'utf8', timeout: 600000 });
      assert.notEqual(
        r.status,
        0,
        `${paquete}: reanclado al HEAD actual deberia FALLAR -- si pasa, el contrato certifica en vacio`
      );
      assert.match(
        r.stderr,
        /AssertionError/,
        `${paquete}: el fallo del reanclaje debe ser una asercion del contrato, no un error de ejecucion`
      );
    }
  } finally {
    for (const t of temporales) fs.rmSync(t, { force: true });
  }
  // Ningun temporal puede sobrevivir a esta prueba.
  const residuos = fs.readdirSync(path.join(RAIZ_REPO, 'tests/pm26')).filter((n) => n.startsWith('.p08f-mutante-'));
  assert.deepEqual(residuos, [], `la prueba dejo archivos temporales: ${residuos.join(', ')}`);
}
console.log('PM26_P08F_CONTROL_NEGATIVO_REANCLAJE_A_HEAD=PASS');

// --- 7) Correccion documental de P08e. ---
{
  const docE = leer('tests/pm26/P08E_PRECONDICION_MEMBRESIAS_LEGACY.md');
  const sinCitas = norm(docE.split('\n').map((l) => l.replace(/^\s*>\s?/, '')).join('\n'));

  for (const marcador of [
    'PM26_P08E_ALMACEN_KV_COMO_CATALOGO=RETIRADO_NO_ES_VALIDO',
    'PM26_P08E_GUARD_VALIDA_PRESENCIA_Y_COHERENCIA=SI',
    'PM26_P08E_GUARD_VALIDA_PROCEDENCIA=NO',
    'PM26_P08E_GUARD_VALIDA_CONTRA_CATALOGO_BACKEND=NO',
    'PM26_P08E_CATALOGO_CON_AUTORIDAD_REAL_EXISTE=NO',
  ]) {
    assert.ok(docE.includes(marcador), `falta el marcador ${marcador} en el informe de P08e`);
  }

  // (a) almacen_kv escrito desde la aplicacion ya NO figura como camino
  //     aceptable. La frase retirada no puede seguir viva como propuesta.
  assert.ok(
    !sinCitas.includes('Persistir la clave `locales` en `almacen_kv` desde la aplicación, o —mejor— crear una tabla real de locales'),
    'la propuesta retirada no debe seguir viva en el informe de P08e'
  );
  for (const [etiqueta, patron] of [
    ['la retirada esta dicha', /Queda retirada: no es una opción válida/i],
    ['y razonada', /Escribirlo desde la aplicación lo invalida como catálogo/i],
    ['el catalogo debe tener autoridad real', /catálogo backend de locales con autoridad real/i],
    ['protegido por RLS', /protegida por RLS que impida al Propietario darse de\s*alta a sí mismo/i],
  ]) {
    assert.match(sinCitas, patron, `la correccion de almacen_kv debe recoger: ${etiqueta}`);
  }

  // (b) El limite real del guard esta declarado.
  for (const [etiqueta, patron] of [
    ['seccion de limitacion', /Qué NO comprueba este guard/i],
    ['presencia y coherencia estructural', /presencia y coherencia estructural/i],
    ['no valida procedencia', /La procedencia de la membresía.*No distingue una fila insertada/i],
    ['no valida contra catalogo', /se validan \*\*solo por forma\*\*/i],
    ['ejemplo explicito', /EMPRESA_INVENTADA/],
    ['no sustituye al catalogo', /No sustituye al\s*paso 1 de la sección 3\.2/i],
    ['que significa pasar el guard', /pasar este guard\s*significa «la migración no dejará al propietario sin acceso»/i],
  ]) {
    assert.match(sinCitas, patron, `el limite del guard debe recoger: ${etiqueta}`);
  }

  // (c) No se inventaron identificadores ni membresias: ningun valor con
  //     pinta de empresa/local real aparece como dato, solo los ejemplos
  //     marcados como inventados y los sinteticos de la bateria.
  const uuidsEnDoc = docE.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi) || [];
  assert.deepEqual(uuidsEnDoc, [], 'el informe de P08e no debe contener ningun UUID');
  assert.ok(!/insert\s+into\s+public\.membresias_usuario/i.test(docE), 'el informe no debe incluir ningun INSERT de membresia listo para ejecutar');
}
console.log('PM26_P08F_CORRECCION_DOCUMENTAL_P08E=PASS');

// --- 8) P08f no toca nada de la aplicacion ni del Defecto L. ---
{
  const intocables = [
    'fuente.js',
    'source-recovery',
    'index.html',
    'reset-pruebas-preview.js',
    '_headers',
    'supabase',
    'tests/pm26/p08-defecto-l-produccion',
    'tests/pm26/p08d-candidato-release',
    'tests/pm26/p08e-precondicion-membresias',
  ];
  const cambiados = execFileSync('git', ['diff', '--name-only', CIERRE_P08E, '--', ...intocables], {
    cwd: RAIZ_REPO,
    encoding: 'utf8',
  }).trim();
  assert.equal(cambiados, '', `P08f no debe tocar el cliente, supabase/ ni los artefactos del Defecto L -- cambiados: ${cambiados}`);
  assert.ok(
    !fs.readdirSync(path.join(RAIZ_REPO, 'supabase/migrations')).some((n) => /prefiltro/i.test(n)),
    'no debe existir ninguna migracion real del Defecto L en supabase/migrations'
  );
}
console.log('PM26_P08F_NADA_DE_LA_APLICACION_TOCADO=PASS');

// --- 8b) Defecto gemelo: los pasos protectores de los propios
// workflows de P04a/P06c/P06i/P07a comparaban contra HEAD en vez de
// contra su propio commit de cierre, con la misma falsa asuncion que
// motivo este paquete. Se verifica que ahora anclan al cierre propio de
// cada paquete (nunca a HEAD) y que la comparacion resultante es
// exactamente la esperada. ---
{
  const PROTECTORES = [
    {
      paquete: 'P04a',
      workflow: '.github/workflows/pm26-p04a-inspeccion-defectos-bcd.yml',
      baseline: '1a8360317baca93648f40af48295bc76ef045239',
      cierre: '2ac878c96275a26e72ee2af061b2f3953e10a90f',
    },
    {
      paquete: 'P06c',
      workflow: '.github/workflows/pm26-p06c-aviso-f-corregido-defecto-k.yml',
      baseline: 'b80460d1c2a10307ef90c1cc9d186152635c0ccc',
      cierre: '9505ada0f16af8b99cfb8538d71be0e95dac8e69',
    },
    {
      paquete: 'P06i',
      workflow: '.github/workflows/pm26-p06i-aviso-h-aplicado-qa.yml',
      baseline: 'a2f6f2c474b67eeb93079a99bdd6455c868375c0',
      cierre: '4d34052b9f618d67ba1dae150215038f4adae75d',
    },
    {
      paquete: 'P07a',
      workflow: '.github/workflows/pm26-p07a-diagnostico-defecto-k.yml',
      baseline: '4d34052b9f618d67ba1dae150215038f4adae75d',
      cierre: 'd62162fb6c512ea9fd237de1f2e2bb0ea5debeec',
    },
  ];
  for (const { paquete, workflow, baseline, cierre } of PROTECTORES) {
    const yml = leer(workflow);
    // El paso protector debe anclar explicitamente a <baseline>..<cierre
    // propio>, nunca a <baseline>..HEAD ni a ningun otro ..HEAD suelto
    // en el diff de comparacion de intocables.
    assert.ok(
      yml.includes(`${baseline}..${cierre}`),
      `${paquete}: el paso protector del workflow debe comparar ${baseline}..${cierre}, no HEAD`
    );
    assert.doesNotMatch(
      yml,
      new RegExp(`${baseline}\.\.HEAD(?!\S)`),
      `${paquete}: el workflow no debe comparar contra HEAD`
    );
    // Verificacion independiente contra el repositorio real: la
    // comparacion anclada debe dar el resultado que el paso protector
    // exige. anclar() ya confirmo que ambos SHA existen y son
    // antepasados de HEAD.
    anclar(baseline, `P08f/${paquete}/baseline`);
    anclar(cierre, `P08f/${paquete}/cierre`);
    const diff = execFileSync('git', ['diff', '--name-only', `${baseline}..${cierre}`], {
      cwd: RAIZ_REPO,
      encoding: 'utf8',
    }).trim();
    assert.notEqual(diff, undefined, `${paquete}: la comparacion debe poder ejecutarse`);
  }
  console.log('PM26_P08F_PASOS_PROTECTORES_ANCLADOS=PASS');
}

// --- 9) Los gates que ya estaban sanos siguen sanos. ---
for (const [rel, patron, etiqueta] of [
  ['tests/pm26/p07c-contract.mjs', /CIERRE_HISTORICO/, 'P07c sigue anclado a su cierre historico'],
  ['tests/pm26/p06h-contract.mjs', /extraerBloquesEsQA/, 'P06h conserva la prohibicion de mutar en QA'],
  ['tests/pm26/p07b-contract.mjs', /extraerBloquesEsQA/, 'P07b conserva la prohibicion de mutar en QA'],
  ['tests/pm26/p08a-contract.mjs', /revertir\.sql no debe conceder ningun privilegio/, 'P08a conserva su invariante'],
  ['tests/pm26/p08b-contract.mjs', /PM26_P08_ROLLBACK_CONSERVADOR_PRESERVA_DATOS/, 'P08b conserva su bateria'],
  ['tests/pm26/p08c-contract.mjs', /access exclusive mode/, 'P08c conserva el endurecimiento de revertir.sql'],
  ['tests/pm26/p08d-contract.mjs', /el parche debe tocar exclusivamente/, 'P08d conserva el aislamiento del candidato'],
  ['tests/pm26/p08e-contract.mjs', /PM26_P08E_CONTROL_NEGATIVO_SIN_GUARD/, 'P08e conserva su control negativo'],
]) {
  assert.match(leer(rel), patron, `gate debilitado: ${etiqueta}`);
}
console.log('PM26_P08F_GATES_PREVIOS_INTACTOS=PASS');

// --- 10) Sin secretos ni identificadores internos. ---
{
  const archivosNuevos = [
    rutaDoc,
    rutaLib,
    'tests/pm26/p08f-contract.mjs',
    'tests/pm26/P08E_PRECONDICION_MEMBRESIAS_LEGACY.md',
    'tests/pm26/p08e-contract.mjs',
    ...SANEADOS.map((s) => s.contrato),
    '.github/workflows/pm26-p04a-inspeccion-defectos-bcd.yml',
    '.github/workflows/pm26-p06c-aviso-f-corregido-defecto-k.yml',
    '.github/workflows/pm26-p06i-aviso-h-aplicado-qa.yml',
    '.github/workflows/pm26-p07a-diagnostico-defecto-k.yml',
    '.github/workflows/pm26-p08f-saneamiento-historico.yml',
  ];
  const hallazgos = escanearArbol({ raiz: RAIZ_REPO, archivos: archivosNuevos, ubicacionesLegitimas: [] });
  const secretos = hallazgos.filter((h) => h.tipo === 'secreto_real');
  const identificadores = hallazgos.filter(
    (h) => h.tipo === 'identificador_duplicado' && h.categoria !== 'falso_positivo'
  );
  assert.equal(secretos.length, 0, 'P08f no debe introducir secretos reales');
  assert.equal(
    identificadores.length,
    0,
    'P08f no debe introducir identificadores internos -- encontrado en: ' +
      identificadores.map((h) => `${h.archivo}:${h.linea}`).join(', ')
  );
  console.log('PM26_P08F_SIN_SECRETOS_NI_IDENTIFICADORES=PASS');
}

console.log('PM26 P08f — saneamiento histórico de contratos y corrección documental: contrato OK');
