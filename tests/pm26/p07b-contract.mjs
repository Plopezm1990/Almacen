import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { escanearArbol } from '../../tools/seguridad/verificar-secretos-e-identificadores.mjs';

// PM26 P07b: corrige K y prepara de forma coordinada la Fase B de F.
// Todas las llamadas HTTP y Supabase de este contrato son dobles en
// memoria; no se permite ninguna petición real ni ninguna escritura.

const __filename = fileURLToPath(import.meta.url);
const RAIZ_REPO = path.resolve(path.dirname(__filename), '..', '..');
const BASELINE_P07A = 'd62162fb6c512ea9fd237de1f2e2bb0ea5debeec';

function leer(rel) {
  return fs.readFileSync(path.join(RAIZ_REPO, rel), 'utf8');
}

function sha256(rel) {
  return crypto.createHash('sha256').update(fs.readFileSync(path.join(RAIZ_REPO, rel))).digest('hex');
}

function bloque(texto, inicio, fin) {
  const desde = texto.indexOf(inicio);
  assert.ok(desde >= 0, `no se encontro el inicio: ${inicio}`);
  const hasta = texto.indexOf(fin, desde + inicio.length);
  assert.ok(hasta > desde, `no se encontro el final posterior: ${fin}`);
  return texto.slice(desde, hasta);
}

function normalizar(valor) {
  return JSON.parse(JSON.stringify(valor));
}

// Aisla cada bloque "if (esQA) { ... }" contando llaves, sin depender
// de la indentacion literal que produzca esbuild (mismo criterio que
// tests/pm26/p06h-contract.mjs).
function extraerBloquesEsQA(texto, etiqueta) {
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
    assert.ok(profundidad === 0, `${etiqueta}: bloque "if (esQA) {" sin cierre`);
    bloques.push(texto.slice(inicio, i));
    desde = i;
  }
  assert.ok(bloques.length >= 2, `${etiqueta}: se esperaban al menos 2 bloques "if (esQA) { ... }" (crear y eliminar), encontrados ${bloques.length}`);
  return bloques;
}

const rutaDoc = 'tests/pm26/P07B_DEFECTO_K_FASE_B_IMPLEMENTADOS.md';
const doc = leer(rutaDoc);
for (const marcador of [
  'PM26_P07B_ESTADO=IMPLEMENTADO_VALIDADO_SIN_DESPLEGAR',
  'PM26_P07B_DEFECTO_K_CORREGIDO=SI',
  'PM26_P07B_URL_DERIVADA_NUBE_ACTIVA=SI',
  'PM26_P07B_QA_FAIL_CLOSED=SI',
  'PM26_P07B_PETICIONES_REALES=0',
  'PM26_P07B_FASE_B_RPC_PREPARADA=SI',
  'PM26_P07B_LISTADO_RLS_DIRECTO=SI',
  'PM26_P07B_F_SQL_ENDURECIDO=SI',
  'PM26_P07B_F_APLICADO_QA=NO',
  'PM26_P07B_EDGE_QA_DESPLEGADA=NO',
  'PM26_P07B_PRODUCCION_TPV_MAIN_RELEASE_NETLIFY_TOCADOS=NO',
  'PM26_P07B_PM25_P02=PARCIAL_BLOQUEADO',
]) {
  assert.ok(doc.includes(marcador), `falta el marcador ${marcador}`);
}
console.log('PM26_P07B_DOCUMENTO_Y_ALCANCE=PASS');

const rutasArtefactos = [
  ['canonica', 'source-recovery/fuente-recuperado.js'],
  ['servida', 'fuente.js'],
  ['construida', 'source-recovery/dist/fuente.js'],
];
for (const [, rel] of rutasArtefactos) {
  assert.ok(fs.existsSync(path.join(RAIZ_REPO, rel)), `falta ${rel}; ejecutar primero el build canonico`);
}

function validarImplementacion(texto, etiqueta) {
  const logica = bloque(texto, 'function crearLogicaPrefiltros(', 'function SelectorDiseno(');
  const helper = bloque(texto, 'function origenSupabasePublicoPM26(', 'function PrefiltroPublico(');
  const publico = bloque(texto, 'function PrefiltroPublico({ token })', 'var ultimosErroresAvisados');

  assert.doesNotMatch(
    texto,
    /https:\/\/[a-z0-9]+\.supabase\.co\/functions\/v1\/prefiltro-candidato/,
    `${etiqueta}: no puede quedar el endpoint literal de K`
  );
  assert.match(helper, /entorno\.NUBE_URL/);
  assert.match(helper, /entorno\.__modoPruebasLocal\s*===\s*true/);
  assert.match(helper, /entorno\.__modoPruebasQA\s*===\s*true/);
  assert.match(helper, /entorno\.__qaNubeUrl/);
  assert.match(helper, /if \(origenActivo !== origenQA\) throw new Error\("configuracion_qa_incoherente"\)/);
  assert.match(helper, /new URL\(`\/functions\/v1\/\$\{slug\}`/);
  assert.match(helper, /JSON\.stringify\(\{ \.\.\.datos, accion \}\)/, `${etiqueta}: la accion autoritativa debe prevalecer`);
  assert.equal(
    (publico.match(/invocarFuncionPublicaPM26\("prefiltro-candidato"/g) || []).length,
    2,
    `${etiqueta}: comprobar y enviar deben compartir el adaptador`
  );
  assert.doesNotMatch(publico, /\bfetch\s*\(/, `${etiqueta}: PrefiltroPublico no debe saltarse el adaptador`);

  // PM26 P08b extiende crearLogicaPrefiltros con una rama de produccion
  // (INSERT/DELETE directos, guardada por !esQA) junto a la rama RPC de
  // QA que P07b preparo aqui -- ver tests/pm26/P08B_DEFECTO_L_CLIENTE_COORDINADO.md.
  // Esta funcion sigue validando, sin reescribir su alcance original,
  // que la rama RPC de QA permanece intacta. Los nombres de variable
  // locales (data/error vs data2/error2) pueden variar segun como
  // esbuild componga el bundle -- se derivan por backreference, nunca
  // se asumen fijos (mismo patron ya usado en PM26 P03b).
  assert.match(logica, /function crearLogicaPrefiltros\(\{ registrarAuditoria, empresaId, localId, esQA \}\)/);
  assert.match(
    logica,
    /\.rpc\("pm11_crear_prefiltro_candidato",\s*\{\s*p_empresa_id:\s*empresaId,\s*p_local_id:\s*localId,\s*p_candidato_nombre:\s*nombre\s*\}\)/
  );
  assert.match(logica, /\.from\("prefiltros_candidatos"\)\.select\("\*"\)\.order\("creado_en", \{ ascending: false \}\)/);
  assert.match(logica, /const empresaFila = prefiltro\?\.empresa_id;/);
  assert.match(logica, /const localFila = prefiltro\?\.local_id;/);
  assert.match(
    logica,
    /\.rpc\("pm11_eliminar_prefiltro_candidato",\s*\{\s*p_empresa_id:\s*empresaFila,\s*p_local_id:\s*localFila,\s*p_token:\s*token\s*\}\)/
  );

  // El alias de "error" puede ser la forma abreviada ({ error }) o
  // explicita ({ error: errorX }) segun como esbuild componga el
  // bundle -- ambas formas se aceptan.
  const mCrearRpc = logica.match(/const \{ data: (\w+), error(?:: (\w+))? \} = await supabase\.rpc\("pm11_crear_prefiltro_candidato"/);
  assert.ok(mCrearRpc, `${etiqueta}: no se pudo aislar la respuesta de la RPC de alta`);
  assert.match(logica, new RegExp(`if \\(${mCrearRpc[2] || 'error'} \\|\\| !tokenValido\\(${mCrearRpc[1]}\\)\\) return null;`));

  const mBorrarRpc = logica.match(/const \{ data(?:: (\w+))?, error(?:: (\w+))? \} = await supabase\.rpc\("pm11_eliminar_prefiltro_candidato"/);
  assert.ok(mBorrarRpc, `${etiqueta}: no se pudo aislar la respuesta de la RPC de baja`);
  assert.match(logica, new RegExp(`if \\(${mBorrarRpc[2] || 'error'} \\|\\| ${mBorrarRpc[1] || 'data'} !== true\\) return false;`));

  // La rama QA (if (esQA) { ... }) tiene PROHIBIDO mutar
  // prefiltros_candidatos directamente -- QA solo escribe por RPC
  // (revocado el INSERT/DELETE directo en supabase/qa-solo/..., ver
  // p06h-contract.mjs). El bloque se aisla contando llaves para no
  // depender de la indentacion exacta que produzca esbuild.
  for (const bloqueQA of extraerBloquesEsQA(logica, etiqueta)) {
    assert.doesNotMatch(
      bloqueQA,
      /\.from\("prefiltros_candidatos"\)\.(?:insert|delete)\(/,
      `${etiqueta}: la rama QA (if (esQA)) no debe mutar prefiltros_candidatos directamente`
    );
  }

  // La rama de produccion (PM26 P08b, guardada por !esQA) SI usa el
  // camino RLS directo exclusivo de produccion -- validado en positivo
  // aqui, no solo tolerado: INSERT con empresa_id/local_id, y un
  // DELETE que exige .select() y exactamente una fila para distinguir
  // un borrado bloqueado por RLS de uno real.
  assert.match(logica, /\.from\("prefiltros_candidatos"\)\.insert\(\{/, `${etiqueta}: falta el INSERT directo de produccion`);
  assert.match(logica, /empresa_id:\s*empresaId,\s*\n\s*local_id:\s*localId/, `${etiqueta}: el INSERT directo debe llevar empresa_id/local_id`);
  const mBorrarDirecto = logica.match(
    /const \{ data(?:: (\w+))?, error(?:: (\w+))? \} = await supabase\.from\("prefiltros_candidatos"\)\.delete\(\)\.eq\("token", token\)\.select\(\);/
  );
  assert.ok(mBorrarDirecto, `${etiqueta}: no se pudo aislar la respuesta del DELETE directo de produccion`);
  const nombreDataDirecto = mBorrarDirecto[1] || 'data';
  const nombreErrorDirecto = mBorrarDirecto[2] || 'error';
  assert.match(
    logica,
    new RegExp(`if \\(${nombreErrorDirecto} \\|\\| !Array\\.isArray\\(${nombreDataDirecto}\\) \\|\\| ${nombreDataDirecto}\\.length !== 1\\) return false;`),
    `${etiqueta}: el DELETE directo de produccion debe exigir exactamente una fila devuelta`
  );

  assert.match(
    texto,
    /crearLogicaPrefiltros\(\{\s*registrarAuditoria,\s*empresaId:\s*empresaDelLocalActivo\?\.id \|\| null,\s*localId:\s*localActivoId \|\| null,\s*esQA:[^}]*\}\)/
  );
  assert.match(texto, /eliminarPrefiltro\(confirmarEliminarPrefiltro\)/);
  return { helper, logica };
}

const artefactos = rutasArtefactos.map(([etiqueta, rel]) => {
  const texto = leer(rel);
  const bloques = validarImplementacion(texto, etiqueta);
  return { etiqueta, rel, texto, ...bloques };
});
console.log('PM26_P07B_CANONICA_CONSTRUIDA_SERVIDA=PASS');

function cargarApiPublica(helper) {
  const contexto = vm.createContext({ URL, JSON });
  vm.runInContext(
    `${helper}\nthis.__apiPublica = { construirUrlFuncionPublicaPM26, invocarFuncionPublicaPM26 };`,
    contexto
  );
  return contexto.__apiPublica;
}

async function probarKEnMemoria(helper, etiqueta) {
  const api = cargarApiPublica(helper);
  const llamadas = [];
  const fetchDoble = async (url, opciones) => {
    llamadas.push({ url, opciones: normalizar(opciones) });
    return { ok: true, json: async () => ({ ok: true }) };
  };
  const prod = { NUBE_URL: 'https://prod.example.invalid' };
  const qa = {
    NUBE_URL: 'https://qa.example.invalid',
    __modoPruebasQA: true,
    __qaNubeUrl: 'https://qa.example.invalid',
    fetch: fetchDoble,
  };

  const respuestaProd = await api.invocarFuncionPublicaPM26(
    'prefiltro-candidato',
    'comprobar',
    { token: 'token-simulado', accion: 'no-debe-prevalecer' },
    prod,
    fetchDoble
  );
  assert.equal(respuestaProd.ok, true);
  assert.equal(llamadas[0].url, 'https://prod.example.invalid/functions/v1/prefiltro-candidato');
  assert.deepEqual(JSON.parse(llamadas[0].opciones.body), { token: 'token-simulado', accion: 'comprobar' });
  assert.deepEqual(llamadas[0].opciones.headers, { 'Content-Type': 'application/json' });
  assert.doesNotMatch(JSON.stringify(llamadas[0].opciones), /authorization|apikey/i);

  await api.invocarFuncionPublicaPM26(
    'prefiltro-candidato',
    'enviar',
    { token: 'token-simulado', respuestas: { uno: 'dos' } },
    qa
  );
  assert.equal(llamadas[1].url, 'https://qa.example.invalid/functions/v1/prefiltro-candidato');
  assert.equal(JSON.parse(llamadas[1].opciones.body).accion, 'enviar');

  // En modo producción una referencia QA residual no puede desviar la URL.
  await api.invocarFuncionPublicaPM26(
    'prefiltro-candidato',
    'comprobar',
    {},
    { NUBE_URL: 'https://prod.example.invalid', __qaNubeUrl: 'https://qa.example.invalid', __modoPruebasQA: false },
    fetchDoble
  );
  assert.equal(llamadas[2].url, 'https://prod.example.invalid/functions/v1/prefiltro-candidato');

  const invalidos = [
    [null, 'backend_publico_no_disponible'],
    [{}, 'nube_url_ausente'],
    [{ NUBE_URL: 'ftp://qa.example.invalid' }, 'nube_url_invalida'],
    [{ NUBE_URL: 'https://usuario:clave@qa.example.invalid' }, 'nube_url_invalida'],
    [{ NUBE_URL: 'https://qa.example.invalid?destino=otro' }, 'nube_url_invalida'],
    [{ NUBE_URL: 'https://qa.example.invalid#fragmento' }, 'nube_url_invalida'],
    [{ NUBE_URL: 'https://qa.example.invalid/ruta' }, 'nube_url_invalida'],
    [{ NUBE_URL: 'https://qa.example.invalid', __modoPruebasLocal: true }, 'backend_publico_no_disponible'],
    [{ NUBE_URL: 'https://prod.example.invalid', __modoPruebasQA: true, __qaNubeUrl: 'https://qa.example.invalid' }, 'configuracion_qa_incoherente'],
    [{ NUBE_URL: 'https://qa.example.invalid', __modoPruebasQA: true }, 'qa_nube_url_ausente'],
  ];
  for (const [entorno, errorEsperado] of invalidos) {
    const antes = llamadas.length;
    await assert.rejects(
      api.invocarFuncionPublicaPM26('prefiltro-candidato', 'comprobar', {}, entorno, fetchDoble),
      new RegExp(errorEsperado),
      `${etiqueta}: configuración inválida debe fallar cerrada`
    );
    assert.equal(llamadas.length, antes, `${etiqueta}: no debe haber fetch tras ${errorEsperado}`);
  }

  for (const [slug, accion, errorEsperado] of [
    ['otra-funcion', 'comprobar', 'funcion_publica_no_permitida'],
    ['prefiltro-candidato', 'otra-accion', 'accion_publica_no_permitida'],
  ]) {
    const antes = llamadas.length;
    await assert.rejects(api.invocarFuncionPublicaPM26(slug, accion, {}, prod, fetchDoble), new RegExp(errorEsperado));
    assert.equal(llamadas.length, antes, `${etiqueta}: slug/acción inválidos no deben llamar a fetch`);
  }
  return llamadas.length;
}

function cargarLogica(logica, ventana) {
  const contexto = vm.createContext({ window: ventana });
  vm.runInContext(`${logica}\nthis.__crearLogicaPrefiltros = crearLogicaPrefiltros;`, contexto);
  return contexto.__crearLogicaPrefiltros;
}

function clienteDoble({ respuestasRpc = [], filas = [], errorListado = null, secuencia = [] } = {}) {
  const llamadas = [];
  let indiceRpc = 0;
  return {
    llamadas,
    cliente: {
      async rpc(nombre, argumentos) {
        llamadas.push({ tipo: 'rpc', nombre, argumentos: normalizar(argumentos) });
        secuencia.push(`rpc:${nombre}`);
        return respuestasRpc[indiceRpc++] ?? { data: null, error: null };
      },
      from(tabla) {
        llamadas.push({ tipo: 'from', tabla });
        return {
          select(columnas) {
            llamadas.push({ tipo: 'select', columnas });
            return {
              async order(columna, opciones) {
                llamadas.push({ tipo: 'order', columna, opciones: normalizar(opciones) });
                return { data: filas, error: errorListado };
              },
            };
          },
        };
      },
    },
  };
}

async function escenarioLogica(logica, { empresaId = 'empresa-activa', localId = 'local-activo', esQA = true, doble } = {}) {
  const auditorias = [];
  let accesosCliente = 0;
  const ventana = {
    async getSupabaseClient() {
      accesosCliente += 1;
      return doble.cliente;
    },
  };
  const crear = cargarLogica(logica, ventana);
  const api = crear({
    empresaId,
    localId,
    esQA,
    registrarAuditoria(...args) {
      auditorias.push(args);
      if (doble.secuencia) doble.secuencia.push('auditoria');
    },
  });
  return { api, auditorias, accesos: () => accesosCliente };
}

async function probarFEnMemoria(logica, etiqueta) {
  const token = 'ab'.repeat(32);
  const secuenciaCrear = [];
  const dobleCrear = clienteDoble({ respuestasRpc: [{ data: token, error: null }], secuencia: secuenciaCrear });
  dobleCrear.secuencia = secuenciaCrear;
  const crearOk = await escenarioLogica(logica, { doble: dobleCrear });
  const tokenCreado = await crearOk.api.crearPrefiltro('  Candidata simulada  ');
  assert.equal(tokenCreado, token);
  assert.deepEqual(dobleCrear.llamadas[0], {
    tipo: 'rpc',
    nombre: 'pm11_crear_prefiltro_candidato',
    argumentos: {
      p_empresa_id: 'empresa-activa',
      p_local_id: 'local-activo',
      p_candidato_nombre: 'Candidata simulada',
    },
  });
  assert.deepEqual(secuenciaCrear, ['rpc:pm11_crear_prefiltro_candidato', 'auditoria']);
  assert.equal(crearOk.auditorias.length, 1);

  for (const caso of [
    { empresaId: null, localId: 'local-activo', nombre: 'Nombre' },
    { empresaId: 'empresa-activa', localId: null, nombre: 'Nombre' },
    { empresaId: 'empresa-activa', localId: 'todos', nombre: 'Nombre' },
    { empresaId: 'empresa-activa', localId: 'Todos los locales', nombre: 'Nombre' },
    { empresaId: 'empresa-activa', localId: 'local-activo', nombre: '   ' },
  ]) {
    const doble = clienteDoble();
    const escenario = await escenarioLogica(logica, { empresaId: caso.empresaId, localId: caso.localId, doble });
    assert.equal(await escenario.api.crearPrefiltro(caso.nombre), null, `${etiqueta}: alta sin contexto debe fallar`);
    assert.equal(escenario.accesos(), 0, `${etiqueta}: alta inválida no debe obtener cliente`);
    assert.equal(doble.llamadas.length, 0);
  }

  for (const respuesta of [
    { data: 'token-invalido', error: null },
    { data: token, error: { message: 'fallo-simulado' } },
  ]) {
    const doble = clienteDoble({ respuestasRpc: [respuesta] });
    const escenario = await escenarioLogica(logica, { doble });
    assert.equal(await escenario.api.crearPrefiltro('Nombre'), null);
    assert.equal(escenario.auditorias.length, 0, `${etiqueta}: alta fallida no debe auditarse`);
  }

  const filas = [{ token, empresa_id: 'empresa-fila', local_id: 'local-fila' }];
  const dobleLista = clienteDoble({ filas });
  const lista = await escenarioLogica(logica, { doble: dobleLista });
  assert.deepEqual(normalizar(await lista.api.listarPrefiltros()), filas);
  assert.deepEqual(dobleLista.llamadas, [
    { tipo: 'from', tabla: 'prefiltros_candidatos' },
    { tipo: 'select', columnas: '*' },
    { tipo: 'order', columna: 'creado_en', opciones: { ascending: false } },
  ]);

  const fila = { token, empresa_id: 'empresa-fila', local_id: 'local-fila', candidato_nombre: 'Candidata' };
  const dobleBorrar = clienteDoble({ respuestasRpc: [{ data: true, error: null }] });
  const borrarOk = await escenarioLogica(logica, {
    empresaId: 'empresa-activa-distinta',
    localId: 'local-activo-distinto',
    doble: dobleBorrar,
  });
  assert.equal(await borrarOk.api.eliminarPrefiltro(fila), true);
  assert.deepEqual(dobleBorrar.llamadas[0], {
    tipo: 'rpc',
    nombre: 'pm11_eliminar_prefiltro_candidato',
    argumentos: { p_empresa_id: 'empresa-fila', p_local_id: 'local-fila', p_token: token },
  });
  assert.equal(borrarOk.auditorias.length, 1);

  for (const respuesta of [
    { data: false, error: null },
    { data: { ok: true }, error: null },
    { data: true, error: { message: 'fallo-simulado' } },
  ]) {
    const doble = clienteDoble({ respuestasRpc: [respuesta] });
    const escenario = await escenarioLogica(logica, { doble });
    assert.equal(await escenario.api.eliminarPrefiltro(fila), false);
    assert.equal(escenario.auditorias.length, 0, `${etiqueta}: borrado ambiguo/fallido no debe auditarse`);
  }

  for (const filaInvalida of [
    { ...fila, token: 'no-valido' },
    { ...fila, empresa_id: null },
    { ...fila, local_id: null },
    { ...fila, local_id: 'todos' },
  ]) {
    const doble = clienteDoble();
    const escenario = await escenarioLogica(logica, { doble });
    assert.equal(await escenario.api.eliminarPrefiltro(filaInvalida), false);
    assert.equal(escenario.accesos(), 0, `${etiqueta}: borrado inválido no debe obtener cliente`);
    assert.equal(doble.llamadas.length, 0);
  }
}

let totalFetchDobles = 0;
for (const artefacto of artefactos) {
  totalFetchDobles += await probarKEnMemoria(artefacto.helper, artefacto.etiqueta);
  await probarFEnMemoria(artefacto.logica, artefacto.etiqueta);
}
assert.equal(totalFetchDobles, 9, 'solo deben existir las nueve llamadas interceptadas previstas');
console.log('PM26_P07B_K_PROD_QA_INVALIDO_SIN_RED_REAL=PASS');
console.log('PM26_P07B_F_RPC_Y_RLS_EN_MEMORIA=PASS');
console.log('PM26_P07B_PETICIONES_REALES=0');

// Mutaciones negativas deliberadas sobre copias en memoria: cada
// garantía crítica falla de forma independiente.
const canonica = artefactos.find((a) => a.etiqueta === 'canonica').texto;
for (const [nombre, mutar] of [
  ['sin-config-qa', (t) => t.replace('entorno.__qaNubeUrl', 'entorno.NUBE_URL')],
  ['endpoint-literal', (t) => t.replace('entorno.NUBE_URL, "nube_url"', '"https://prod.example.invalid", "nube_url"')],
  ['sin-rpc-crear', (t) => t.replace('supabase.rpc("pm11_crear_prefiltro_candidato"', 'supabase.from("prefiltros_candidatos").insert')],
  ['borrado-no-estricto', (t) => t.replace('error || data !== true', 'error || !data')],
  ['borrado-contexto-activo', (t) => t.replace('p_empresa_id: empresaFila', 'p_empresa_id: empresaId')],
]) {
  const mutado = mutar(canonica);
  assert.notEqual(mutado, canonica, `la mutacion ${nombre} debe modificar la copia`);
  assert.throws(() => validarImplementacion(mutado, `mutacion-${nombre}`), undefined, `la mutacion ${nombre} debe ser detectada`);
}
console.log('PM26_P07B_PRUEBAS_NEGATIVAS_EN_MEMORIA=PASS');

// SQL F endurecido y todavía aislado: el contrato P06h valida con más
// detalle el preflight idéntico y la batería PostgreSQL.
const sqlF = leer('supabase/qa-solo/pm26_p06h_aislamiento_prefiltros_candidatos.sql');
assert.match(sqlF, /begin;\s*set local lock_timeout = '5s';\s*set local statement_timeout = '30s';\s*-- PM26_P06H_PREFLIGHT_INICIO/s);
assert.doesNotMatch(sqlF, /\bset lock_timeout\s*=/i);
assert.doesNotMatch(sqlF, /\bset statement_timeout\s*=/i);
assert.equal(
  (sqlF.match(/revoke all on function public\.pm11_(?:crear|eliminar)_prefiltro_candidato\([^;]+\) from public, anon, authenticated, service_role;/g) || []).length,
  2,
  'las RPC F deben retirar también los grants directos por defecto de Supabase'
);
assert.ok(!fs.readdirSync(path.join(RAIZ_REPO, 'supabase/migrations')).some((nombre) => /prefiltro/i.test(nombre)));
console.log('PM26_P07B_SQL_F_ENDURECIDO_SIN_APLICAR=PASS');

// Los hashes del informe deben corresponder a los artefactos
// revisables; la igualdad no se usa como sustituto de pruebas
// funcionales. PM26 P08b extendio legitimamente crearLogicaPrefiltros
// (fuente canonica y bundle servido cambiaron de contenido) -- el hash
// vigente de esos tres artefactos se lee de P08b, sin reescribir la
// narrativa historica de este documento (mismo patron de la cadena
// P06b -> P06e -> P06f).
const docP08b = leer('tests/pm26/P08B_DEFECTO_L_CLIENTE_COORDINADO.md');
for (const rel of ['source-recovery/fuente-recuperado.js', 'fuente.js', 'source-recovery/dist/fuente.js']) {
  assert.ok(docP08b.includes(sha256(rel)), `P08b no contiene el SHA-256 real de ${rel}`);
}
for (const rel of [
  'supabase/qa-solo/pm26_p06h_aislamiento_prefiltros_candidatos.sql',
  'tests/pm26/p06h-f-aislado/preflight-catalogo.sql',
]) {
  assert.ok(doc.includes(sha256(rel)), `el informe no contiene el SHA-256 real de ${rel}`);
}
console.log('PM26_P07B_HASHES_VERIFICADOS=PASS');

// P07b no altera configuración, Edge Functions ni cabeceras. Se compara
// el contenido actual con el cierre remoto exacto de P07a.
for (const rel of ['index.html', 'reset-pruebas-preview.js', '_headers']) {
  const actual = fs.readFileSync(path.join(RAIZ_REPO, rel));
  const base = execFileSync('git', ['show', `${BASELINE_P07A}:${rel}`], { cwd: RAIZ_REPO });
  assert.deepEqual(actual, base, `${rel} debe permanecer byte a byte igual que en P07a`);
}
assert.equal(fs.existsSync(path.join(RAIZ_REPO, 'netlify.toml')), false, 'P07b no debe crear netlify.toml');
assert.ok(doc.includes(BASELINE_P07A), 'el informe debe identificar el baseline P07a exacto');

const archivosPaquete = [
  rutaDoc,
  'tests/pm26/p07b-contract.mjs',
  'tools/seguridad/linea-base-aceptada.json',
  '.github/workflows/pm26-p04b-aplicacion-defectos-bcd.yml',
  '.github/workflows/pm26-p03b-pipeline-canonico.yml',
  '.github/workflows/pm26-p06e-aviso-h-aislamiento-qa-solo.yml',
  '.github/workflows/pm26-p06f-aviso-h-endurecido.yml',
  '.github/workflows/pm26-p06h-aislamiento-prefiltros-candidatos.yml',
  '.github/workflows/pm26-p07b-defecto-k-fase-b.yml',
  '.github/workflows/pm26-p07b-source-recovery-check.yml',
  'tests/pm26/P06H_AVISO_F_DISENO_DESPLIEGUE.md',
  'tests/pm26/p03b-contract.mjs',
  'tests/pm26/p06h-contract.mjs',
  'tests/pm26/p06h-f-aislado/preflight-catalogo.sql',
  'tests/pm26/p06h-f-aislado/validar.sh',
  'supabase/qa-solo/pm26_p06h_aislamiento_prefiltros_candidatos.sql',
];
const reset = leer('reset-pruebas-preview.js');
const html = leer('index.html');
const qaHost = reset.match(/var SUPABASE_QA_HOST = "([^"]+)";/)?.[1];
const qaKey = reset.match(/var SUPABASE_QA_KEY = "([^"]+)";/)?.[1];
const prodHost = html.match(/var NUBE_URL = "https:\/\/([^"]+)";/)?.[1];
assert.ok(qaHost && qaKey && prodHost, 'no se pudieron derivar los identificadores desde sus ubicaciones legitimas');
for (const rel of archivosPaquete) {
  const contenido = leer(rel);
  assert.ok(!contenido.includes(qaHost), `${rel} no debe copiar el host QA`);
  assert.ok(!contenido.includes(qaKey), `${rel} no debe copiar la clave QA`);
  assert.ok(!contenido.includes(prodHost), `${rel} no debe copiar el host de produccion`);
}
const hallazgos = escanearArbol({ raiz: RAIZ_REPO, archivos: archivosPaquete, ubicacionesLegitimas: [] });
const secretos = hallazgos.filter((h) => h.tipo === 'secreto_real');
const identificadores = hallazgos.filter(
  (h) => h.tipo === 'identificador_duplicado' && h.categoria !== 'falso_positivo'
);
assert.equal(secretos.length, 0, 'P07b no debe introducir secretos reales');
assert.equal(
  identificadores.length,
  0,
  'P07b no debe duplicar identificadores internos: ' + identificadores.map((h) => `${h.archivo}:${h.linea}`).join(', ')
);
console.log('PM26_P07B_SIN_SECRETOS_NI_IDENTIFICADORES=PASS');

console.log('PM26 P07b — defecto K corregido y Fase B de F preparada: contrato OK');
